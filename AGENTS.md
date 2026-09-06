# Mortang Meals — agent guide

Read this before changing the app. It describes the **current** code, not the original v1 spec.

`docs/superpowers/` is a historical design and implementation plan from 2026-08-12. It is stale: it lists web import and a recipe library as non-goals, says generate writes a new current plan, and treats Kitchen as an appliance checklist only. Do not implement from those files.

## What this is

A local, single-household meal planner. The user describes who they cook for and how they cook; the app generates a week of recipes, keeps a meal library, and derives a shopping list.

No auth, no multi-household, no hosted deploy. One Next.js process. The browser never calls an AI provider.

Success path: set up household + kitchen → generate library drafts on Meals (or pick slots on This Week) → approve keepers → cook from a card → pin / swap / place from the library → shop from the merged list.

## Stack and commands

- Next.js 15 App Router (`src/`), React 19, TypeScript, Tailwind 4
- SQLite via `better-sqlite3` + Drizzle (queries only — schema is created in `src/lib/db.ts`, not drizzle-kit)
- Zod for AI JSON and HTTP bodies
- OpenAI SDK against xAI (`https://api.x.ai/v1`) or a custom OpenAI-compatible base URL
- Vitest. Component tests set `// @vitest-environment happy-dom`

```
npm run dev     # localhost:3000
npm test        # vitest run
npm run build
```

Env: copy `.env.example` to `.env.local` and set `XAI_API_KEY`. Optional `MORTANG_DB_PATH` overrides the SQLite file (default `data/mortang.db`, gitignored). Tests should set `MORTANG_DB_PATH` to a temp file and call `resetDbForTests()` when they open the db.

`src/app/layout.tsx` is `force-dynamic`. `next.config.ts` marks `better-sqlite3` as a server external package.

## Hard constraints

- Browser talks only to local API routes / server actions. Keys stay on the server.
- Grok key is `process.env.XAI_API_KEY` only. Never store it in SQLite. Custom-provider keys may live in settings.
- Automated tests mock the adapter (`complete`). No live model calls.
- One household. Week is Monday–Sunday (`mondayOf` in `src/lib/week.ts`). Week slots are `breakfast | lunch | dinner` (21 cells). Library recipes may also be `side` or `dessert`.
- At most one plan has `isCurrent = 1`.
- Last good plan / meal / extra is never replaced by a failed generate, swap, extra, import, or library generate. Failed library generate writes no drafts.
- Ingredient `quantity` is a **string** (`"1"`, `"1/2"`, `"1/4"`). Never a number. Never `0` for a used ingredient.
- Duplicate = normalized title match only (`src/meals/duplicates.ts`: lowercase, strip non-alphanumerics, collapse spaces). No fuzzy matching.
- Allergen = case-insensitive substring of an ingredient **name** (`src/meals/allergen.ts`).
- Generate, swap, extra, and library generate retry **once** on transport / invalid JSON / schema / allergen / duplicate. Then keep the previous data.
- AI traces: always record, keep last 25, redact `Bearer` tokens and `api_key=` values. Developer nav is hidden unless Settings → developer tools is on.
- Visual language lives in `src/app/globals.css` (olive / linen / paper). Match existing components; do not invent a parallel design system.

## Architecture

```
UI (server pages + client components)
    │  fetch / server actions
    ▼
HTTP handlers
    src/ai/http.ts        generate, swap, extra, library generate, settings, traces
    src/meals/http.ts     library, place, pin, import, update, delete, extra delete, drafts, stars
    │
    ├── domain (pure, easy to test)
    │     brief, schema, allergen, duplicates, extras, shopping-list, slot-mask, catalog
    ├── repos (SQLite)
    │     household, kitchen, prefs, meals, settings, traces
    └── adapter
          src/ai/adapter.ts  → xAI / custom OpenAI-compatible endpoint
```

Shared types: `src/lib/types.ts`. Drizzle tables: `src/lib/schema.ts`. Schema bootstrap + additive columns: `src/lib/db.ts` (`ensureSchema` + `ensureColumn`). There are no foreign keys.

Thin `src/app/api/*/route.ts` files parse JSON and call a handler. Keep logic in the handler modules so tests can call them without Next.

## Screens

| Route | Role |
| --- | --- |
| `/setup` | First-run wizard: household → kitchen checklist → slot mask. Redirect target when there is no household or no named people. |
| `/` This Week | Home. Week switcher, slot picker (cells to fill), fill-empty-slots from the library, takeout, leftovers, week grid, recipe flyout, library flyout. `?plan=` opens a historical plan. |
| `/meals` | Library: generate drafts (batch or one recipe), approve/reject queue, then search / filter / group, import-from-URL, add-recipe. Catalog is unique by title. Saved meals can be rated 1–5 stars. |
| `/meals/new` | Type a recipe into the library (same editor as `/meals/[id]`, create mode). |
| `/meals/[id]` | Full recipe editor (title, why, time, method, ingredients, steps). Swap only if the meal is on the current plan. |
| `/shopping-list` | Derived list for the open plan (`?plan=` supported). Not stored. |
| `/household` | People, leftovers of diet style/notes/servings. |
| `/kitchen` | Cook prefs + appliance/method checklist. |
| `/settings` | Provider mode, base URL, model, optional custom key, web search toggle, developer tools. |
| `/developer` | Last 25 AI traces. Hidden unless the toggle is on. |

Nav: This Week, Meals, Shopping list, Household, Kitchen, Settings, optional Developer (`src/components/nav.tsx`).

Generation UX is global (`GenerationProvider` in `AppShell`): NDJSON stream in the tab. A compact chip in the sticky nav shows progress (spinner, percent, elapsed, Cancel). Hover the chip for steps and the current message; click it to pin the panel (required for failure details). No blocking modal. Refresh or closing the tab aborts the fetch. One job at a time.

## Data model

**Household** — one row. Name, `dietStyle` (legacy / fallback), notes, servings, people.

**Person** — name, age, optional sex, allergies (hard exclude), avoidances (soft prefer-to-skip). Blank-name people are dropped on save (`normalizePeople`).

**Kitchen item** — appliance or method. Built-ins in `src/kitchen/defaults.ts` (crockpot, air fryer, Instant Pot, oven, stovetop, sheet pan, grill). Only `enabled` items go into the brief. Seeded on first generate if empty.

**Kitchen prefs** — one row (`id = default`). Expertise `newbie | novice | intermediate | expert`, involved `low | medium | high`, `maxCookMinutes` (floor 5, default 45), `overallDiet`, plus per-slot diets. Slot diet resolution (`resolvedDiet`): slot field → overall kitchen diet → household `dietStyle`. Generate is allowed if **either** household diet **or** kitchen overall diet is non-empty.

**Week plan** — `weekStart` (Monday `YYYY-MM-DD`), `isCurrent`, `slotMask` JSON. History stays readable from This Week / shopping list.

**Meal** — belongs to a plan **or** stands alone. Fields: day, slot, title, whyItFits, cookMinutes, method, ingredients[], steps[], `usedWebSearch`, `pinned`, `weekStart`, `createdAt`, optional `sourceUrl`, `extras`, `draft` (0/1), `stars` (0–5, 0 = unrated). Imported and typed meals are saved with `planId = ""`. Library generate writes `draft = 1` until approve. Deleting a plan deletes the plan row only; meals stay so the library keeps the recipes. `listAllMeals` / `listLibraryMeals` / place exclude drafts.

**Library generate prefs** — one row (`id = default`) of JSON for the Meals generate form (mode, people, per-slot on/count/diet/avoidances). Not used as an AI input.

**Meal extra** — nested on a lunch or dinner (`extras_json`). At most one `side` and one `dessert`. Each is a **suggestion** (title only) or a **recipe** (full ingredients/steps). Breakfast never has extras. Added on the card after the meal exists; week generate does not fill them. A generated extra **recipe** is also saved as a standalone library meal (`slot` `side` or `dessert`). You can attach an existing library side/dessert with `POST /api/place-extra`. Suggestions are not library meals.

**UseIngredient** — `{ name, day, slot }`. Session-only (`sessionStorage` key `mortang.useIngredients`). Instructs generate/swap that that slot must feature that ingredient. Cleared after a successful generate.

**Slot mask** — which of the 21 cells are requested. Default: all dinners on (`defaultSlotMask`). Also session-backed (`mortang.slotMask`). Pinned slots are treated as locked in the picker (`maskMinusPinned`, `toggleSlot` / `toggleDay` / `toggleMealRow`).

**Settings** — `mode: grok | custom`, `baseUrl` (default `https://api.x.ai/v1`), `model` (default `grok-4.6`), optional `customApiKey`, `developerTools`, `webSearch`. API responses expose `customApiKey` as a boolean only.

**AI trace** — kind `generate | generate-retry | swap | swap-retry | extra | extra-retry | library | library-retry | test`, request/response text, validation `ok | invalid-json | schema | allergen | duplicate | transport`. Import is **not** traced today.

## Core flows

### This Week (library planner)

This Week **does not** call the model. Empty cell → library flyout (`POST /api/place`) or **Takeout** (`POST /api/takeout`). **Leftovers** copies a cooked cell onto another (`POST /api/leftover`, shopping list skips leftover and takeout rows). **Fill empty slots** (`POST /api/fill`) picks from the saved library: slot match, allergen skip, unique titles unless allow-repeats, protein cap per breakfast/lunch/dinner row (default 2, from ingredient names), leftover-lunches optional. Pins lock a cell against fill. Week switcher (`POST /api/plans/open`) is one plan per Monday; edits save immediately.

### Generate

1. UI requires named people and a diet (household or kitchen overall). Slot picker must have at least one unpinned cell on.
2. `GenerateButton` sends the mask **already minus pinned slots**, plus `useIngredients`, plus optional `weekStart`.
3. `handleGenerate` (`src/ai/http.ts`) re-strips pinned slots. If nothing remains: `"Everything you asked for is pinned."` Use-ingredients aimed at pinned slots are dropped. Reserved titles = pinned meal titles.
4. `generateWeekPlan` builds a brief (`buildHouseholdBrief`) + hard rules + optional web-search rules + cook-time cap. Asks only for the effective slots. Validates: JSON → Zod meal schema → exact slot set → allergens → no duplicate titles inside the batch **or** vs reserved titles. One retry, then fail. Progress phases: `brief → calling → validating → [retry] → saving`.
5. On success, `mergeGeneratedPlan`:
   - No current plan → `saveGeneratedPlan` (new current row).
   - Else update that plan’s slot mask and replace **unpinned** occupants only. Pinned rows are left untouched (extras included). New meals get new ids and empty extras.
6. Generate **always writes the current plan**, even if the user is viewing `?plan=` history. `weekStart` from the request is used only when creating the first plan.

Do not revive “save a brand-new plan on every generate.” Pins and the library depend on merge.

### Library generate

Meals tab, not This Week. `LibraryGenerateForm` at the top of `/meals` → Drafts queue → Add recipe / Import → saved catalog.

Two modes, XOR: **Batch** (per-slot on, count 1–12, diet, extra avoidances) or **One recipe** (`I need a recipe for…` plus that slot’s diet/avoidances). Cap 24 recipes per batch. People checkboxes required; selected people’s **allergies stay hard**. Form diet and avoidances **override** Household/Kitchen diet, per-slot kitchen diets, and people’s household avoidances for that run. Form avoidances are hard excludes (same allergen substring check). Kitchen appliances, expertise, involved, and `maxCookMinutes` still apply. `buildHouseholdBrief({ forLibrary: true })`.

`POST /api/library/generate` NDJSON stream (`kind: library`). Dummy `day: monday`. Duplicates vs saved library titles **and** existing drafts. One retry, then fail with no writes. Success: `saveDraftMeals`. Approve `POST /api/library/approve` sets `draft = 0`. Reject `POST /api/library/reject` deletes the row. Stars `POST /api/library/rate` `{ mealId, stars: 0–5 }` on saved meals only; click the current star to clear to 0. Stars are not an AI input.

Prefs: `GET/PUT /api/library/prefs`.

### Swap

`POST /api/swap` `{ planId, mealId, useIngredients?, prompt? }`. Same brief, but only the use-ingredient for that day/slot, plus a do-not-repeat list of the current title and every other title on that plan. Optional `prompt` (trimmed, max 200) is a free-text steer such as “made on the grill”; empty/omitted is today’s unprompted regen. Prompt is not schema-enforced. Response is `{ meal: ... }`. `replaceMeal` keeps the same meal id, `pinned`, `createdAt`, `weekStart`, and **extras**. `sourceUrl` comes from the new meal (http(s) only; otherwise null). Failure leaves the card as-is.

Swap is not streamed. `SwapButton` (card, flyout, full recipe) opens a popover: type an optional note, then confirm. `router.refresh()` after success.

### Pin

`POST /api/pin` `{ pinned, mealId }` or `{ pinned, planId }` (exactly one id). Pinned meals survive generate. The slot picker locks those cells. Pin/replace/use-ingredient UI is only offered when the open plan is current (`editable = !plan || plan.isCurrent`).

### Place from library

Empty or filled cell on the current week opens `MealLibraryFlyout` → `GET /api/library?slot=` (unique titles for that slot, newest week first) → `POST /api/place` `{ sourceMealId, day, slot, weekStart? }`. Copies recipe fields onto the current plan (creates an empty current plan if none). If a meal already occupies the cell, that row is overwritten and its pin flag is kept. Extras are **not** copied from the source and are cleared on the occupant.

### Import from URL

Meals page form → `POST /api/import` NDJSON stream. Always uses the Grok adapter **with web search on**, regardless of Settings mode. Model reads the page and returns one meal. Saved via `saveImportedMeal` (`planId ""`, `sourceUrl` set, `usedWebSearch true`). Not placed on the week until the user places it.

### Manual recipe

Meals → Add recipe → `/meals/new` → `POST /api/create`. Same fields as edit plus a slot. Saved via `saveStandaloneMeal` (`planId ""`, no `sourceUrl`, `usedWebSearch false`). Not placed on the week until the user places it.

### Edit / delete

`POST /api/update` uses `mealEditSchema` (no day/slot). `POST /api/delete` `{ mealId }` removes the row. `POST /api/plans/delete` `{ planId }` removes the plan, keeps meals.

### Sides and desserts

Lunch and dinner cards on the **current** plan can add one side and one dessert after the meal exists. Toggle **Suggestion** (default) vs **Recipe**, then Add, or **Choose a past side/dessert**. Suggestion shows as text (`Side · Baked potato`) plus **Get recipe**. Recipe title is clickable and opens the existing flyout (`canSwap` off; “Open full recipe” on, because extra recipes are library meals). `POST /api/extra` `{ mealId, kind, mode }` is swap-shaped (not streamed). Recipe extras are saved with `saveStandaloneMeal`. `POST /api/place-extra` `{ sourceMealId, mealId, kind }` copies a library recipe onto the parent. Upgrade a suggestion with `mode: "recipe"` (keeps the title, then saves). `DELETE /api/extra` `{ mealId, kind }` clears that extra from the card, not the library. Breakfast, historical plans, and a slot that already has that extra (except suggestion → recipe) return 400. Generate that replaces an unpinned occupant drops extras (new meal row). Pinned occupants keep extras. Typed create and import accept `side` / `dessert` in the meal dropdown.

### Shopping list

`mergeShoppingList` (`src/meals/shopping-list.ts`) from the **open** plan’s meals **plus recipe extras**. Suggestions add nothing. Normalize names (lowercase, naive English plural strip). Merge quantities when name + unit match and both quantities parse (`1`, `1/2`, `1 1/2`, decimals). Non-numeric quantities do not merge. Group by aisle: produce, meat, dairy, pantry, other.

## AI adapter

`src/ai/adapter.ts` → `createAdapter(settings)`.

| Mode | Key | Protocol |
| --- | --- | --- |
| `grok` + `webSearch` | `XAI_API_KEY` | `client.responses.create` with `tools: [{ type: "web_search" }]` and `text.format = json_schema` |
| `grok` without search | `XAI_API_KEY` | `chat.completions` + `response_format.json_schema` (strict) |
| `custom` | optional `customApiKey` | `chat.completions` + `response_format.json_object`; we still Zod-parse |

`grokWebSearchEnabled` is `mode === "grok" && webSearch`. Web search is a Grok-only setting. Meals found that way get `usedWebSearch` and a star badge.

JSON shapes (`src/meals/schema.ts`): generate `{ meals: Meal[] }`, swap/import `{ meal: Meal }`, extra suggestion `{ title }`, extra recipe `{ title, whyItFits, cookMinutes, method, ingredients, steps, sourceUrl }`. Each meal: `day`, `slot`, `title`, `whyItFits`, `cookMinutes`, `method`, `ingredients[]` (`name`, `quantity` string, `unit`, `aisle`), `steps[]`, `sourceUrl` (`string | null`). Generate/swap/extra-recipe persist `sourceUrl` only when web search is on and the value is a real `http(s)` URL; otherwise it is stored as null. Import still stores the URL the user typed. Extra recipes do not count against parent `maxCookMinutes`.

Brief (`src/household/brief.ts`) includes people, diet, notes, allergies, avoidances, enabled kitchen items, expertise/involved/time, per-slot diets, requested slots, use-ingredients, servings, extra rules (do-not-repeat).

## Module map

| Path | Responsibility |
| --- | --- |
| `src/lib/types.ts` | Domain types and constants (`DAYS`, `SLOTS`, `AISLES`) |
| `src/lib/db.ts` | Open SQLite, create/alter tables, test reset |
| `src/lib/schema.ts` | Drizzle table defs |
| `src/lib/slot-mask.ts` | Mask helpers + session persistence |
| `src/lib/use-ingredients.ts` | Session persistence for assigned ingredients |
| `src/lib/generate-progress.ts` | Progress % / step labels for generate, import, and library |
| `src/lib/week.ts` | `mondayOf` |
| `src/household/*` | Household repo, brief, people normalize |
| `src/kitchen/*` | Items repo, prefs repo, built-in defaults |
| `src/meals/schema.ts` | Zod + JSON Schema for model output |
| `src/meals/repo.ts` | Plans and meals persistence (merge, place, pin, library, import, typed create, drafts, stars) |
| `src/meals/http.ts` | Library / pin / place / import / create / update / delete / draft approve-reject / rate handlers |
| `src/meals/catalog.ts` | Search / filter / group for `/meals` |
| `src/meals/{allergen,duplicates,extras,shopping-list}.ts` | Pure validators / extras parse / list merge |
| `src/ai/adapter.ts` | Provider client |
| `src/ai/generate-plan.ts` | Generate loop + validation |
| `src/ai/generate-library.ts` | Library batch / one-recipe loop + validation |
| `src/ai/swap-meal.ts` | Swap loop + validation |
| `src/ai/generate-extra.ts` | Side/dessert suggestion or recipe loop |
| `src/ai/http.ts` | Generate / swap / extra / library generate / settings / traces handlers |
| `src/meals/library-prefs.ts` | Meals generate-form JSON prefs |
| `src/ai/settings-repo.ts` | Settings row |
| `src/ai/traces.ts` | Trace log |
| `src/components/this-week-planner.tsx` | This Week client orchestrator |
| `src/components/generation-provider.tsx` | Shared generate/import/library stream client |
| `src/components/generation-status.tsx` | Nav chip + expandable steps for the in-tab job |
| `src/components/meals-catalog.tsx` | Library UI: generate form, draft queue, catalog, stars |
| `src/components/meal-detail.tsx` | Recipe editor |
| `src/app/api/smoke.test.ts` | HTTP-level smoke tests with a fake adapter |

## API

All mutating meal/AI routes are `POST` JSON unless noted. Generate, import, and library generate respond with `application/x-ndjson` (`{type:progress|done|error}` lines).

| Route | Handler |
| --- | --- |
| `POST /api/generate` | `handleGenerate` — stream |
| `POST /api/swap` | `handleSwap` |
| `POST /api/extra` | `handleGenerateExtra` |
| `DELETE /api/extra` | `handleDeleteExtra` |
| `POST /api/place-extra` | `handlePlaceExtra` |
| `POST /api/import` | `handleImportRecipe` — stream |
| `POST /api/library/generate` | `handleGenerateLibrary` — stream, writes drafts |
| `POST /api/library/approve` | `handleApproveDraft` |
| `POST /api/library/reject` | `handleRejectDraft` |
| `POST /api/library/rate` | `handleRateMeal` — `{ mealId, stars: 0–5 }` |
| `GET/PUT /api/library/prefs` | generate-form JSON blob |
| `POST /api/create` | `handleCreateMeal` — typed library meal |
| `GET /api/library?slot=` | `handleListLibrary` — `breakfast \| lunch \| dinner \| side \| dessert` (no drafts) |
| `POST /api/place` | `handlePlaceMeal` |
| `POST /api/pin` | `handlePin` |
| `POST /api/update` | `handleUpdateMeal` |
| `POST /api/delete` | `handleDeleteMeal` |
| `POST /api/plans/delete` | `handleDeletePlan` |
| `GET/PUT /api/settings` | settings (PUT body is a patch; key never echoed) |
| `POST /api/settings/test` | tiny `pong` call + `test` trace |
| `GET/DELETE /api/traces` | list / clear |

Household and kitchen writes are server actions (`src/app/household/actions.ts`, `src/app/kitchen/actions.ts`), not REST.

## UI behavior worth keeping

- Desktop This Week is a 7-column grid (days as columns, B/L/D as rows). Narrow viewports stack by day. Empty cells are dashed; on the current plan they open the library flyout.
- Recipe cards are a flyout, not a navigation, except “Open full recipe”.
- Star badge = web search. Arrow badge = stored `sourceUrl` (import or a cited generate/swap). “Source recipe” in the flyout and full recipe is the clickable link.
- Historical plans are view-only for pin/place/use-ingredient/add-extra. Recipe extras stay clickable. Generate still targets the current plan.
- Lunch/dinner cards show side and dessert lines. Only a full extra recipe is a flyout control.
- Session slot mask, slot-picker open/closed, and use-ingredients survive in-tab navigation. On This Week the slot picker collapses to a summary when a plan exists (or after the user collapses it); setup wizard keeps the full table.

## How to change things

- New generate/swap constraint → brief line and/or Zod + the retry loop. Add a unit test next to the domain function. Do not put prompt-only rules that the server cannot enforce if they matter (allergies, slots, duplicates, cook time if you start enforcing it).
- New meal field → types, drizzle table + `ensureColumn`, `mealInsertValues` / `mapMeal`, Zod + JSON Schema, UI.
- New API → handler in `src/ai/http.ts` or `src/meals/http.ts`, thin route file, test in `src/app/api/smoke.test.ts` or a focused `*.test.ts`.
- New screen → `src/app/.../page.tsx`, add a nav link if it is first-class, keep the olive/linen styles.
- AI provider changes → `adapter.ts` only if possible. Keep `complete({ messages, jsonSchema, schemaName, signal })` so tests stay fakeable.

Cook time is currently a **prompt** rule (`Keep cookMinutes at or under N`). It is not rejected in validation. Slot diets and expertise/involved are prompt-only too. Allergies, requested slots, and duplicate titles are enforced.

## Testing

`npm test`. Prefer extending existing tests over new runners.

- Domain: `src/**/*.test.ts` next to the module.
- UI: `*.test.tsx` with happy-dom.
- HTTP: `src/app/api/smoke.test.ts` and `src/meals/http.import.test.ts` inject `deps.complete`.

When you add a generate/swap/import/library validation path, cover the retry-then-fail case and assert the previous plan/meal is unchanged (library: no drafts written).

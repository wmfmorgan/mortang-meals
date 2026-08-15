# Mortang Meals — AI Household Meal Planner

> **Stale.** This is the original 2026-08-12 v1 design. The running app has since added a meal library, URL import, pins + merge-on-generate, kitchen cooking prefs, and assigned ingredients. For current behavior, read [`AGENTS.md`](../../../AGENTS.md).

Date: 2026-08-12  
Status: Historical — superseded by the running app  
Stack: Next.js (App Router) + SQLite (Drizzle) + OpenAI-compatible AI adapter

## Goal

A locally hosted web app that turns a household profile into a week of meals, full recipes, and a shopping list. The plan can be saved, a single meal can be swapped, and the shopping list always reflects the current plan.

Success for v1: you can set up one household, generate a week, cook from a recipe card, swap a meal you don’t want, and shop from a merged list.

## Non-goals (v1)

- Multiple households, accounts, or login
- Pantry / leftover / inventory tracking
- Nutrition macros, calories, or cost estimates
- Multi-week or rolling calendars
- Per-person plates or conflicting household diets
- Recipe photos, import from the web, or a recipe database
- Deploying to Netlify / hosted Supabase
- Live model calls in automated tests

## Architecture

One Next.js app, started with `npm run dev`, opened at `localhost`. The browser never calls an AI provider. API routes on the server hold `XAI_API_KEY` and any local endpoint config.

SQLite file on disk (project `data/` directory), accessed with Drizzle. One household, no auth.

AI is a thin OpenAI-compatible adapter:

- Default: `https://api.x.ai/v1`, `XAI_API_KEY`, current Grok model (confirm at implement time against https://docs.x.ai)
- Override in Settings: base URL + model name for Ollama, LM Studio, or any OpenAI-compatible server
- Local endpoints may be keyless. Settings may store an optional custom API key for non-Grok providers that require one. That key is read only on the server.

App modules:

| Module | Responsibility |
| --- | --- |
| Household | People, shared diet, per-person allergies and avoidances |
| Kitchen | Appliances and cooking methods to prefer |
| Schedule | 7-day breakfast / lunch / dinner slot mask |
| Planner | Generate, save, swap one meal, derive shopping list |
| AI | Provider adapter, brief builder, JSON schema, validation, request/response log |

## Data model

### Household

One row.

- Name
- Shared diet style (free text, e.g. “high-protein Mediterranean”)
- Optional notes, folded into the AI brief
- Servings: integer, defaults to the count of people

### Person

Belongs to the household.

- Name
- Age
- Optional sex
- Allergies: hard exclusions, never allowed in a saved meal
- Avoidances: soft preferences, “prefer to skip”

The generated brief looks like: “A 53-year-old man and a 53-year-old woman, focusing on a high-protein Mediterranean diet. Never use shellfish (Alex). Prefer to avoid cilantro (Sam).”

### Kitchen item

Checklist of appliances and methods. Built-in set includes crockpot, sheet pan, air fryer, stovetop, oven, grill, Instant Pot. Custom items allowed. Only checked items are sent to the AI as preferred methods.

### Week plan

- Week start date (Monday of that week)
- `isCurrent`: at most one plan is current
- Slot mask: which of the 21 breakfast/lunch/dinner cells are on

A plan is written only after a successful generate. That new plan becomes current. If that week already had a current plan, the old one stays in history (`isCurrent` false). Previous plans can be reopened from This Week.

### Meal

One row per filled slot.

- Day of week
- Slot: breakfast | lunch | dinner
- Title
- Short “why it fits”
- Cook time (minutes)
- Method / appliance
- Recipe: ingredients and steps, stored on the meal

Clicking a card reads this row. It does not call AI.

### Ingredient (on a meal)

- Name
- Quantity (number)
- Unit
- Aisle: produce | meat | dairy | pantry | other

### Shopping list

Not stored as an authored document. Derived from the **open** plan (the week on screen, usually the current plan):

- Normalize names (case, simple plurals)
- Merge quantities when name + unit match
- Group by aisle

Swap rebuilds the list from the whole plan.

### Settings row

Stored with provider config:

- `developerTools`: boolean, default off. When on, the Developer screen appears in nav.

### AI trace

One row per provider call (including the automatic retry). Always recorded, last 25 kept, oldest deleted. Used by the Developer screen.

- Timestamp
- Kind: `generate` | `generate-retry` | `swap` | `swap-retry` | `test`
- Provider mode, base URL, model
- Request: system brief + user payload (the text we sent). No API keys, no `Authorization` header
- Response: raw body text, or the error string if the call failed
- Validation: `ok` | `invalid-json` | `schema` | `allergen` | `duplicate` | `transport`

## Screens

Seven screens. Desktop **This Week** is a 7-column calendar (days as columns, breakfast / lunch / dinner as rows). Empty slots are dashed and not generated. Narrow viewports stack into an agenda (day sections with up to three cards).

1. **This Week** — home. Week picker (by start date) to open the current plan or a saved one, week grid, generate / regenerate, swap, link to shopping list. Generating for a week that already has a plan creates a new current version; the previous version stays available in the picker.
2. **Recipe** — from a card. Title, servings, time, method, ingredients, steps.
3. **Shopping list** — merged, aisle-grouped list for the open plan.
4. **Household** — diet style, notes, people, per-person allergies and avoidances, servings.
5. **Kitchen** — appliances and methods checklist.
6. **Settings** — provider mode (Grok vs custom), base URL, model, optional custom API key, test-connection action, **Developer tools** toggle.
7. **Developer** — hidden unless the toggle is on. Read-only log of the last 25 AI calls. Each row expands to show the prompt we sent, the raw response (or transport error), model, kind, and validation result. A “Clear log” action empties traces. This is not a chat UI; you cannot edit and resend from here.

First launch: Household → Kitchen → slot grid → Generate. After setup, the default landing screen is This Week. The Developer item is absent until the toggle is turned on.

## Data flow

### Generate

1. User has household, at least one person, a diet style, and at least one slot on.
2. Server builds a brief from household + people + kitchen + slot mask + servings.
3. Adapter requests structured JSON for only those slots.
4. Server validates schema, then runs the allergen checker against every ingredient.
5. On failure: retry once, including the validation error in the follow-up.
6. On success: persist plan + meals, mark current, derive shopping list.
7. UI renders the week calendar from saved meals.

### Swap

1. User clicks Swap on a card.
2. Server sends the same brief, the slot to fill, and a **do-not-repeat list**: normalized titles of every other meal in the open plan, plus the meal being replaced.
3. Adapter returns one meal JSON.
4. Validate schema → allergen check → **duplicate check**. A meal is a duplicate if its normalized title matches any title on the do-not-repeat list (lowercase, strip punctuation, collapse whitespace). Near-misses like “Lemon herb salmon” vs “Herb lemon salmon” are treated as duplicates only when the normalized strings match; v1 does not do fuzzy recipe matching.
5. On any of those failures: retry once, including the validation error and the do-not-repeat list.
6. If the retry is still a duplicate or otherwise invalid: leave the original card in place and show “couldn’t find a different meal, try again.”
7. On success: replace that meal only. Rebuild the shopping list. Leave other cards untouched.

Generate uses the same duplicate rule inside a single plan: two slots in one response may not share a normalized title. If they do, the whole generate is invalid and follows the one-retry path.

### Settings

Read/write provider config in SQLite (mode, base URL, model, optional custom key, `developerTools`). Grok key comes from `XAI_API_KEY` in the environment, never from the browser bundle or the database. Test connection pings the configured endpoint with a tiny request and writes a `test` trace like any other call.

Every adapter call (generate, swap, retry, test) writes an AI trace before the UI is updated. Recording does not depend on the toggle, so you can turn Developer tools on after a failed generate and still see what was sent and returned.

## AI contract

There is no chat UI. The only AI traffic is a server-side HTTP request to an OpenAI-compatible endpoint (`/v1/chat/completions` or `/v1/responses`). Prompts and raw responses are visible only on the Developer screen when the Settings toggle is on.

**Request:** a system brief (household, slots, do-not-repeat list, hard rules) plus a **JSON Schema**. On Grok we use structured outputs: `response_format.type = "json_schema"` so the model is constrained to that schema ([xAI structured outputs](https://docs.x.ai/developers/model-capabilities/text/structured-outputs)). Local OpenAI-compatible servers that do not support `json_schema` get `json_object` (or a “JSON only” prompt) and we still parse + validate on our side.

**Response:** a single JSON object. Generate returns `{ "meals": [ ... ] }`. Swap returns `{ "meal": { ... } }`. We parse it with Zod. Markdown, prose, or extra keys are invalid.

Each meal includes: `day`, `slot`, `title`, `whyItFits`, `cookMinutes`, `method`, `ingredients[]` (`name`, `quantity`, `unit`, `aisle`), `steps[]`.

Hard rules in the prompt and in server validation:

- Fill only requested slots
- Servings equal household servings
- Prefer checked appliances / methods
- No allergy ingredients (reject if present)
- Honor avoidances as soft constraints
- Valid JSON, no markdown wrapper
- No two meals in a plan share a normalized title
- A swapped meal must not match the replaced title or any other title in the open plan

Default provider is Grok via SpaceXAI / xAI (`XAI_API_KEY`, `https://api.x.ai/v1`). Model name is confirmed from live docs at implementation time, not hardcoded from memory.

## Error handling

The last good plan is never replaced by a partial or invalid result.

| Condition | Behavior |
| --- | --- |
| No people, no diet style, or no slots | Generate disabled; message says what is missing |
| Missing `XAI_API_KEY` (Grok) or custom URL unreachable | Settings error; Test connection fails clearly |
| Timeout / network | “The model didn’t respond”; plan unchanged |
| Invalid JSON / schema | One retry; then “couldn’t get a usable plan, try again” |
| Allergy ingredient in output | Treat as invalid; same retry; do not save |
| Swap or generate returns a duplicate title | Treat as invalid; retry once with the do-not-repeat list; keep the last good meal |
| Local model too weak | Same validation; message suggests switching to Grok |
| SQLite file unreadable | Launch error, not a blank screen |
| Swap failure | Original card remains |

## Testing

No live provider calls in automated tests. The adapter is mocked.

- Shopping list merge/normalize from fixture recipes
- Brief builder snapshot from a fixture household
- Allergen checker rejects a fixture meal that contains a listed allergy
- Duplicate checker rejects a swap whose normalized title matches the replaced meal or another meal in the plan
- Schema accept/reject fixtures; invalid JSON is not persisted
- Adapter: success, timeout, bad JSON, retry-then-fail for generate and swap
- Smoke: seed household → mock generate → cards present → recipe reads storage → swap one slot → list rebuilds
- AI traces: a mocked generate writes a redacted trace; API keys never appear in stored request text; Developer screen is omitted from nav when the toggle is off

## Implementation notes

- Keep API keys server-side only; redact them from AI traces
- Confirm current Grok model and SDK usage from https://docs.x.ai before wiring the adapter
- Prefer xAI structured outputs (`json_schema`) via the OpenAI-compatible SDK; fall back to parse-and-validate for local models
- Add `.superpowers/` to `.gitignore` (brainstorm companion output)
- One command to run: `npm run dev`

# Mortang Meals — backlog

Living product backlog. Pick one item, write a spec, then implement. Do not treat this file as an implementation plan.

`docs/superpowers/` is the stale 2026-08-12 v1 design. Current behavior lives in [`AGENTS.md`](../AGENTS.md). Prefer this file for what to build next.

**Status:** `later` | `next` | `doing` | `done`

---

## Order

Suggested build order by leverage, not original request numbering.

| # | Item | Size | Status |
|---|---|---|---|
| 1 | Collapsible slots to generate | S | next |
| 2 | Prompted meal refresh | M | later |
| 3 | Manual recipe input | M | later |
| 4 | AI source links | M | later |
| 5 | Animated progress icon | S | later |
| 6 | Sides and desserts | L | later |

Items 1–5 can ship independently. Item 6 needs its own spec before any code.

---

## 1. Collapsible slots to generate

**Status:** next
**Size:** S
**Request:** The "Slots to generate" picker should be collapsible.

### Problem

This Week always shows the full 21-cell slot table above the week grid. After the user has a mask they like (and it persists in `sessionStorage`), the table is mostly noise.

### Current state

- `src/components/slot-picker.tsx` is always expanded.
- Mask lives in session (`mortang.slotMask`) via `src/lib/slot-mask.ts`.
- Pinned meals lock cells; generate strips those slots again on the server.

### Likely shape

A collapsed header that still shows a one-line summary (e.g. "7 dinners" or "Mon–Fri dinner, Sat lunch"). Expanded state is the current table. Persist collapsed/open in session so it survives in-tab navigation, same as the mask.

Default: collapsed when a current plan already exists; open on first visit / empty week. Confirm in the spec.

### Out of scope

Changing which slots exist, the mask data model, or generate behavior.

### Open questions

- Persist with `sessionStorage` (this tab, including reload) or `localStorage` (every visit)?
- What does the collapsed summary say when the selection is irregular?

---

## 2. Prompted meal refresh

**Status:** later
**Size:** M
**Request:** Refresh and customize a single meal card — e.g. "give me a dinner I make on the grill" or "give me a lamb-based meal."

### Problem

Swap exists but is unprompted. The regen button asks the model for a different title in the same slot. The only per-slot steer today is `useIngredients` ("this slot must feature X"), which is narrower than a free-text request.

### Current state

- `SwapButton` in `src/components/meal-card.tsx` POSTs `{ planId, mealId, useIngredients }` to `/api/swap`.
- `swapMeal` (`src/ai/swap-meal.ts`) uses the household brief, one use-ingredient for that day/slot, and a do-not-repeat list. No user prompt field.
- Failure leaves the card as-is. One retry. Same meal id, pin, `createdAt`, `sourceUrl`, `weekStart`.
- Swap is offered only on the current plan (`editable = !plan || plan.isCurrent`).

### Likely shape

Add an optional constraint string to swap (flyout + full recipe). Empty constraint = today's regen. Non-empty goes into the brief / user message. Keep allergen, slot, and duplicate checks. Still one retry, still keep the previous meal on failure.

### Out of scope

Replacing generate, changing the slot mask, or treating the prompt as a new meal kind.

### Open questions

- Prompt-only, or also a few chips (grill, air fryer, lamb, vegetarian) that fill the field?
- Does a prompted swap clear or keep the slot's use-ingredient?
- Surface this on the week-grid card, or only in the flyout / full recipe?

---

## 3. Manual recipe input

**Status:** later
**Size:** M
**Request:** Let the user type in a recipe instead of generating or importing it.

### Problem

The library is AI-generated or URL-imported. There is no "I already know this recipe" path.

### Current state

- `/meals` has an import-from-URL form only (`src/components/meals-catalog.tsx`).
- `/meals/[id]` can edit an existing meal (`mealEditSchema` → `POST /api/update`).
- Imported meals use `saveImportedMeal` with `planId = ""` and a `sourceUrl`.
- There is no create-empty or create-from-form handler.

### Likely shape

A "Add recipe" form on `/meals` (or a small `/meals/new` page) that reuses the meal-detail fields: title, why, time, method, ingredients, steps, slot. Save as a standalone library meal (`planId ""`), no `sourceUrl` unless the user pastes one. Place onto the week with the existing library flyout.

### Out of scope

OCR, photo import, or parsing a pasted blob on v1 of this item. Editing existing meals already works.

### Open questions

- Save to the library only, or also "save and place on this week"?
- Required fields: same as `mealEditSchema` (everything required), or looser for handwritten recipes?

---

## 4. AI source links

**Status:** later
**Size:** M
**Request:** Have AI return links to source recipes/meals and store them.

### Problem

Web-search meals get a star badge (`usedWebSearch`) but no URL. Only URL-import sets `sourceUrl`. The flyout and full recipe already know how to show a source link.

### Current state

- `Meal.sourceUrl` is `string | null`. Column exists. Place/swap/pin preserve it.
- Generate and swap JSON (`src/meals/schema.ts`) do not include `sourceUrl`.
- Import always uses Grok + web search and stores the page URL the user typed, not a model-chosen link.
- Import is not traced today.

### Likely shape

Add optional `sourceUrl` to generate and swap model output. Persist when it is a real `http(s)` URL. Show it with the existing flyout / detail link. Keep the star for `usedWebSearch`; the link is the source, not a second badge. Import already stores the URL the user typed — do not change that.

When web search is off, the model must not invent a URL — leave `sourceUrl` null.

### Out of scope

Storing multiple sources per meal, scraping the linked page, or changing import's user-supplied URL.

### Open questions

- Require a URL when web search is on, or optional?
- Validate that the host looks like a recipe site, or accept any https URL?
- If generate returns a URL that is not a recipe, do we retry or keep the meal and drop the link?

---

## 5. Animated progress icon

**Status:** later
**Size:** S
**Request:** An animated icon on the progress modal.

### Problem

The generate/import modal is a title, elapsed time, bar, and step list. Nothing moves except the bar fill. Generate often takes long enough that a quiet animation would make the wait feel attended.

### Current state

- `src/components/generation-modal.tsx` — dialog on `/` and `/meals*`.
- Compact banner on other routes (`generation-banner.tsx`) — no icon either.
- Steps use a static check / empty mark. Visual language is olive / linen / paper in `src/app/globals.css`.

### Likely shape

One looping mark in the modal header while `status === "running"` (and maybe the banner). Match existing CSS — no new icon library, no Lottie unless a spec picks it. Pause or swap to the check on success; stop on error.

### Out of scope

Redesigning the modal, adding sound, or changing progress phases.

### Open questions

- Modal only, or banner too?
- Motif: pot / whisk / steam, or a simple olive spinner?

---

## 6. Sides and desserts

**Status:** later
**Size:** L
**Request:** Add side dishes and/or desserts.

### Problem

A slot is one meal. Dinner cannot carry a side or a dessert. Shopping list and generate only see that one recipe.

### Current state

- Slots are `breakfast | lunch | dinner` (21 cells). Hard constraint in `AGENTS.md`.
- Week grid, slot mask, generate, swap, library filter, and shopping list all assume one meal per cell.
- `method` is a free string (often the appliance), not a course.

This is a data-model change. Do not start from a prompt-only "also mention a side" rule — the server could not enforce it, and the list would not split cleanly.

### Likely shape (to decide in the spec)

Two plausible models:

1. **Extras on a meal** — optional `sides[]` / `dessert` on the dinner (or any slot). Shopping list flattens them. Swap/generate can fill or skip extras. Week grid stays 21 cells; the card shows "with slaw" / "and crisp."
2. **More slots** — add `side` / `dessert` as slot types (or per-day extras). Mask, generate, library, and grid all grow. Cleaner isolation; heavier UI.

Default lean: extras on the meal, dinners first. Confirm before planning.

### Out of scope until the spec

Changing breakfast/lunch slot meaning, multi-household, or a separate dessert library.

### Open questions

- Sides, desserts, or both in the first cut?
- Generated by default, or only when the user asks (checkbox / prompt)?
- Can a side be pinned, swapped, or placed from the library on its own?
- Do extras count against `maxCookMinutes`?

---

## How to pick up an item

1. Move it to `doing` in this file.
2. Write a spec (`docs/superpowers/specs/YYYY-MM-DD-<item>-design.md`) and get it approved.
3. Write a plan, then implement. Keep `AGENTS.md` current if behavior changes.
4. Mark the item `done` here when it ships.

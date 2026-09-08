# Mortang Meals — backlog

Living product backlog. Pick one item, write a spec, then implement. Do not treat this file as an implementation plan.

`docs/superpowers/` is the stale 2026-08-12 v1 design. Current behavior lives in [`AGENTS.md`](../AGENTS.md). Prefer this file for what to build next.

**Status:** `later` | `next` | `doing` | `done` | `cancelled`

UX items 7–17 are from the 2026-09-06 plan-and-shop audit (`ux-audit-2026-09-06-plans-and-shop/report.md`). IDs `F-01`…`F-11` are stable. Build sev 3 first.

---

## Order

Suggested build order by severity, then effort. Items 1–4 and 6 already shipped.

| # | Item | Audit | Sev | Size | Status |
|---|---|---|---|---|---|
| 1 | Collapsible slots to generate | — | — | S | done |
| 2 | Prompted meal refresh | — | — | M | done |
| 3 | Manual recipe input | — | — | M | done |
| 4 | AI source links | — | — | M | done |
| 5 | Animated progress icon | — | — | S | cancelled |
| 6 | Sides and desserts | — | — | L | done |
| 7 | Merge shopping-list duplicates | F-01 | 3 | M | done |
| 8 | Shopping-list check-off | F-02 | 3 | S | done |
| 9 | Fill vs empty grid | F-03 | 3 | M | done |
| 10 | Phone fill layout and targets | F-04 | 3 | M | done |
| 11 | One week switcher | F-05 | 2 | S | done |
| 12 | Meals page: one job at a time | F-06 | 2 | M | done |
| 13 | Trash off week chips | F-07 | 2 | S | done |
| 14 | Two-line meal titles | F-08 | 2 | S | done |
| 15 | Household/Kitchen copy matches fill | F-09 | 2 | S | done |
| 16 | Close control on recipe flyout | F-11 | 2 | S | done |
| 17 | Developer out of cook nav | F-10 | 1 | S | later |

---

## 1. Collapsible slots to generate

**Status:** done
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

**Status:** done
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

**Status:** done
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

**Status:** done
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

**Status:** cancelled
**Size:** S
**Request:** An animated icon on the progress modal.

Cancelled. Generation UX is the nav chip (`GenerationStatus`), not a modal. Do not add a spinner for its own sake.

---

## 6. Sides and desserts

**Status:** done
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

## 7. Merge shopping-list duplicates

**Status:** done
**Size:** M
**Audit:** F-01 (sev 3)
**Request:** One row per ingredient on the shopping list. Garlic and olive oil must not repeat.

### Problem

The list claims quantities combine when name and unit match. In the store the cook still sees garlic three times (1 clove / 1 small clove / 2 cloves) and extra virgin olive oil four times (tbsp vs tablespoon vs teaspoons). Peak-End: this is the last screen of plan-and-shop.

### Current state

- `mergeShoppingList` in `src/meals/shopping-list.ts` merges when normalized name + unit match and both quantities parse.
- `/shopping-list` is derived, not stored. Takeout and leftover rows are skipped.
- Subtitle on the page: “Quantities are combined when the name and unit match.”

### Likely shape

Normalize unit aliases (`tbsp` / `tablespoon`, `tsp` / `teaspoon`, `clove` / `small clove`) and obvious name variants before merge. Show one garlic line. Optional per-recipe breakdown behind a tap. Keep aisle groups (P-04).

### Out of scope

Changing aisle taxonomy, storing the list, or check-off (item 8).

### Open questions

- How aggressive is name matching? Exact normalized name only, or also “lemon juice” / “freshly squeezed lemon juice”?
- What unit does the merged line use when aliases differ?

---

## 8. Shopping-list check-off

**Status:** done
**Size:** S
**Audit:** F-02 (sev 3)
**Request:** Check items off the shopping list and keep that state for the open week. Print and share the list as a PDF.

### Problem

Every row is static name + quantity. No checkbox, strike, or packed state. A list you cannot mark is a printout. In the store the cook loses their place.

### Current state

- `/shopping-list` renders merged rows only. No client state for checks.
- Week chips already pick which plan the list is for (`?plan=`).

### Likely shape

A check control per row (and optionally per aisle). Persist for the open week (`localStorage` keyed by plan id, or a small table). Optional: hide checked items.

### Out of scope

Print/share, store layout beyond aisles, or merge (item 7).

### Open questions

- Survive reload only, or across devices (this app is local-single-process, so `localStorage` is enough)?
- Uncheck when the plan’s meals change, or leave stale checks?

---

## 9. Fill vs empty grid

**Status:** done
**Size:** M
**Audit:** F-03 (sev 3)
**Request:** Empty cells the fill mask will not fill should not dominate Plans. Fill must not look like a no-op when its slots are already placed.

### Problem

**SLOTS TO FILL 4 dinners** while those four dinners are already on the board. Breakfast and lunch are fourteen dashed cells, each with Add and Takeout at equal weight. Fill empty slots is the only filled primary button. Clicking it does nothing useful; planning breakfast means hunting among 28 ghost actions.

### Current state

- Plans (`/`) is a library planner: Add opens the flyout, Takeout, leftover, fill from catalog.
- Slot mask is the fill target (`slot-picker` accordion). Empty cells still show Add + Takeout for every B/L/D cell, mask or not.
- Fill posts `/api/fill` for the open plan. Pins lock cells. `Lock all` is unlabeled.

### Likely shape

Derive fill from empty cells the user can see, or collapse unselected meal rows. Give Add visual priority over Takeout. Disable or hide Fill when the mask is already satisfied, and say why. Spell out Lock all (pin every placed meal).

### Out of scope

Changing fill’s protein/repeat/leftover rules, or drag-and-drop.

### Open questions

- Collapse unused B/L/D rows, or keep them but quieter?
- Should turning on a slot in the mask also be the way to “I want breakfast this week”?

---

## 10. Phone fill layout and targets

**Status:** done
**Size:** M
**Audit:** F-04 (sev 3)
**Request:** On a phone, fill options stack in a readable order and pin/trash meet a 44pt target.

### Problem

Nav wraps to two rows (Developer on the second). Fill empty slots sits beside Allow repeats. Max protein / meal sits above a `2` field sandwiched between Leftover lunches and Lock all, so 2 reads as a leftover count. Pin and trash on cards are icon-only (~20 CSS px).

### Current state

- `this-week-planner.tsx` fill row and `week-grid` card actions. Mobile stacks days, not columns.
- Developer is in `nav.tsx` when Settings → developer tools is on.

### Likely shape

One fill option per row. Label the `2` as max times per protein. 44×44 pt minimum for pin, trash, and week delete. Developer out of the wrap is item 17.

### Out of scope

A separate native app, or changing fill algorithm.

### Open questions

- Keep fill options above the grid on mobile, or behind a “Fill week” sheet?

---

## 11. One week switcher

**Status:** done
**Size:** S
**Audit:** F-05 (sev 2)
**Request:** One control for which week is open. Do not put the open week’s date between the words Previous week and Next week.

### Problem

Heading date, Previous/Next that labels the *open* week, and a chip row with CURRENT. Opening the wrong week fills or shops the wrong list.

### Current state

- `week-switcher.tsx` on Plans and Shopping list. Heading also prints the open range. Chips list every saved week.

### Likely shape

Keep the heading date plus one control: either prev/next *or* a compact chip row, not both.

### Out of scope

How current vs calendar week is chosen (already: jump to this Monday if current is in the past).

---

## 12. Meals page: one job at a time

**Status:** done
**Size:** M
**Audit:** F-06 (sev 2)
**Request:** Meals should not dump generate, drafts, import, search, and the catalog on one scroll.

### Problem

Generate library shows empty breakfast/lunch/dinner/side rows even when only dessert is checked. Drafts, Add recipe, Import from URL, search, and the catalog follow. On a phone the first viewport is the form; the library is far below.

### Current state

- `meals-catalog.tsx` + `library-generate-form.tsx` + `draft-queue.tsx` on `/meals`.

### Likely shape

Collapse unchecked types. Default the page to catalog + search. Park generate/import behind “Add to library”. Keep the draft queue at the top only when drafts exist (P-05).

### Out of scope

Changing generate/approve/reject behavior.

---

## 13. Trash off week chips

**Status:** done
**Size:** S
**Audit:** F-07 (sev 2)
**Request:** Deleting a week is not a chip affordance, and never sits on the shopping-list switcher.

### Problem

Each week chip has a trash icon after the date, including CURRENT, on Plans and Shopping list. Navigation and deletion share a target.

### Current state

- Week chips in `week-switcher.tsx` call `POST /api/plans/delete`. Meals stay; the plan row goes.

### Likely shape

Move delete into an overflow on the open plan. Confirm. Do not show trash on `/shopping-list`.

### Out of scope

Changing what delete keeps (meals stay).

---

## 14. Two-line meal titles

**Status:** done
**Size:** S
**Audit:** F-08 (sev 2)
**Request:** Week-grid cards must show the dish name, not `Baked Salmon With…`.

### Problem

Desktop dinner cards clip titles so salmon, “mushr”, and “baked” are the only cues. Method and minutes are fully visible; the name is not.

### Current state

- `meal-card.tsx` / `week-grid.tsx` title line is single-line truncated.

### Likely shape

Allow two title lines, or shrink method/why before clipping the name. Front-load the distinctive words.

### Out of scope

Redesigning the card, or changing flyout titles.

---

## 15. Household/Kitchen copy matches fill

**Status:** done
**Size:** S
**Audit:** F-09 (sev 2)
**Request:** Stop telling the cook the planner “writes a week” or to set a diet “before generating.”

### Problem

Plans is a library fill. Household says “before it writes a week” / “before generating.” Kitchen says settings go into “every generate and swap.” Diet style on Household can be empty while Kitchen already has high-protein.

### Current state

- Copy in `src/app/household/page.tsx` and `src/app/kitchen/page.tsx`. Week generate still exists as `/api/generate` but is unused from Plans.

### Likely shape

Household = who you cook for. Kitchen = how you cook. Point diet at Kitchen or show the resolved diet. Drop generate-a-week language unless that flow comes back.

### Out of scope

Removing `/api/generate`, or merging Household and Kitchen into one screen.

---

## 16. Close control on recipe flyout

**Status:** done
**Size:** S
**Audit:** F-11 (sev 2)
**Request:** Recipe and side/dessert panels have a visible Close.

### Problem

The panel header is the title. No ×, Close, or Done in the frame. Overlay click may dismiss; that is not signposted.

### Current state

- `recipe-flyout.tsx` (and library flyout for Add side / Add dessert).

### Likely shape

Close in the panel header. Keep overlay-click as a bonus.

### Out of scope

Turning the flyout into a route.

---

## 17. Developer out of cook nav

**Status:** later
**Size:** S
**Audit:** F-10 (sev 1)
**Request:** Developer is not in the primary nav a cook uses to plan and shop.

### Problem

When developer tools are on, **Developer** sits after Settings on every screen. On a phone it wraps the bar onto a second row (feeds F-04).

### Current state

- `src/components/nav.tsx` shows Developer when Settings → developer tools is on.

### Likely shape

Link to `/developer` from Settings only (or a footer). Leave the traces page itself.

### Out of scope

Removing traces or the Settings toggle.

---

## How to pick up an item

1. Move it to `doing` in this file.
2. Write a spec (`docs/superpowers/specs/YYYY-MM-DD-<item>-design.md`) and get it approved.
3. Write a plan, then implement. Keep `AGENTS.md` current if behavior changes.
4. Mark the item `done` here when it ships.

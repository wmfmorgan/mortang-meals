# Mortang Meals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a local Next.js meal planner that turns one household profile into a saved week of recipes, supports swapping a meal without duplicates, and derives a shopping list.

**Architecture:** One Next.js App Router process. The browser talks only to local API routes. Those routes read/write SQLite via Drizzle and call an OpenAI-compatible adapter (Grok by default, custom base URL for local models). Pure domain functions (brief, schema, allergens, duplicates, shopping list) sit outside the adapter so tests never hit a live model.

**Tech Stack:** Next.js 15 (App Router, `src/`), React 19, TypeScript, Tailwind, Drizzle + better-sqlite3, Zod, `openai` SDK, Vitest.

## Global Constraints

- Host: local `npm run dev` at `localhost`. No Netlify, no hosted Supabase, no auth.
- Database: SQLite file under `data/` (gitignored). Drizzle only on the server.
- AI: browser never calls a provider. Default `https://api.x.ai/v1` + `XAI_API_KEY`. Settings may override base URL, model, optional custom key.
- Structured output: Grok uses `response_format.type = "json_schema"`. Local providers may fall back to `json_object` + Zod parse.
- One household. Shared diet style. Per-person allergies (hard) and avoidances (soft).
- Week is Monday–Sunday. Slots are breakfast / lunch / dinner. Unchecked slots stay empty.
- Servings default to person count.
- Plans persist only after a successful generate. At most one `isCurrent` plan. History stays readable from This Week.
- Shopping list is derived from the **open** plan, never authored.
- Duplicate rule: normalized title match (lowercase, strip punctuation, collapse whitespace). No fuzzy matching.
- One automatic retry on invalid JSON, schema fail, allergen leak, or duplicate. Last good plan/card is never replaced by a failure.
- AI traces: always record last 25 calls (including retries and test). Redact API keys. Developer nav item only when Settings toggle `developerTools` is on.
- Automated tests mock the adapter. No live model calls in CI.
- Confirm the default Grok model against https://docs.x.ai at implement time. At plan writing the live default was `grok-4.6`.

## File map

Create these files. Do not invent parallel names.

```
package.json
tsconfig.json
next.config.ts
vitest.config.ts
drizzle.config.ts
.env.example
README.md

src/lib/types.ts                 # shared domain types
src/lib/week.ts                  # mondayOf
src/lib/week.test.ts
src/lib/db.ts                    # sqlite + drizzle + ensureSchema
src/lib/schema.ts                # drizzle tables

src/household/brief.ts
src/household/brief.test.ts
src/household/repo.ts

src/kitchen/defaults.ts
src/kitchen/repo.ts

src/meals/schema.ts              # zod for AI JSON
src/meals/schema.test.ts
src/meals/allergen.ts
src/meals/allergen.test.ts
src/meals/duplicates.ts
src/meals/duplicates.test.ts
src/meals/shopping-list.ts
src/meals/shopping-list.test.ts
src/meals/repo.ts

src/ai/settings-repo.ts
src/ai/traces.ts
src/ai/traces.test.ts
src/ai/adapter.ts
src/ai/adapter.test.ts
src/ai/generate-plan.ts
src/ai/generate-plan.test.ts
src/ai/swap-meal.ts
src/ai/swap-meal.test.ts

src/app/globals.css
src/app/layout.tsx
src/app/page.tsx                 # This Week
src/app/setup/page.tsx
src/app/household/page.tsx
src/app/kitchen/page.tsx
src/app/shopping-list/page.tsx
src/app/meals/[id]/page.tsx
src/app/settings/page.tsx
src/app/developer/page.tsx
src/app/developer/visibility.ts
src/app/api/generate/route.ts
src/app/api/swap/route.ts
src/app/api/settings/route.ts
src/app/api/settings/test/route.ts
src/app/api/traces/route.ts

src/components/nav.tsx
src/components/week-grid.tsx
src/components/meal-card.tsx
```

---

### Task 1: Scaffold, types, SQLite schema, Monday helper

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.example`, `README.md`
- Create: `src/lib/types.ts`, `src/lib/week.ts`, `src/lib/week.test.ts`, `src/lib/schema.ts`, `src/lib/db.ts`
- Modify: `.gitignore` (already ignores `data/`, `.env*`, `.next/`, `node_modules/`)

**Interfaces:**
- Consumes: nothing
- Produces: `mondayOf(date: Date): string` returning `YYYY-MM-DD` of that week's Monday; `getDb()` returning a Drizzle client against `data/mortang.db`; types in `src/lib/types.ts` used by every later task

- [ ] **Step 1: Write the failing Monday test**

Create `src/lib/week.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mondayOf } from "./week";

// 2026-01-05 Monday, 2026-01-07 Wednesday, 2026-01-11 Sunday (local dates)
describe("mondayOf", () => {
  it("returns the Monday of a mid-week date", () => {
    expect(mondayOf(new Date(2026, 0, 7))).toBe("2026-01-05");
  });

  it("returns the same day when the date is Monday", () => {
    expect(mondayOf(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("walks back from Sunday to the previous Monday", () => {
    expect(mondayOf(new Date(2026, 0, 11))).toBe("2026-01-05");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/lib/week.test.ts`

Expected: FAIL — `week.ts` does not exist (scaffold the app first if `vitest` is not installed).

If the repo has no Next app yet, create it in this step **before** running the test:

The directory already has `docs/` and `.gitignore`. Do **not** wipe them. Add Next by writing files (do not run `create-next-app` in-place if it refuses a non-empty folder).

`package.json` scripts and dependencies:

```json
{
  "name": "mortang-meals",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "better-sqlite3": "^11.10.0",
    "drizzle-orm": "^0.44.4",
    "next": "^15.5.0",
    "openai": "^5.12.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.0",
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "^22.15.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "tailwindcss": "^4.1.0",
    "typescript": "^5.9.0",
    "vitest": "^3.2.0"
  }
}
```

Pin to whatever `npm install` resolves; do not add unused libraries.

`next.config.ts` must keep the native module off the bundler:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
```

`vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

`.env.example`:

```
XAI_API_KEY=
```

`README.md` must say: copy `.env.example` to `.env.local`, set `XAI_API_KEY`, run `npm run dev`, open `http://localhost:3000`.

- [ ] **Step 3: Implement `mondayOf` and shared types**

`src/lib/week.ts` (local calendar date — this is a household planner, not UTC):

```ts
export function mondayOf(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
```

`src/lib/types.ts` — export exactly these names (later tasks import them; do not rename):

```ts
export type MealSlot = "breakfast" | "lunch" | "dinner";
export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";
export type Aisle = "produce" | "meat" | "dairy" | "pantry" | "other";
export type Sex = "male" | "female" | "other";
export type ProviderMode = "grok" | "custom";
export type TraceKind =
  | "generate"
  | "generate-retry"
  | "swap"
  | "swap-retry"
  | "test";
export type ValidationResult =
  | "ok"
  | "invalid-json"
  | "schema"
  | "allergen"
  | "duplicate"
  | "transport";

export const DAYS: DayOfWeek[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
export const SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner"];
export const AISLES: Aisle[] = ["produce", "meat", "dairy", "pantry", "other"];

export type Ingredient = {
  name: string;
  quantity: number;
  unit: string;
  aisle: Aisle;
};

export type GeneratedMeal = {
  day: DayOfWeek;
  slot: MealSlot;
  title: string;
  whyItFits: string;
  cookMinutes: number;
  method: string;
  ingredients: Ingredient[];
  steps: string[];
};

export type Meal = GeneratedMeal & {
  id: string;
  planId: string;
};

export type Person = {
  id: string;
  name: string;
  age: number;
  sex: Sex | null;
  allergies: string[];
  avoidances: string[];
};

export type Household = {
  id: string;
  name: string;
  dietStyle: string;
  notes: string;
  servings: number;
  people: Person[];
};

export type KitchenItem = {
  id: string;
  name: string;
  kind: "appliance" | "method";
  enabled: boolean;
  builtIn: boolean;
};

export type SlotMask = Record<DayOfWeek, Record<MealSlot, boolean>>;

export type WeekPlan = {
  id: string;
  weekStart: string;
  isCurrent: boolean;
  slotMask: SlotMask;
  meals: Meal[];
};

export type ShoppingItem = {
  name: string;
  quantity: number;
  unit: string;
  aisle: Aisle;
};

export type ShoppingList = { aisle: Aisle; items: ShoppingItem[] }[];

export type AiSettings = {
  mode: ProviderMode;
  baseUrl: string;
  model: string;
  customApiKey: string | null;
  developerTools: boolean;
};

export type AiTrace = {
  id: string;
  createdAt: string;
  kind: TraceKind;
  mode: ProviderMode;
  baseUrl: string;
  model: string;
  requestText: string;
  responseText: string;
  validation: ValidationResult;
};

export type ChatMessage = { role: "system" | "user"; content: string };

export type AdapterRequest = {
  messages: ChatMessage[];
  jsonSchema: Record<string, unknown>;
  schemaName: string;
};

export type AdapterResult =
  | { ok: true; text: string }
  | { ok: false; error: string };
```

- [ ] **Step 4: Add Drizzle tables and `getDb()`**

`src/lib/schema.ts` tables (all SQLite):

- `households`: `id`, `name`, `diet_style`, `notes`, `servings`
- `people`: `id`, `household_id`, `name`, `age`, `sex` (nullable text), `allergies_json`, `avoidances_json`
- `kitchen_items`: `id`, `name`, `kind`, `enabled` (int 0/1), `built_in` (int 0/1)
- `week_plans`: `id`, `week_start`, `is_current` (int 0/1), `slot_mask_json`
- `meals`: `id`, `plan_id`, `day`, `slot`, `title`, `why_it_fits`, `cook_minutes`, `method`, `ingredients_json`, `steps_json`
- `ai_settings`: single row `id = "default"`, `mode`, `base_url`, `model`, `custom_api_key` (nullable), `developer_tools` (int 0/1)
- `ai_traces`: `id`, `created_at`, `kind`, `mode`, `base_url`, `model`, `request_text`, `response_text`, `validation`

`src/lib/db.ts`:

- Resolve DB path as `path.join(process.cwd(), "data", "mortang.db")`.
- `mkdirSync` `data/` if missing.
- `new Database(path)`, `pragma journal_mode = WAL`.
- `ensureSchema(sqlite)` with `CREATE TABLE IF NOT EXISTS` matching the Drizzle columns.
- Export `getDb()` that returns `drizzle(sqlite)`.
- Tests that need a DB must set `process.env.MORTANG_DB_PATH` to a temp file. Honor that env var in `getDb()` so tests never touch the real `data/mortang.db`.

- [ ] **Step 5: Run Monday tests**

Run: `npx vitest run src/lib/week.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.ts vitest.config.ts .env.example README.md src/lib
git commit -m "feat: scaffold Next.js app with SQLite schema and week helper"
```

---

### Task 2: Shopping list merge

**Files:**
- Create: `src/meals/shopping-list.ts`
- Test: `src/meals/shopping-list.test.ts`

**Interfaces:**
- Consumes: `Meal`, `ShoppingList`, `Aisle` from `src/lib/types.ts`
- Produces: `normalizeIngredientName(name: string): string`; `mergeShoppingList(meals: Pick<Meal, "ingredients">[]): ShoppingList`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { mergeShoppingList, normalizeIngredientName } from "./shopping-list";

describe("normalizeIngredientName", () => {
  it("lowercases and strips simple trailing s", () => {
    expect(normalizeIngredientName("Garlic Cloves")).toBe("garlic clove");
    expect(normalizeIngredientName("  Olive Oil  ")).toBe("olive oil");
  });
});

describe("mergeShoppingList", () => {
  it("merges the same name+unit and groups by aisle", () => {
    const list = mergeShoppingList([
      {
        ingredients: [
          { name: "Garlic", quantity: 2, unit: "clove", aisle: "produce" },
          { name: "Salmon", quantity: 1, unit: "lb", aisle: "meat" },
        ],
      },
      {
        ingredients: [
          { name: "garlic", quantity: 1, unit: "clove", aisle: "produce" },
          { name: "Olive oil", quantity: 2, unit: "tbsp", aisle: "pantry" },
        ],
      },
    ]);
    const produce = list.find((g) => g.aisle === "produce")?.items;
    expect(produce).toEqual([
      { name: "garlic", quantity: 3, unit: "clove", aisle: "produce" },
    ]);
    expect(list.map((g) => g.aisle)).toEqual(["produce", "meat", "pantry"]);
  });

  it("does not merge the same name with different units", () => {
    const list = mergeShoppingList([
      {
        ingredients: [
          { name: "olive oil", quantity: 2, unit: "tbsp", aisle: "pantry" },
          { name: "olive oil", quantity: 1, unit: "cup", aisle: "pantry" },
        ],
      },
    ]);
    expect(list[0].items).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/meals/shopping-list.test.ts`

Expected: FAIL — module not found

- [ ] **Step 3: Implement**

`normalizeIngredientName`: trim, lowercase, collapse spaces, if the last word is longer than 3 characters and ends in `s` but not `ss`, drop that `s`.

`mergeShoppingList`: map every ingredient through `normalizeIngredientName` for the merge key (`name|unit`). Sum `quantity`. Keep the first `aisle` seen for that key. Emit groups in `AISLES` order, omitting empty groups. Item `name` in the output is the normalized name.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/meals/shopping-list.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/meals/shopping-list.ts src/meals/shopping-list.test.ts
git commit -m "feat: merge recipe ingredients into an aisle-grouped list"
```

---

### Task 3: Duplicate titles and allergens

**Files:**
- Create: `src/meals/duplicates.ts`, `src/meals/allergen.ts`
- Test: `src/meals/duplicates.test.ts`, `src/meals/allergen.test.ts`

**Interfaces:**
- Consumes: `Ingredient` from `src/lib/types.ts`
- Produces: `normalizeTitle(title: string): string`; `isDuplicateTitle(candidate: string, taken: string[]): boolean`; `findAllergen(ingredients: Ingredient[], allergies: string[]): string | null`

- [ ] **Step 1: Write failing tests**

`src/meals/duplicates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isDuplicateTitle, normalizeTitle } from "./duplicates";

describe("normalizeTitle", () => {
  it("lowercases, strips punctuation, collapses space", () => {
    expect(normalizeTitle("  Lemon-Herb Salmon! ")).toBe("lemon herb salmon");
  });
});

describe("isDuplicateTitle", () => {
  it("matches the replaced meal and other plan titles", () => {
    const taken = ["Lemon herb salmon", "Crockpot chicken"];
    expect(isDuplicateTitle("lemon-herb salmon", taken)).toBe(true);
    expect(isDuplicateTitle("Sheet-pan salmon", taken)).toBe(false);
  });
});
```

`src/meals/allergen.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { findAllergen } from "./allergen";

const shrimp = {
  name: "shrimp",
  quantity: 1,
  unit: "lb",
  aisle: "meat" as const,
};
const rice = {
  name: "rice",
  quantity: 1,
  unit: "cup",
  aisle: "pantry" as const,
};

describe("findAllergen", () => {
  it("returns the first allergy that appears in an ingredient name", () => {
    expect(findAllergen([shrimp, rice], ["shellfish", "shrimp"])).toBe("shrimp");
  });

  it("returns null when nothing matches", () => {
    expect(findAllergen([rice], ["shrimp"])).toBeNull();
  });

  it("matches case-insensitively as a whole word or substring token", () => {
    expect(findAllergen([{ ...shrimp, name: "Garlic Shrimp" }], ["shrimp"])).toBe(
      "shrimp",
    );
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/meals/duplicates.test.ts src/meals/allergen.test.ts`

Expected: FAIL — modules not found

- [ ] **Step 3: Implement**

`normalizeTitle`: lowercase, replace any character that is not `a-z0-9` with a space, collapse whitespace, trim.

`isDuplicateTitle`: `taken.some((t) => normalizeTitle(t) === normalizeTitle(candidate))`.

`findAllergen`: lowercase ingredient names and allergy strings. An allergy hits if it is a non-empty string and appears as a substring of any ingredient name (after lowercasing). Return the original allergy string (from the household list) of the first hit. Empty allergy entries are ignored.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/meals/duplicates.test.ts src/meals/allergen.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/meals/duplicates.ts src/meals/duplicates.test.ts src/meals/allergen.ts src/meals/allergen.test.ts
git commit -m "feat: reject duplicate titles and allergy ingredients"
```

---

### Task 4: Zod schema for AI meal JSON

**Files:**
- Create: `src/meals/schema.ts`
- Test: `src/meals/schema.test.ts`

**Interfaces:**
- Consumes: `GeneratedMeal`, `DayOfWeek`, `MealSlot`, `Aisle` from `src/lib/types.ts`
- Produces: `mealSchema` (Zod); `mealsResponseSchema` (`{ meals: GeneratedMeal[] }`); `singleMealResponseSchema` (`{ meal: GeneratedMeal }`); `parseMealsResponse(text: string)` and `parseSingleMealResponse(text: string)` returning `{ ok: true; meals: GeneratedMeal[] } | { ok: false; reason: "invalid-json" | "schema" }` (single-meal helper returns `meal` on success)

- [ ] **Step 1: Write failing tests**

Use a valid fixture meal:

```ts
const validMeal = {
  day: "monday",
  slot: "dinner",
  title: "Lemon herb salmon",
  whyItFits: "High-protein Mediterranean, sheet pan",
  cookMinutes: 35,
  method: "sheet pan",
  ingredients: [
    { name: "salmon fillets", quantity: 2, unit: "count", aisle: "meat" },
  ],
  steps: ["Heat oven to 425°F", "Roast 15 minutes"],
};
```

Cases:

- `parseMealsResponse(JSON.stringify({ meals: [validMeal] }))` → `ok: true`, one meal
- `parseMealsResponse("not json")` → `{ ok: false, reason: "invalid-json" }`
- `parseMealsResponse(JSON.stringify({ meals: [{ ...validMeal, day: "funday" }] }))` → `{ ok: false, reason: "schema" }`
- `parseMealsResponse(JSON.stringify({ meals: [validMeal], extra: true }))` — extra top-level keys are allowed by Zod by default; **strip** them. Success payload must only expose `meals`.
- `parseSingleMealResponse(JSON.stringify({ meal: validMeal }))` → `ok: true`

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/meals/schema.test.ts`

Expected: FAIL — module not found

- [ ] **Step 3: Implement**

Zod object with `day` enum `DAYS`, `slot` enum `SLOTS`, non-empty `title`, `whyItFits`, `method`, `cookMinutes` integer > 0, `ingredients` min 1 (name non-empty, quantity > 0, unit non-empty, aisle enum), `steps` min 1 non-empty strings.

`parseMealsResponse`: `JSON.parse` in try/catch → `invalid-json`. Then `mealsResponseSchema.safeParse` → `schema` on failure.

Export `mealsJsonSchema` as a plain JSON Schema object (for the adapter `response_format`). Build it by hand to match the Zod shape: top-level object, required `meals`, items as the meal object, `additionalProperties: false` on objects.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/meals/schema.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/meals/schema.ts src/meals/schema.test.ts
git commit -m "feat: validate AI meal JSON with Zod"
```

---

### Task 5: Household brief builder

**Files:**
- Create: `src/household/brief.ts`
- Test: `src/household/brief.test.ts`

**Interfaces:**
- Consumes: `Household`, `KitchenItem`, `SlotMask`, `DayOfWeek`, `MealSlot` from `src/lib/types.ts`
- Produces: `buildHouseholdBrief(input: { household: Household; kitchen: KitchenItem[]; slotMask: SlotMask; extraRules?: string[] }): string`

- [ ] **Step 1: Write the failing snapshot-style test**

```ts
import { describe, expect, it } from "vitest";
import { buildHouseholdBrief } from "./brief";
import type { Household, KitchenItem, SlotMask } from "@/lib/types";
import { DAYS, SLOTS } from "@/lib/types";

function emptyMask(): SlotMask {
  return Object.fromEntries(
    DAYS.map((d) => [d, Object.fromEntries(SLOTS.map((s) => [s, false]))]),
  ) as SlotMask;
}

const household: Household = {
  id: "h1",
  name: "Mortang",
  dietStyle: "high-protein Mediterranean",
  notes: "Weeknight dinners under 45 minutes when possible.",
  servings: 2,
  people: [
    {
      id: "p1",
      name: "Alex",
      age: 53,
      sex: "male",
      allergies: ["shellfish"],
      avoidances: [],
    },
    {
      id: "p2",
      name: "Sam",
      age: 53,
      sex: "female",
      allergies: [],
      avoidances: ["cilantro"],
    },
  ],
};

const kitchen: KitchenItem[] = [
  { id: "k1", name: "sheet pan", kind: "method", enabled: true, builtIn: true },
  { id: "k2", name: "crockpot", kind: "appliance", enabled: true, builtIn: true },
  { id: "k3", name: "grill", kind: "method", enabled: false, builtIn: true },
];

describe("buildHouseholdBrief", () => {
  it("describes people, diet, hard allergies, soft avoidances, enabled kitchen, slots, servings", () => {
    const mask = emptyMask();
    mask.monday.dinner = true;
    mask.tuesday.dinner = true;
    const brief = buildHouseholdBrief({ household, kitchen, slotMask: mask });
    expect(brief).toContain("53-year-old man");
    expect(brief).toContain("53-year-old woman");
    expect(brief).toContain("high-protein Mediterranean");
    expect(brief).toContain("Never use shellfish (Alex)");
    expect(brief).toContain("Prefer to avoid cilantro (Sam)");
    expect(brief).toContain("sheet pan");
    expect(brief).toContain("crockpot");
    expect(brief).not.toContain("grill");
    expect(brief).toContain("monday dinner");
    expect(brief).toContain("Servings: 2");
    expect(brief).toContain("Weeknight dinners under 45 minutes");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run src/household/brief.test.ts`

Expected: FAIL — module not found

- [ ] **Step 3: Implement `buildHouseholdBrief`**

Compose a single string with labeled sections:

1. People: for each person, `a {age}-year-old {man|woman|person}` (`sex` male → man, female → woman, otherwise person), joined with “and”.
2. Diet: `Focusing on a {dietStyle} diet.`
3. Notes if non-empty.
4. Allergies: one `Never use {item} ({name})` line per allergy.
5. Avoidances: one `Prefer to avoid {item} ({name})` line per avoidance.
6. Kitchen: `Prefer meals that use: ` + enabled item names, comma-separated. If none enabled, omit the section.
7. Slots: `Fill only these slots: ` + `monday dinner, tuesday dinner`.
8. `Servings: {n}.`
9. Each `extraRules` entry on its own line.

- [ ] **Step 4: Run test — expect PASS**

Run: `npx vitest run src/household/brief.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/household/brief.ts src/household/brief.test.ts
git commit -m "feat: build the household AI brief from profiles"
```

---

### Task 6: Repositories

**Files:**
- Create: `src/household/repo.ts`, `src/kitchen/defaults.ts`, `src/kitchen/repo.ts`, `src/meals/repo.ts`, `src/ai/settings-repo.ts`, `src/ai/traces.ts`
- Test: `src/ai/traces.test.ts` plus a focused `src/meals/repo.test.ts` for current-plan replacement

**Interfaces:**
- Consumes: `getDb()`, types from Task 1
- Produces (exact signatures later tasks call):

```ts
// household/repo.ts
getHousehold(): Household | null
upsertHousehold(input: Omit<Household, "id" | "people"> & { id?: string }): Household
replacePeople(householdId: string, people: Omit<Person, "id">[]): Person[]

// kitchen/repo.ts
listKitchen(): KitchenItem[]
seedKitchenIfEmpty(): void   // inserts built-ins from defaults.ts
setKitchenEnabled(id: string, enabled: boolean): void
addCustomKitchenItem(name: string, kind: "appliance" | "method"): KitchenItem

// meals/repo.ts
listPlans(): Pick<WeekPlan, "id" | "weekStart" | "isCurrent">[]
getPlan(id: string): WeekPlan | null
getCurrentPlan(): WeekPlan | null
saveGeneratedPlan(input: { weekStart: string; slotMask: SlotMask; meals: GeneratedMeal[] }): WeekPlan
replaceMeal(planId: string, mealId: string, next: GeneratedMeal): Meal

// ai/settings-repo.ts
getSettings(): AiSettings
saveSettings(patch: Partial<AiSettings>): AiSettings
// defaults: mode "grok", baseUrl "https://api.x.ai/v1", model "grok-4.6" (or live docs), customApiKey null, developerTools false

// ai/traces.ts
recordTrace(input: Omit<AiTrace, "id" | "createdAt">): AiTrace
listTraces(): AiTrace[]   // newest first, max 25
clearTraces(): void
redactSecrets(text: string): string
```

- [ ] **Step 1: Write failing repo tests**

`src/ai/traces.test.ts` (use `MORTANG_DB_PATH` pointing at `os.tmpdir()` unique file, import `getDb` after setting the env so the module opens the temp DB — if `getDb` caches, export `openDb(path)` and have tests call that; prefer **no process-wide singleton**, or a `resetDbForTests()` that closes and reopens):

```ts
it("redacts API keys and Authorization headers", () => {
  expect(redactSecrets('Authorization: Bearer sk-test\nXAI_API_KEY=abc')).not.toContain("sk-test");
  expect(redactSecrets("XAI_API_KEY=abc")).not.toContain("abc");
});

it("keeps only the last 25 traces", () => {
  for (let i = 0; i < 26; i++) {
    recordTrace({
      kind: "generate",
      mode: "grok",
      baseUrl: "https://api.x.ai/v1",
      model: "grok-4.6",
      requestText: `req ${i}`,
      responseText: `res ${i}`,
      validation: "ok",
    });
  }
  const rows = listTraces();
  expect(rows).toHaveLength(25);
  expect(rows[0].requestText).toBe("req 25");
});
```

`src/meals/repo.test.ts`:

- `saveGeneratedPlan` twice for the same `weekStart` → newest `isCurrent === true`, older `isCurrent === false`, `listPlans()` returns both.
- `replaceMeal` changes only that meal’s title.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/ai/traces.test.ts src/meals/repo.test.ts`

Expected: FAIL — modules not found

- [ ] **Step 3: Implement repos**

`src/kitchen/defaults.ts` built-in names (all `enabled: true`, `builtIn: true`):

- appliances: `crockpot`, `air fryer`, `Instant Pot`, `oven`, `stovetop`
- methods: `sheet pan`, `grill`

`saveGeneratedPlan`: wrap in a transaction. Set `is_current = 0` on all rows. Insert plan + meals. Generate UUIDs with `crypto.randomUUID()`.

`recordTrace`: insert, then `DELETE FROM ai_traces WHERE id NOT IN (SELECT id FROM ai_traces ORDER BY created_at DESC LIMIT 25)`.

`redactSecrets`: replace `/Bearer\s+\S+/gi` with `Bearer [redacted]`, replace `/(XAI_API_KEY|api[_-]?key)\s*[:=]\s*\S+/gi` with `$1=[redacted]`. Apply `redactSecrets` inside `recordTrace` to both text fields.

`getSettings`: if no row, insert defaults and return them.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/ai/traces.test.ts src/meals/repo.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/household/repo.ts src/kitchen src/meals/repo.ts src/meals/repo.test.ts src/ai/settings-repo.ts src/ai/traces.ts src/ai/traces.test.ts
git commit -m "feat: persist household, kitchen, plans, settings, and AI traces"
```

---

### Task 7: OpenAI-compatible adapter

**Files:**
- Create: `src/ai/adapter.ts`
- Test: `src/ai/adapter.test.ts`

**Interfaces:**
- Consumes: `AiSettings`, `AdapterRequest`, `AdapterResult` from `src/lib/types.ts`
- Produces: `createAdapter(settings: AiSettings): { complete(req: AdapterRequest): Promise<AdapterResult> }`
- Produces: `resolveApiKey(settings: AiSettings): string | undefined` — Grok → `process.env.XAI_API_KEY`; custom → `settings.customApiKey ?? undefined`

The adapter is the only file that imports `openai`. Tests inject a fake `complete` later; this task tests key resolution and that `createAdapter` calls the SDK with `baseURL` from settings and `response_format` json_schema when `mode === "grok"`.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it, vi } from "vitest";

it("resolveApiKey uses XAI_API_KEY for grok and the stored key for custom", () => {
  process.env.XAI_API_KEY = "xai-secret";
  expect(
    resolveApiKey({
      mode: "grok",
      baseUrl: "https://api.x.ai/v1",
      model: "grok-4.6",
      customApiKey: "ignored",
      developerTools: false,
    }),
  ).toBe("xai-secret");
  expect(
    resolveApiKey({
      mode: "custom",
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "llama",
      customApiKey: null,
      developerTools: false,
    }),
  ).toBeUndefined();
});
```

Add a second test that stubs the OpenAI constructor (vi.mock("openai")) and asserts `complete` is called with `model`, `messages`, and `response_format: { type: "json_schema", json_schema: { name, schema, strict: true } }` when mode is grok. For `mode === "custom"`, assert `response_format: { type: "json_object" }` (local models often lack json_schema).

On SDK throw, `complete` returns `{ ok: false, error: message }`. On success, `{ ok: true, text: content }`.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx vitest run src/ai/adapter.test.ts`

Expected: FAIL — module not found

- [ ] **Step 3: Implement `createAdapter`**

```ts
import OpenAI from "openai";
import type { AdapterRequest, AdapterResult, AiSettings } from "@/lib/types";

export function resolveApiKey(settings: AiSettings): string | undefined {
  if (settings.mode === "grok") return process.env.XAI_API_KEY || undefined;
  return settings.customApiKey ?? undefined;
}

export function createAdapter(settings: AiSettings) {
  const client = new OpenAI({
    apiKey: resolveApiKey(settings) ?? "not-needed",
    baseURL: settings.baseUrl,
  });

  return {
    async complete(req: AdapterRequest): Promise<AdapterResult> {
      try {
        const completion = await client.chat.completions.create({
          model: settings.model,
          messages: req.messages,
          response_format:
            settings.mode === "grok"
              ? {
                  type: "json_schema",
                  json_schema: {
                    name: req.schemaName,
                    schema: req.jsonSchema,
                    strict: true,
                  },
                }
              : { type: "json_object" },
        });
        const text = completion.choices[0]?.message?.content ?? "";
        return { ok: true, text };
      } catch (err) {
        const message = err instanceof Error ? err.message : "request failed";
        return { ok: false, error: message };
      }
    },
  };
}
```

If the installed `openai` package’s types reject this `response_format` shape, adapt to the package’s current structured-output helper (`zodResponseFormat` or `client.chat.completions.parse`) but keep the public `createAdapter` / `complete` contract unchanged.

Before writing, fetch https://docs.x.ai/developers/models and https://docs.x.ai/developers/model-capabilities/text/structured-outputs and set the default model in `settings-repo.ts` to the current Grok chat model if it is no longer `grok-4.6`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx vitest run src/ai/adapter.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ai/adapter.ts src/ai/adapter.test.ts src/ai/settings-repo.ts
git commit -m "feat: add OpenAI-compatible Grok and local adapter"
```

---

### Task 8: Generate week and swap meal use cases

**Files:**
- Create: `src/ai/generate-plan.ts`, `src/ai/swap-meal.ts`
- Test: `src/ai/generate-plan.test.ts`, `src/ai/swap-meal.test.ts`

**Interfaces:**
- Consumes: `buildHouseholdBrief`, `parseMealsResponse`, `parseSingleMealResponse`, `findAllergen`, `isDuplicateTitle`, `createAdapter` shape (`complete` only)
- Produces:

```ts
export type PlanFailure = { ok: false; message: string };
export type GenerateSuccess = { ok: true; meals: GeneratedMeal[] };
export type SwapSuccess = { ok: true; meal: GeneratedMeal };

export function collectAllergies(household: Household): string[]

export async function generateWeekPlan(input: {
  household: Household;
  kitchen: KitchenItem[];
  slotMask: SlotMask;
  adapter: { complete(req: AdapterRequest): Promise<AdapterResult> };
  logTrace: (t: Omit<AiTrace, "id" | "createdAt">) => void;
  settings: Pick<AiSettings, "mode" | "baseUrl" | "model">;
}): Promise<GenerateSuccess | PlanFailure>

export async function swapMeal(input: {
  household: Household;
  kitchen: KitchenItem[];
  slotMask: SlotMask;
  current: GeneratedMeal;          // meal being replaced
  otherMeals: GeneratedMeal[];     // rest of the open plan
  adapter: { complete(req: AdapterRequest): Promise<AdapterResult> };
  logTrace: (t: Omit<AiTrace, "id" | "createdAt">) => void;
  settings: Pick<AiSettings, "mode" | "baseUrl" | "model">;
}): Promise<SwapSuccess | PlanFailure>
```

Copy for failures (use verbatim):

- transport: `The model didn’t respond`
- after retry still bad: `Couldn’t get a usable plan, try again.`
- swap still duplicate/invalid: `Couldn’t find a different meal, try again.`

- [ ] **Step 1: Write failing generate tests**

Build a tiny household (one person, allergy `shrimp`) and a mask with only `monday.dinner = true`.

Helper `fakeAdapter(queue: AdapterResult[])` shifts one result per `complete` call and records the `AdapterRequest`s.

Cases:

1. First `complete` returns valid `{ meals: [validMondayDinner] }` → `ok: true`, one meal, `logTrace` called once with `kind: "generate"`, `validation: "ok"`.
2. First returns `"not-json"`, second returns valid JSON → success; traces `generate`/`invalid-json` then `generate-retry`/`ok`.
3. Valid JSON whose ingredient is `shrimp` then same again → `{ ok: false, message: "Couldn’t get a usable plan, try again." }`; nothing looking like persist (this function does not call `saveGeneratedPlan`).
4. Two meals with the same title in one response → `validation: "duplicate"`, retry once.
5. Adapter `{ ok: false, error: "timeout" }` twice → message `The model didn’t respond`.
6. Assert the first request `messages[0].content` contains the brief (diet style) and `messages[1].content` lists requested slots.

- [ ] **Step 2: Write failing swap tests**

`otherMeals` includes `Crockpot chicken`. `current.title` is `Lemon herb salmon`.

1. Model returns `Sheet-pan trout` → success.
2. Model returns `lemon-herb salmon` then `Crockpot chicken` → failure `Couldn’t find a different meal, try again.`
3. Request user message includes a do-not-repeat list containing both titles.

- [ ] **Step 3: Run tests — expect FAIL**

Run: `npx vitest run src/ai/generate-plan.test.ts src/ai/swap-meal.test.ts`

Expected: FAIL — modules not found

- [ ] **Step 4: Implement generate**

Algorithm:

1. `requested` = slots where mask is true. If none, return `{ ok: false, message: "Turn on at least one meal slot." }`.
2. `brief = buildHouseholdBrief(...)`.
3. System message: brief + hard rules: fill only requested slots; servings; no allergy ingredients; honor avoidances; JSON only; no duplicate titles inside the plan.
4. User message: `Generate meals for: ` + requested slot list.
5. Call `adapter.complete` with `schemaName: "week_plan"` and `mealsJsonSchema`.
6. If transport fail → log `kind` (`generate` or `generate-retry`), `validation: "transport"`, `responseText: error`. If first attempt, retry once with the error appended to the user message. If second, return `The model didn’t respond`.
7. Parse with `parseMealsResponse`. On `invalid-json` / `schema`, log and retry once the same way.
8. If parsed meals’ slots do not equal the requested set, treat as `schema` (retry / fail).
9. Collect allergies via `collectAllergies` (every person allergy). If `findAllergen` hits any meal, log `allergen`, retry.
10. If any two meals share `isDuplicateTitle`, log `duplicate`, retry.
11. Success: log `ok`, return meals.

`collectAllergies(household)` flattens `people[].allergies`.

- [ ] **Step 5: Implement swap**

Same brief. Extra rules: do-not-repeat list = `normalizeTitle` of `current.title` plus every `otherMeals` title. User message: `Replace {current.day} {current.slot}. Do not repeat: {titles}.`

`schemaName: "single_meal"`, `singleMealJsonSchema`.

After parse: meal.day/slot must match `current`. `findAllergen`. `isDuplicateTitle(meal.title, [current.title, ...otherMeals.map(m => m.title)])`. Retry once. Final fail message is the swap-specific string.

- [ ] **Step 6: Run tests — expect PASS**

Run: `npx vitest run src/ai/generate-plan.test.ts src/ai/swap-meal.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/ai/generate-plan.ts src/ai/generate-plan.test.ts src/ai/swap-meal.ts src/ai/swap-meal.test.ts
git commit -m "feat: generate a week and swap a meal with validation retries"
```

---

### Task 9: API routes and smoke path

**Files:**
- Create: `src/app/api/generate/route.ts`, `src/app/api/swap/route.ts`, `src/app/api/settings/route.ts`, `src/app/api/settings/test/route.ts`, `src/app/api/traces/route.ts`
- Test: `src/app/api/smoke.test.ts`

**Interfaces:**
- Consumes: repos + `generateWeekPlan` + `swapMeal` + `createAdapter`
- Produces HTTP JSON:

`POST /api/generate` body `{ weekStart?: string; slotMask: SlotMask }`  
→ `200 { plan: WeekPlan }` or `400 { message }` or `422 { message }` (model failed)

`POST /api/swap` body `{ planId: string; mealId: string }`  
→ `200 { meal: Meal; shoppingList: ShoppingList }` or `404` / `422 { message }`

`GET /api/settings` → `{ settings: AiSettings }` with `customApiKey` replaced by `true` if set, `false` if null (never send the raw key to the browser).

`PUT /api/settings` body `Partial<AiSettings>` → same safe settings object.

`POST /api/settings/test` → `{ ok: boolean; message: string }` and always writes a `test` trace.

`GET /api/traces` → `{ traces: AiTrace[] }`

`DELETE /api/traces` → `{ ok: true }`

Generate/swap **do not persist** unless `generateWeekPlan` / `swapMeal` returns `ok: true`. Then `saveGeneratedPlan` / `replaceMeal`.

Missing household, zero people, empty `dietStyle`, or no slots on → `400` with a message that names what is missing. Do not call the adapter.

If Grok mode and `!process.env.XAI_API_KEY` → `400` `Add XAI_API_KEY in .env.local or switch to a local model in Settings.`

- [ ] **Step 1: Write the smoke test**

`src/app/api/smoke.test.ts` should not boot Next. Export the handler logic as functions from the route files (or from `src/ai/http.ts`) so the test can call them:

```ts
export async function handleGenerate(body: unknown): Promise<{ status: number; body: unknown }>
export async function handleSwap(body: unknown): Promise<{ status: number; body: unknown }>
```

Route files become `export async function POST(req: Request) { const result = await handleGenerate(await req.json()); return Response.json(result.body, { status: result.status }); }`.

In the smoke test:

1. Point `MORTANG_DB_PATH` at a temp file and reset DB.
2. `upsertHousehold` + two people + `seedKitchenIfEmpty`.
3. Mock `createAdapter` by passing a test-only override: put `complete` on a module-level `adapterForTests` that `handleGenerate` uses when `process.env.VITEST === "true"`. Cleaner: `handleGenerate` accepts an optional `adapter` argument the route does not pass.

Preferred: `handleGenerate(body, deps?)` with default deps constructing the real adapter. Tests pass `{ complete: ... }`.

Sequence:

- `handleGenerate` with a full weekday dinner mask and a mock that returns 7 unique dinners → status 200, `plan.meals.length === 7`, `getCurrentPlan()` matches.
- `handleSwap` on Monday dinner, mock returns a new unique title → 200, that meal title changed, other titles unchanged, `mergeShoppingList` of the returned plan ingredients is what the client would show.
- Generate with empty diet style → 400, adapter `complete` not called.

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run src/app/api/smoke.test.ts`

Expected: FAIL — handlers missing

- [ ] **Step 3: Implement handlers**

`handleGenerate`:

1. Validate body with Zod (`slotMask` required).
2. `getHousehold()`; reject if null, no people, or blank `dietStyle`.
3. If no slot is true, reject.
4. `weekStart = body.weekStart ?? mondayOf(new Date())`.
5. `settings = getSettings()`; Grok key check.
6. `result = await generateWeekPlan({ ..., adapter: deps?.adapter ?? createAdapter(settings), logTrace: recordTrace, settings })`.
7. If `!result.ok` return 422 `{ message: result.message }`.
8. `plan = saveGeneratedPlan({ weekStart, slotMask, meals: result.meals })`.
9. Return 200 `{ plan }`.

`handleSwap`: load plan + meal; 404 if missing; run `swapMeal`; on success `replaceMeal` then return meal + `mergeShoppingList(updatedPlan.meals)`.

`POST /api/settings/test`: `adapter.complete` with a tiny json_schema `{ type: "object", properties: { pong: { type: "string" } }, required: ["pong"], additionalProperties: false }` and user text `Reply with pong=ok`. Log trace kind `test`. Do not throw if JSON is weird — `ok` is whether `adapter.complete` returned `{ ok: true }`.

- [ ] **Step 4: Run smoke — expect PASS**

Run: `npx vitest run src/app/api/smoke.test.ts`

Expected: PASS

- [ ] **Step 5: Run the full unit suite**

Run: `npm test`

Expected: all existing tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api src/ai/http.ts
git commit -m "feat: add generate, swap, settings, and traces API routes"
```

(Omit `src/ai/http.ts` from `git add` if you inlined handlers in the route files.)

---

### Task 10: App shell, setup wizard, Household, Kitchen

**Files:**
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/setup/page.tsx`, `src/app/household/page.tsx`, `src/app/kitchen/page.tsx`, `src/components/nav.tsx`
- Modify: `src/app/page.tsx` (placeholder This Week that redirects to `/setup` when `getHousehold()` is null or has zero people)

**Interfaces:**
- Consumes: household + kitchen repos, `getSettings()` for nav
- Produces: first-run flow Household → Kitchen → slot grid (slot grid can live on `/setup` step 3 and write the mask into `sessionStorage` key `mortang.slotMask`, default all dinners true, breakfast/lunch false). After step 3, go to `/` (This Week). Nav links: This Week, Shopping list, Household, Kitchen, Settings, and Developer **only if** `getSettings().developerTools`.

- [ ] **Step 1: Write a nav visibility test**

`src/components/nav.test.tsx` (first line: `// @vitest-environment happy-dom`). Install `happy-dom` and `@testing-library/react` as devDependencies in this task if they are not already in `package.json`.

Render `<Nav developerTools={false} />` — query by role/link, expect no `Developer`.  
Render `<Nav developerTools={true} />` — expect a Developer link to `/developer`.

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run src/components/nav.test.tsx`

Expected: FAIL — component missing

- [ ] **Step 3: Implement shell + forms**

`layout.tsx`: load settings + household server-side, render `<Nav />`, `<main>{children}</main>`.

Household page: server component loads `getHousehold()`. Client form fields: household name, diet style, notes, servings (number). Dynamic people list: name, age, sex select (`"" | male | female | other`), allergies (comma-separated), avoidances (comma-separated). Submit via a server action `saveHouseholdAction` that calls `upsertHousehold` + `replacePeople`. Servings default: if the user leaves servings empty, set to `people.length`.

Kitchen page: `seedKitchenIfEmpty()` on load. Checkboxes call a server action `setKitchenEnabled`. A small form adds a custom item (`addCustomKitchenItem`).

Setup page: three steps in one client component. Step 1 reuses the household fields. Step 2 kitchen checkboxes. Step 3 7×3 checkbox grid labeled Mon–Sun / B/L/D. Continue / Back. Finish writes household + kitchen + `sessionStorage` mask and `router.push("/")`.

Empty states: if diet style is blank, show “Add a diet style before generating.”

Styling: readable Tailwind, not a design exercise. Week grid checkboxes must be usable.

- [ ] **Step 4: Run nav test — expect PASS**

Run: `npx vitest run src/components/nav.test.tsx`

Expected: PASS

- [ ] **Step 5: Manual check**

Run: `npm run dev`

Open `/setup`, create two people (53 male / 53 female), diet “high-protein Mediterranean”, enable sheet pan + crockpot, leave dinners on. Confirm you land on `/` and `/household` shows the people.

- [ ] **Step 6: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css src/app/setup src/app/household src/app/kitchen src/app/page.tsx src/components/nav.tsx src/components/nav.test.tsx
git commit -m "feat: add setup wizard, household, and kitchen screens"
```

---

### Task 11: This Week calendar, generate, recipe, swap

**Files:**
- Create: `src/components/week-grid.tsx`, `src/components/meal-card.tsx`, `src/app/meals/[id]/page.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `handleGenerate` / `handleSwap` via `fetch`, `listPlans`, `getPlan`, `getCurrentPlan`
- Produces: desktop 7-column calendar (days as columns, B/L/D as rows). Empty slots are dashed. Narrow CSS (`max-width: 800px`) stacks into day sections (agenda). Clicking a filled card goes to `/meals/[id]`. Swap button on the card and on the recipe page `POST /api/swap`. Week picker lists `listPlans()` by `weekStart` + “current” badge. Generate uses the slot mask from `sessionStorage` or, if a plan is open, that plan’s mask. Disable Generate when household is incomplete; show the missing-field message.

- [ ] **Step 1: Write week-grid tests**

`src/components/week-grid.test.tsx`:

- Given a plan with only Monday dinner filled, render 21 cells; Monday dinner shows the title; Tuesday dinner has accessible name `empty tuesday dinner` (or similar) and no title.
- A filled card is a link to `/meals/{id}`.

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run src/components/week-grid.test.tsx`

Expected: FAIL — component missing

- [ ] **Step 3: Implement This Week + recipe**

`page.tsx` (server): load current plan or `?plan=` id. Render picker, Generate button (client), `WeekGrid`.

Generate client handler: `POST /api/generate` with mask; on 200 refresh (`router.refresh()`). On 422/400 show `message` in an alert banner. While in flight, disable the button and show “Generating…”.

`MealCard`: title, slot, method, cook minutes, whyItFits, Swap button (`fetch /api/swap` then refresh). Swap in flight disables only that button. Error banner uses the API `message`.

Recipe page: full ingredients + numbered steps. No AI call. Swap + back link to `/`.

- [ ] **Step 4: Run grid test — expect PASS**

Run: `npx vitest run src/components/week-grid.test.tsx`

Expected: PASS

- [ ] **Step 5: Manual check**

With `XAI_API_KEY` set, generate a real week (or temporarily point Settings at a mock if you lack a key — not required if you already ran smoke tests). Click a card, confirm recipe fields, swap one dinner, confirm the old title is gone and other days are unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/meals src/components/week-grid.tsx src/components/week-grid.test.tsx src/components/meal-card.tsx
git commit -m "feat: show the week calendar, recipes, and meal swap"
```

---

### Task 12: Shopping list, Settings, Developer log

**Files:**
- Create: `src/app/shopping-list/page.tsx`, `src/app/settings/page.tsx`, `src/app/developer/page.tsx`, `src/app/developer/visibility.ts`

**Interfaces:**
- Consumes: `mergeShoppingList`, settings + traces APIs
- Produces: shopping list grouped by aisle for the **open** plan (`?plan=` same as This Week, else current). Settings form for mode, base URL, model, optional custom key, Test connection, Developer tools checkbox. Developer page: 404-style “Turn on Developer tools in Settings” if the toggle is off (also hide nav). If on, list traces newest first; expand to show `requestText` and `responseText` in `<pre>`; Clear log calls `DELETE /api/traces`.

- [ ] **Step 1: Write the developer visibility test**

`src/app/developer/visibility.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canViewDeveloper } from "./visibility";

describe("canViewDeveloper", () => {
  it("is true only when the settings toggle is on", () => {
    expect(canViewDeveloper(false)).toBe(false);
    expect(canViewDeveloper(true)).toBe(true);
  });
});
```

The Developer page imports `canViewDeveloper` and, when false, renders “Turn on Developer tools in Settings” with no traces. Nav visibility stays covered by Task 10.

- [ ] **Step 2: Implement the three pages**

Shopping list: for each aisle section a heading + `<ul>` of `{quantity} {unit} {name}`. Empty plan → “Generate a week to build a shopping list.”

Settings: load safe settings. Custom key field is empty placeholder “leave blank to keep” when `customApiKey === true`. Saving blank does not wipe an existing key; send `customApiKey: null` only from an explicit “Clear key” control.

Test connection button → `POST /api/settings/test` → show `message`.

Developer tools checkbox saves immediately (PUT) and refreshes the layout so Nav updates.

Developer page reads `listTraces()` on the server when toggle is on.

- [ ] **Step 3: Run tests**

Run: `npm test`

Expected: all PASS

- [ ] **Step 4: Manual check**

- Open shopping list after a generated plan; garlic-style dupes are merged.
- Toggle Developer tools on; Nav shows Developer; generate; open Developer and see the prompt and JSON.
- Toggle off; `/developer` does not show traces (message to enable the toggle).
- Desktop week grid vs a narrow window (DevTools ~390px) becomes agenda.

- [ ] **Step 5: Commit**

```bash
git add src/app/shopping-list src/app/settings src/app/developer
git commit -m "feat: add shopping list, settings, and developer AI log"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| Local Next.js + SQLite + Drizzle | 1 |
| One household, no auth | 6, 10 |
| Shared diet, per-person allergies/avoidances | 5, 6, 10 |
| Kitchen appliances/methods + custom | 6, 10 |
| Week Mon–Sun, B/L/D slot mask | 1, 10, 11 |
| Full recipes stored with generate | 8, 9, 11 |
| Card opens stored recipe (no AI) | 11 |
| Derived shopping list, merge + aisles, follows open plan | 2, 9, 12 |
| Save plans + week picker + isCurrent | 6, 11 |
| Swap one meal, rebuild list | 8, 9, 11 |
| Duplicate titles rejected + retry | 3, 8 |
| Allergen reject + retry | 3, 8 |
| Structured JSON / json_schema / Zod | 4, 7, 8 |
| Grok default + custom OpenAI-compatible | 7, 12 |
| Keys server-side only; custom key not echoed | 7, 9, 12 |
| Error copy and last-good-plan | 8, 9, 11 |
| Developer toggle + last 25 traces + redact | 6, 9, 12 |
| First-run Household → Kitchen → slots → Generate | 10, 11 |
| Calendar desktop / agenda narrow | 11 |
| Tests mock adapter; smoke path | 8, 9 |
| Default model confirmed from docs.x.ai | 7 |

No TBD/TODO left in tasks. Function names are consistent (`generateWeekPlan`, `swapMeal`, `mergeShoppingList`, `recordTrace`, `createAdapter`, `handleGenerate`, `handleSwap`).

# Supabase + Vercel Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace local SQLite + no-auth with Supabase Postgres + invite-only magic links, one household per user, and deploy the existing Next.js app to Vercel with Node AI streams (no Edge).

**Architecture:** Keep the current handler/repo split. Browser still only talks to Next.js routes. `@supabase/ssr` owns the cookie session. Drizzle + postgres.js talk to the Supabase transaction pooler using `DATABASE_URL` (bypasses RLS). Every repo call takes `householdId`. RLS is enabled with Data API grants revoked so PostgREST cannot leak rows. AI stays in existing `/api/*` route handlers with `maxDuration = 300`.

**Tech Stack:** Next.js 15 App Router, React 19, Drizzle `pg-core`, `postgres` (postgres.js), `@supabase/ssr`, `@supabase/supabase-js`, Zod, Vitest, Vercel Node Fluid Compute, local `supabase start`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-11-supabase-vercel-migration-design.md`
- Iron law: failing test first. No live xAI calls. Mock `complete`.
- `supabase start` must be running for repo/HTTP tests. Direct DB URL port **54322** for tests; app runtime uses the **transaction pooler** (`prepare: false`).
- Browser never calls xAI or the Supabase Data API.
- `XAI_API_KEY` is env-only. Never in git, never in Postgres.
- One login = one household (`households.owner_id` unique).
- Invite-only: `signInWithOtp({ shouldCreateUser: false })`.
- Shared host key + `AI_DAILY_CAP = 10` per UTC day. Skip cap when `mode === "custom"` and a custom key is set.
- Booleans are Postgres `boolean`. JSON is `jsonb`. Standalone meals use `plan_id is null` (not `''`).
- Domain modules stay pure/sync: allergen, duplicates, brief, shopping-list, catalog, week, slot-mask, extras, protein, fill, dessert-criteria.
- Visual language: existing olive/linen classes (`page-shell`, `page-title`, `btn`, `input`). No new design system.
- Commits: conventional. Branch: `feat/supabase-vercel`.
- Do not use Edge runtimes. Do not add Netlify. Do not grant `anon`/`authenticated` on app tables.

---

## File map

```
supabase/config.toml                          # CLI project; invite-only email
supabase/migrations/20260911120000_init.sql   # tables, indexes, RLS, revokes
supabase/.gitignore

src/lib/schema.ts                             # drizzle pgTable (replace sqlite)
src/lib/db.ts                                 # postgres.js + resetDbForTests
src/lib/test-identity.ts                      # createTestIdentity / deleteTestUser
src/lib/types.ts                              # Meal.planId: string | null
src/lib/supabase/client.ts                    # browser client
src/lib/supabase/server.ts                    # server cookie client
src/lib/supabase/middleware.ts                # updateSession
src/lib/request-auth.ts                       # requireUser / requireHousehold

src/middleware.ts                             # Next 15 middleware

src/household/repo.ts                         # async + ownerId / householdId
src/kitchen/repo.ts
src/kitchen/prefs-repo.ts
src/meals/repo.ts
src/meals/http.ts
src/meals/library-prefs.ts
src/ai/http.ts
src/ai/settings-repo.ts
src/ai/traces.ts
src/ai/usage.ts                               # NEW daily cap
src/ai/usage.test.ts

src/app/login/page.tsx
src/app/login/login-form.tsx
src/app/auth/confirm/route.ts
src/app/logout/route.ts
src/app/layout.tsx
src/app/page.tsx                              # and other pages: await household
src/app/api/*/route.ts                        # pass auth into handlers; maxDuration
src/components/nav.tsx                        # email + log out

scripts/import-sqlite.ts
scripts/import-sqlite.test.ts

.env.example
README.md
AGENTS.md
package.json                                  # deps; better-sqlite3 → devDependency
next.config.ts                                # drop better-sqlite3 external
vitest.config.ts                              # setupFiles
```

Temporary during Tasks 1–4: keep `getHousehold()` as “first row” so pages still typecheck until Task 6 deletes it.

---

### Task 1: Supabase migration (tables, RLS, grants)

**Files:**
- Create: `supabase/migrations/20260911120000_init.sql`
- Create: `src/lib/schema.migration.test.ts`
- Modify: `supabase/config.toml` (after `supabase init`)

**Interfaces:**
- Produces: public tables listed in the spec; RLS on; `anon`/`authenticated` have no table grants.

- [ ] **Step 1: Init Supabase in the repo**

Run from repo root:

```bash
supabase init
supabase start
```

Expected: API `http://127.0.0.1:54321`, DB `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. Copy URL, publishable key, service role key, and DB URL into `.env.local` (gitignored). Do not commit secrets.

In `supabase/config.toml` set:

```toml
[auth]
site_url = "http://localhost:3000"
additional_redirect_urls = ["http://localhost:3000/auth/confirm"]
enable_signup = false

[auth.email]
enable_confirmations = true
enable_signup = false
```

- [ ] **Step 2: Write the failing migration test**

```ts
// src/lib/schema.migration.test.ts
import postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";

const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

describe("init migration", () => {
  let sql: ReturnType<typeof postgres>;
  beforeAll(() => {
    sql = postgres(url, { prepare: false, max: 1 });
  });

  it("creates households with unique owner_id", async () => {
    const rows = await sql`
      select column_name, data_type, is_nullable
      from information_schema.columns
      where table_schema = 'public' and table_name = 'households'
    `;
    const names = rows.map((r) => r.column_name);
    expect(names).toEqual(
      expect.arrayContaining(["id", "owner_id", "name", "diet_style", "notes", "servings"]),
    );
  });

  it("uses boolean flags and jsonb, not integer 0/1 or text json", async () => {
    const meals = await sql`
      select column_name, data_type
      from information_schema.columns
      where table_schema = 'public' and table_name = 'meals'
        and column_name in ('pinned','draft','ingredients','plan_id')
    `;
    const byName = Object.fromEntries(meals.map((r) => [r.column_name, r.data_type]));
    expect(byName.pinned).toBe("boolean");
    expect(byName.draft).toBe("boolean");
    expect(byName.ingredients).toBe("jsonb");
    expect(byName.plan_id).toBe("uuid");
  });

  it("enables RLS and revokes authenticated table grants", async () => {
    const rls = await sql`
      select c.relname, c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = 'meals'
    `;
    expect(rls[0]?.relrowsecurity).toBe(true);
    const grants = await sql`
      select privilege_type
      from information_schema.role_table_grants
      where table_schema = 'public' and table_name = 'meals'
        and grantee in ('anon','authenticated')
    `;
    expect(grants).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run src/lib/schema.migration.test.ts
```

Expected: FAIL — `public.households` does not exist.

- [ ] **Step 4: Write `supabase/migrations/20260911120000_init.sql`**

Include every app table, FKs to `auth.users` / `households`, indexes, RLS policies using `(select auth.uid())`, UPDATE `USING` + `WITH CHECK`, then `revoke all on table ... from anon, authenticated` for each table.

Tables and essentials:

```sql
create table public.households (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null,
  diet_style text not null,
  notes text not null,
  servings integer not null
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  age integer not null,
  sex text,
  allergies jsonb not null default '[]'::jsonb,
  avoidances jsonb not null default '[]'::jsonb
);

create table public.kitchen_prefs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null unique references public.households (id) on delete cascade,
  expertise text not null,
  overall_diet text not null,
  breakfast_diet text not null,
  lunch_diet text not null,
  dinner_diet text not null,
  max_cook_minutes integer not null,
  involved text not null
);

create table public.kitchen_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  kind text not null,
  enabled boolean not null,
  built_in boolean not null
);

create table public.week_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  week_start text not null,
  is_current boolean not null,
  slot_mask jsonb not null,
  name text not null default '',
  favorited boolean not null default false,
  unique (household_id, week_start)
);
create unique index week_plans_one_current
  on public.week_plans (household_id) where is_current;

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  plan_id uuid,
  day text not null,
  slot text not null,
  title text not null,
  why_it_fits text not null,
  cook_minutes integer not null,
  method text not null,
  ingredients jsonb not null,
  steps jsonb not null,
  used_web_search boolean not null default false,
  pinned boolean not null default false,
  week_start text not null default '',
  created_at timestamptz not null default now(),
  source_url text,
  extras jsonb not null default '{}'::jsonb,
  draft boolean not null default false,
  stars smallint not null default 0,
  takeout boolean not null default false,
  leftover boolean not null default false
);

create table public.library_generate_prefs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null unique references public.households (id) on delete cascade,
  json jsonb not null
);

create table public.ai_settings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null unique references public.households (id) on delete cascade,
  mode text not null,
  base_url text not null,
  model text not null,
  custom_api_key text,
  developer_tools boolean not null,
  web_search boolean not null
);

create table public.ai_traces (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_at timestamptz not null,
  kind text not null,
  mode text not null,
  base_url text not null,
  model text not null,
  request_text text not null,
  response_text text not null,
  validation text not null
);

create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  generate_count integer not null default 0,
  primary key (user_id, day)
);

create index people_household_id_idx on public.people (household_id);
create index kitchen_items_household_id_idx on public.kitchen_items (household_id);
create index week_plans_household_week_idx on public.week_plans (household_id, week_start);
create index meals_household_id_idx on public.meals (household_id);
create index meals_library_idx on public.meals (household_id, slot, draft, created_at desc);
create index ai_traces_household_created_idx on public.ai_traces (household_id, created_at desc);
```

RLS helper pattern (repeat per table; households uses `owner_id = (select auth.uid())`; children use `household_id in (select id from public.households where owner_id = (select auth.uid()))`):

```sql
alter table public.households enable row level security;
create policy "households_select" on public.households for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "households_insert" on public.households for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "households_update" on public.households for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "households_delete" on public.households for delete to authenticated
  using (owner_id = (select auth.uid()));
revoke all on table public.households from anon, authenticated;
```

No `SECURITY DEFINER` functions. No grants to `anon`/`authenticated`.

Apply:

```bash
supabase db reset --yes
```

- [ ] **Step 5: Re-run migration test**

```bash
npx vitest run src/lib/schema.migration.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase src/lib/schema.migration.test.ts
git commit -m "chore: add supabase postgres schema with rls"
```

---

### Task 2: Drizzle Postgres client and test identity helper

**Files:**
- Modify: `src/lib/schema.ts`
- Modify: `src/lib/db.ts`
- Modify: `src/lib/types.ts` (only if required for schema types; `Meal.planId` becomes `string | null` in Task 4)
- Create: `src/lib/test-identity.ts`
- Create: `src/lib/db.test.ts`
- Modify: `package.json`, `next.config.ts`, `vitest.config.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces:
  - `getDb(): AppDb` — drizzle postgres-js, `prepare: false`
  - `resetDbForTests(): Promise<void>` — truncates app tables only
  - `createTestIdentity(email?: string): Promise<{ userId: string; email: string; householdId: string }>` — admin-creates `auth.users` + empty household
  - `deleteTestUser(userId: string): Promise<void>`
- Consumes: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (tests/server only)

- [ ] **Step 1: Install deps**

```bash
npm install postgres @supabase/supabase-js @supabase/ssr
npm install -D dotenv
npm uninstall better-sqlite3
npm install -D better-sqlite3 @types/better-sqlite3
```

`better-sqlite3` stays **devDependency** for Task 8. Remove `serverExternalPackages: ["better-sqlite3"]` from `next.config.ts`.

`vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
    setupFiles: ["src/lib/test-setup.ts"],
    testTimeout: 15000,
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

`src/lib/test-setup.ts`:

```ts
import { config } from "dotenv";
config({ path: ".env.local" });
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
}
```

`.env.example`:

```
XAI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
DATABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 2: Write failing client test**

```ts
// src/lib/db.test.ts
import { afterAll, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "./db";
import { households } from "./schema";
import { createTestIdentity, deleteTestUser } from "./test-identity";

describe("postgres db", () => {
  let userId = "";
  afterAll(async () => {
    if (userId) await deleteTestUser(userId);
    await resetDbForTests();
  });

  it("createTestIdentity inserts a household owned by that user", async () => {
    const ident = await createTestIdentity();
    userId = ident.userId;
    const db = getDb();
    const rows = await db.select().from(households);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.ownerId).toBe(ident.userId);
    expect(ident.householdId).toBe(rows[0]?.id);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run src/lib/db.test.ts
```

Expected: FAIL — `createTestIdentity` / postgres `getDb` not defined, or sqlite `.get()` still in `db.ts`.

- [ ] **Step 4: Replace `src/lib/schema.ts` with `pgTable`**

Use `uuid`, `text`, `integer`, `boolean`, `smallint`, `jsonb`, `timestamp` from `drizzle-orm/pg-core`. Column names stay camelCase in TS (`ownerId`, `dietStyle`) mapped to snake_case (`owner_id`, `diet_style`).

Meals:

```ts
ingredients: jsonb("ingredients").$type<Ingredient[]>().notNull(),
steps: jsonb("steps").$type<string[]>().notNull(),
extras: jsonb("extras").$type<MealExtras>().notNull(),
planId: uuid("plan_id"),
pinned: boolean("pinned").notNull().default(false),
```

People: `allergies: jsonb("allergies").$type<string[]>().notNull()`.

- [ ] **Step 5: Replace `src/lib/db.ts`**

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "./schema";

export type AppDb = ReturnType<typeof drizzle<typeof schema>>;

let client: ReturnType<typeof postgres> | null = null;
let db: AppDb | null = null;

export function getDb(): AppDb {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  client = postgres(url, { prepare: false, max: 5 });
  db = drizzle(client, { schema });
  return db;
}

export async function resetDbForTests(): Promise<void> {
  const database = getDb();
  await database.execute(sql`
    truncate table
      public.ai_usage,
      public.ai_traces,
      public.ai_settings,
      public.library_generate_prefs,
      public.meals,
      public.week_plans,
      public.kitchen_items,
      public.kitchen_prefs,
      public.people,
      public.households
    restart identity cascade
  `);
}
```

Delete `openDb`, `ensureSchema`, `MORTANG_DB_PATH`, sqlite cache.

`src/lib/test-identity.ts` uses `createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } })` then `auth.admin.createUser({ email, email_confirm: true })`, then insert household:

```ts
await db.insert(households).values({
  ownerId: user.id,
  name: "",
  dietStyle: "",
  notes: "",
  servings: 1,
}).returning();
```

`deleteTestUser`: `auth.admin.deleteUser(userId)` (cascades household).

Leave `Meal.planId` as `string` until Task 4 so the app still typechecks.

- [ ] **Step 6: Run db test**

```bash
npx vitest run src/lib/db.test.ts src/lib/schema.migration.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json next.config.ts vitest.config.ts .env.example src/lib
git commit -m "chore: switch drizzle client to supabase postgres"
```

---

### Task 3: Household and kitchen repos (async, scoped)

**Files:**
- Modify: `src/household/repo.ts`, `src/household/repo.test.ts` (create if missing)
- Modify: `src/kitchen/repo.ts`, `src/kitchen/prefs-repo.ts`
- Modify: `src/kitchen/prefs-repo.test.ts` (and kitchen repo tests if present)

**Interfaces:**
- Produces:
  - `getHouseholdForUser(userId: string): Promise<Household | null>`
  - `upsertHousehold(input: Omit<Household,"id"|"people"> & { id?: string; ownerId: string }): Promise<Household>`
  - `replacePeople(householdId: string, people: Omit<Person,"id">[]): Promise<Person[]>`
  - `listKitchen(householdId: string): Promise<KitchenItem[]>`
  - `seedKitchenIfEmpty(householdId: string): Promise<void>`
  - `setKitchenEnabled(householdId: string, id: string, enabled: boolean): Promise<void>`
  - `addCustomKitchenItem(householdId: string, name: string, kind: KitchenItem["kind"]): Promise<KitchenItem>`
  - `getKitchenPrefs(householdId: string): Promise<KitchenPrefs>`
  - `saveKitchenPrefs(householdId: string, patch: Partial<KitchenPrefs>): Promise<KitchenPrefs>`
- Temporary: keep `getHousehold()` as `select from households limit 1` so pages compile until Task 6.

- [ ] **Step 1: Write failing household tests**

```ts
// src/household/repo.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { createTestIdentity, deleteTestUser } from "@/lib/test-identity";
import { getHouseholdForUser, replacePeople, upsertHousehold } from "./repo";

const users: string[] = [];
afterEach(async () => {
  await resetDbForTests();
  await Promise.all(users.splice(0).map(deleteTestUser));
});

describe("household repo", () => {
  it("does not return another user's household", async () => {
    const a = await createTestIdentity("a@example.com");
    const b = await createTestIdentity("b@example.com");
    users.push(a.userId, b.userId);
    await upsertHousehold({
      ownerId: a.userId,
      id: a.householdId,
      name: "A",
      dietStyle: "omnivore",
      notes: "",
      servings: 2,
    });
    const seen = await getHouseholdForUser(b.userId);
    expect(seen?.name ?? "").not.toBe("A");
  });

  it("replacePeople is scoped to that household", async () => {
    const ident = await createTestIdentity();
    users.push(ident.userId);
    await replacePeople(ident.householdId, [
      { name: "Alex", age: 53, sex: "male", allergies: ["shellfish"], avoidances: [] },
    ]);
    const household = await getHouseholdForUser(ident.userId);
    expect(household?.people.map((p) => p.name)).toEqual(["Alex"]);
    expect(household?.people[0]?.allergies).toEqual(["shellfish"]);
  });
});
```

Kitchen test: two identities, `seedKitchenIfEmpty(a)` does not populate `listKitchen(b)`. Prefs: `saveKitchenPrefs(a, { overallDiet: "keto" })` does not change `getKitchenPrefs(b)`.

- [ ] **Step 2: Run tests — expect FAIL** (sync sqlite `.get()` / missing `ownerId`)

```bash
npx vitest run src/household/repo.test.ts src/kitchen/prefs-repo.test.ts
```

- [ ] **Step 3: Implement async repos**

- `JSON.parse(allergiesJson)` → use jsonb arrays directly.
- `enabled === 1` → `enabled` boolean.
- `db.transaction` stays; drizzle postgres transactions are async: `await db.transaction(async (tx) => { ... })`.
- `upsertHousehold` on insert sets `ownerId`. On conflict of unique `owner_id`, update the existing row for that owner (do not create a second household).
- Drop singleton `id = "default"` for kitchen prefs; use `household_id`.

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/household/repo.test.ts src/kitchen
```

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: scope household and kitchen repos by owner"
```

---

### Task 4: Meals, settings, traces, library-prefs repos

**Files:**
- Modify: `src/meals/repo.ts`, `src/meals/repo.test.ts`
- Modify: `src/ai/settings-repo.ts`, `src/ai/settings-repo.test.ts`
- Modify: `src/ai/traces.ts`, `src/ai/traces.test.ts`
- Modify: `src/meals/library-prefs.ts`
- Modify: any `planId === ""` checks in `src/meals/*` to `planId == null`

**Interfaces:**
- Every meals repo function takes `householdId: string` as the first argument (or `input.householdId`).
- Change `Meal.planId` in `src/lib/types.ts` to `string | null`. `saveStandaloneMeal` / `saveDraftMeals` / `saveImportedMeal` insert `planId: null`. Replace every `planId === ""` with `planId == null`.
- `listAllMeals(householdId)` / `listLibraryMeals(householdId, slot)` / `listDraftMeals(householdId)` never cross households.
- `getCurrentPlan(householdId)` uses the partial unique current index.
- `getSettings(householdId)`, `saveSettings(householdId, patch)` — one row per household; `customApiKey` still returned to handlers (HTTP layer keeps boolean).
- `recordTrace({ householdId, ... })` trims to last 25 **per household**.
- `getLibraryGeneratePrefs(householdId)` / `saveLibraryGeneratePrefs(householdId, value)` store jsonb (no `JSON.stringify` string column).

- [ ] **Step 1: Convert `src/meals/repo.test.ts` to Postgres identity**

Remove `MORTANG_DB_PATH` temp file. `beforeAll`/`afterEach`:

```ts
let ident: Awaited<ReturnType<typeof createTestIdentity>>;
beforeAll(async () => {
  ident = await createTestIdentity();
});
afterEach(async () => {
  await resetDbForTests();
});
afterAll(async () => {
  await deleteTestUser(ident.userId);
});
```

Port the existing cases. Representative new cases (write these first so they fail):

```ts
it("listLibraryMeals does not return another household's dinner", async () => {
  const other = await createTestIdentity("other@example.com");
  await saveStandaloneMeal(ident.householdId, {
    meal: meal({ title: "Mine", slot: "dinner" }),
    slot: "dinner",
  });
  await saveStandaloneMeal(other.householdId, {
    meal: meal({ title: "Theirs", slot: "dinner" }),
    slot: "dinner",
  });
  const mine = await listLibraryMeals(ident.householdId, "dinner");
  expect(mine.map((m) => m.title)).toEqual(["Mine"]);
  await deleteTestUser(other.userId);
});

it("saveStandaloneMeal stores plan_id null", async () => {
  const saved = await saveStandaloneMeal(ident.householdId, {
    meal: meal({ title: "Typed chili" }),
    slot: "dinner",
  });
  expect(saved.planId).toBeNull();
});
```

Keep existing behavior tests: mergeGeneratedPlan leaves pinned meals, fill/place/leftover/takeout, drafts, stars, extras. Every call gets `ident.householdId`. `mapMeal` reads booleans and jsonb (no `JSON.parse` on ingredients unless still strings).

Settings test: two households have independent `model`. Traces test: recording 26 traces in A leaves B empty and A at 25.

- [ ] **Step 2: Run meals/settings/traces tests — expect FAIL**

```bash
npx vitest run src/meals/repo.test.ts src/ai/settings-repo.test.ts src/ai/traces.test.ts
```

- [ ] **Step 3: Implement**

`mealInsertValues` must include `householdId`, booleans (`usedWebSearch: boolean`), `ingredients: meal.ingredients` (jsonb), `planId: string | null`.

`titleTaken(householdId, title, exceptId?)` only looks at that household’s catalog.

`dedupeLibraryMeals(householdId)` compares within household; standalone is `planId === null`.

Traces trim SQL:

```sql
delete from ai_traces
where household_id = ${householdId}
  and id not in (
    select id from ai_traces
    where household_id = ${householdId}
    order by created_at desc
    limit 25
  )
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/meals/repo.test.ts src/ai/settings-repo.test.ts src/ai/traces.test.ts
```

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: scope meals settings and traces by household"
```

---

### Task 5: Magic link auth (invite-only)

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`
- Create: `src/middleware.ts`
- Create: `src/app/login/page.tsx`, `src/app/login/login-form.tsx`
- Create: `src/app/auth/confirm/route.ts`
- Create: `src/app/logout/route.ts`
- Create: `src/app/login/login-form.test.tsx` (`// @vitest-environment happy-dom`)
- Create: `src/lib/supabase/middleware.test.ts`

**Interfaces:**
- `createBrowserClient` / `createServerClient` from `@supabase/ssr` with `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Middleware: `getClaims()`. No claims → `/login`. Public: `/login`, `/auth`, `/logout`, static.
- Login: `signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: origin + '/auth/confirm' } })`. Same success copy whether or not the email exists: `"If that address can sign in, check your inbox."`
- Confirm: `verifyOtp({ type: 'email', token_hash })` then redirect `/` (or `/login` on error).
- Logout: `signOut()` then redirect `/login`.

- [ ] **Step 1: Write failing login form test**

```tsx
// src/app/login/login-form.test.tsx
// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithOtp: vi.fn().mockResolvedValue({ error: null }) },
  }),
}));

import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  it("asks for an email and offers a magic link", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/email/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /email me a link/i })).toBeTruthy();
  });
});
```

Middleware unit test: given `getClaims()` empty and path `/`, the helper `updateSession` returns a redirect to `/login`. Given path `/login`, it does not redirect.

- [ ] **Step 2: Run tests — expect FAIL** (files missing)

```bash
npx vitest run src/app/login/login-form.test.tsx
```

- [ ] **Step 3: Implement**

Copy cookie `getAll`/`setAll` from the current Supabase Next.js SSR guide (`createBrowserClient`, `createServerClient`, `updateSession`). Server `setAll` swallows errors in Server Components; middleware writes cookies + cache headers from the second `setAll` argument.

`login-form.tsx`: client component, olive/linen, `input` + `btn` classes, `page-title` “Sign in”. On submit call `signInWithOtp` as specified.

`src/app/auth/confirm/route.ts` (Route Handler GET):

```ts
const token_hash = request.nextUrl.searchParams.get("token_hash");
const type = request.nextUrl.searchParams.get("type");
if (!token_hash || type !== "email") redirect("/login");
const supabase = await createClient();
const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash });
redirect(error ? "/login" : "/");
```

`src/middleware.ts` matcher skips `_next/static`, `_next/image`, favicon, images.

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/app/login/login-form.test.tsx src/lib/supabase
```

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: add invite-only magic link auth"
```

---

### Task 6: Wire handlers, pages, and nav to the signed-in household

**Files:**
- Create: `src/lib/request-auth.ts`
- Modify: `src/ai/http.ts`, `src/meals/http.ts`
- Modify: every `src/app/api/**/route.ts` that calls those handlers
- Modify: `src/app/layout.tsx`, `src/components/nav.tsx`, `src/components/app-shell.tsx`
- Modify: `src/app/page.tsx`, `setup/page.tsx`, `household/page.tsx`, `household/actions.ts`, `kitchen/page.tsx`, `kitchen/actions.ts`, `meals/page.tsx`, `meals/[id]/page.tsx`, `meals/new/page.tsx`, `shopping-list/page.tsx`, `settings/page.tsx`, `developer/page.tsx`
- Modify: `src/app/api/smoke.test.ts`, `src/meals/http.import.test.ts`
- Delete temporary `getHousehold()` (first-row) from `src/household/repo.ts`

**Interfaces:**

```ts
export type Authed = { userId: string; householdId: string };

export async function requireUser(): Promise<
  { ok: true; userId: string } | { ok: false; result: HttpResult }
>;

export async function requireHousehold(): Promise<
  | { ok: true; userId: string; householdId: string; household: Household }
  | { ok: false; result: HttpResult }
>;

// HandlerDeps in src/ai/http.ts and meals/http.ts:
auth?: Authed;
```

If `deps.auth` is set (tests), use it. Else `requireHousehold()` via cookies. Missing session → **401** `"Sign in to continue."`. Session but no household on generate/meals APIs → **400** `"Add a household before generating."` HTML pages: `redirect("/login")` / `redirect("/setup")`.

`/setup` is authenticated and does **not** require a household. `saveHouseholdAction` uses `upsertHousehold({ ownerId: userId, ... })` then `seedKitchenIfEmpty(household.id)`.

`HandlerDeps` / each `handleX` becomes `async` and takes `householdId` through auth. `handleGetSettings` uses that household’s row.

Layout: async. Load claims; if user, `getHouseholdForUser` then `getSettings(householdId)` for developerTools. Pass `userEmail` into `Nav`. Nav shows email + a Log out control (`<form action="/logout" method="post">`) on every page except `/login`.

- [ ] **Step 1: Write failing smoke/auth tests**

In `src/app/api/smoke.test.ts` replace temp sqlite with `createTestIdentity`. Pass `{ auth: { userId, householdId } }` into every handler. `upsertHousehold` / `replacePeople` / `seedKitchenIfEmpty` use that household.

Add:

```ts
it("generate without auth is 401", async () => {
  const result = await handleGenerate(
    { slotMask: allDinners() },
    { complete: async () => ({ ok: true, text: "{}" }) },
  );
  expect(result.status).toBe(401);
});

it("user B cannot list user A's library", async () => {
  await handleCreateMeal(
    {
      slot: "dinner",
      title: "A only",
      whyItFits: "x",
      cookMinutes: 20,
      method: "pot",
      ingredients: [{ name: "beans", quantity: "1", unit: "can", aisle: "pantry" }],
      steps: ["Cook"],
    },
    { auth: a },
  );
  const listed = await handleListLibrary("dinner", { auth: b });
  expect((listed.body as { meals: { title: string }[] }).meals).toEqual([]);
});
```

Add `src/lib/rls.test.ts`:

```ts
it("Data API cannot read meals as authenticated", async () => {
  const ident = await createTestIdentity();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const client = createClient(url, anon);
  const { data, error } = await client.from("meals").select("*");
  expect(data ?? []).toEqual([]);
  expect(error).toBeTruthy();
  await deleteTestUser(ident.userId);
});
```

Server-role Drizzle in the same file: insert meals for A and B, `getDb().select().from(meals)` returns both (bypass is expected). `listLibraryMeals(a.householdId, "dinner")` returns only A's.

Make `handleListLibrary` / `handleCreateMeal` async and accept `deps.auth`.

- [ ] **Step 2: Run smoke test — expect FAIL** (401 path missing, handlers still global)

```bash
npx vitest run src/app/api/smoke.test.ts src/meals/http.import.test.ts
```

- [ ] **Step 3: Implement wiring**

- Route handlers: `const auth = await requireHousehold(); if (!auth.ok) return Response.json(auth.result.body, { status: auth.result.status });` then `handleX(body, { auth: { userId, householdId } })`.
- `loadReadyHousehold` uses `getHouseholdForUser` / `getKitchenPrefs(householdId)` from deps.auth, not the global row.
- Setup page: `seedKitchenIfEmpty(householdId)` only after household exists; first visit shows empty kitchen until save creates household + seed.
- First save on setup: create household for `ownerId`, seed kitchen, replace people.
- `getSettings()` with no household (login layout): developerTools false, skip DB.

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run
```

Expected: PASS. Grep for leftover sqlite APIs and unscoped reads: `.get()`, `.all()`, `.run()`, `planId === ""`, `getHousehold()`, `MORTANG_DB_PATH`. None should remain.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git commit -am "feat: require magic link session on every household"
```

---

### Task 7: Per-user AI daily cap and maxDuration

**Files:**
- Create: `src/ai/usage.ts`, `src/ai/usage.test.ts`
- Modify: `src/ai/http.ts` (`handleGenerate`, `handleGenerateLibrary`, `handleImportRecipe` lives in meals/http — cap there too, `handleSwap`, `handleGenerateExtra`)
- Modify: `src/app/api/generate/route.ts`, `library/generate/route.ts`, `import/route.ts`, `swap/route.ts`, `extra/route.ts`

**Interfaces:**

```ts
export const AI_DAILY_CAP = 10;

export async function consumeAiQuota(input: {
  userId: string;
  settings: AiSettings;
}): Promise<{ ok: true } | { ok: false; result: HttpResult }>;
```

UTC `day = new Date().toISOString().slice(0, 10)`. If `settings.mode === "custom"` and `settings.customApiKey` is non-empty, return `{ ok: true }` without incrementing. Else increment `ai_usage.generate_count` for `(userId, day)` and if the **pre-increment** count is `>= AI_DAILY_CAP`, return 429 `{ message: "Daily generate limit reached. Try again tomorrow." }` without calling the model.

Call `consumeAiQuota` at the start of generate, library generate, import, swap, extra — after auth, before `complete`.

Each of those route files:

```ts
export const maxDuration = 300;
```

- [ ] **Step 1: Write failing usage tests**

```ts
// src/ai/usage.test.ts
import { afterEach, describe, expect, it } from "vitest";
import { resetDbForTests } from "@/lib/db";
import { createTestIdentity, deleteTestUser } from "@/lib/test-identity";
import { AI_DAILY_CAP, consumeAiQuota } from "./usage";

const grok = {
  mode: "grok" as const,
  baseUrl: "https://api.x.ai/v1",
  model: "grok-4.6",
  customApiKey: null,
  developerTools: false,
  webSearch: false,
};

describe("consumeAiQuota", () => {
  afterEach(resetDbForTests);

  it("allows AI_DAILY_CAP calls then 429s", async () => {
    const ident = await createTestIdentity();
    let last: Awaited<ReturnType<typeof consumeAiQuota>> = { ok: true };
    for (let i = 0; i < AI_DAILY_CAP; i++) {
      last = await consumeAiQuota({ userId: ident.userId, settings: grok });
      expect(last.ok).toBe(true);
    }
    last = await consumeAiQuota({ userId: ident.userId, settings: grok });
    expect(last.ok).toBe(false);
    if (!last.ok) expect(last.result.status).toBe(429);
    await deleteTestUser(ident.userId);
  });

  it("does not cap custom-provider keys", async () => {
    const ident = await createTestIdentity();
    const settings = { ...grok, mode: "custom" as const, customApiKey: "sk-test" };
    for (let i = 0; i < AI_DAILY_CAP + 2; i++) {
      const result = await consumeAiQuota({ userId: ident.userId, settings });
      expect(result.ok).toBe(true);
    }
    await deleteTestUser(ident.userId);
  });
});
```

Smoke: mock `complete` 11 times on `handleGenerate` with grok settings; 11th is 429 and `getCurrentPlan(householdId)` unchanged from the 10th.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run src/ai/usage.test.ts
```

- [ ] **Step 3: Implement `consumeAiQuota` + call sites + `maxDuration`**

Use `insert ... on conflict (user_id, day) do update set generate_count = ai_usage.generate_count + 1 returning generate_count`. If the returned count is `> AI_DAILY_CAP`, treat as 429 (the increment already happened — **instead** check first):

```ts
const existing = await db.select().from(aiUsage)
  .where(and(eq(aiUsage.userId, userId), eq(aiUsage.day, day)))
  .then((rows) => rows[0]);
if ((existing?.generateCount ?? 0) >= AI_DAILY_CAP) {
  return { ok: false, result: { status: 429, body: { message: "Daily generate limit reached. Try again tomorrow." } } };
}
// then increment
```

Never increment on 429. Never call `complete` on 429.

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/ai/usage.test.ts src/app/api/smoke.test.ts
```

- [ ] **Step 5: Commit**

```bash
git commit -am "feat: cap shared-key AI usage per user per day"
```

---

### Task 8: SQLite import script

**Files:**
- Create: `scripts/import-sqlite.ts`
- Create: `scripts/import-sqlite.test.ts`
- Create: `scripts/fixtures/tiny-household.db` generated in the test (do not commit a binary if the test builds it)

**Interfaces:**

```ts
export async function importSqlite(input: {
  dbPath: string;
  email: string;
  force?: boolean;
}): Promise<{ meals: number; plans: number }>;
```

CLI: `npx tsx scripts/import-sqlite.ts --email you@example.com [--db data/mortang.db] [--force]`

Behavior from spec: resolve `auth.users` by email, then household by `owner_id`. Fail if missing. If household already has meals and `force` is false, throw `"Household already has meals. Re-run with --force."`. `--force` deletes that household’s people, kitchen, plans, meals, prefs, settings, traces, usage (not `auth.users`). Copy all sqlite rows; `plan_id ''` → `null`; integer flags → boolean; json text → parsed jsonb.

- [ ] **Step 1: Write failing test using better-sqlite3 fixture**

```ts
// scripts/import-sqlite.test.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { getDb, resetDbForTests } from "@/lib/db";
import { meals } from "@/lib/schema";
import { createTestIdentity, deleteTestUser } from "@/lib/test-identity";
import { upsertHousehold } from "@/household/repo";
import { importSqlite } from "./import-sqlite";

function writeFixture(file: string) {
  const sqlite = new Database(file);
  sqlite.exec(`
    create table households (id text primary key, name text, diet_style text, notes text, servings integer);
    create table meals (
      id text primary key, plan_id text, day text, slot text, title text,
      why_it_fits text, cook_minutes integer, method text,
      ingredients_json text, steps_json text, used_web_search integer,
      pinned integer, week_start text, created_at text, source_url text,
      extras_json text, draft integer, stars integer, takeout integer, leftover integer
    );
  `);
  sqlite.prepare(
    `insert into households values ('h1','Mortang','omnivore','',2)`,
  ).run();
  sqlite.prepare(
    `insert into meals values ('m1','','monday','dinner','Imported stew','fits',30,'pot','[]','[]',0,0,'','2026-01-01T00:00:00.000Z',null,'{}',0,0,0,0)`,
  ).run();
  sqlite.close();
}

describe("importSqlite", () => {
  afterEach(resetDbForTests);

  it("copies sqlite meals onto the email's household", async () => {
    const ident = await createTestIdentity("owner@example.com");
    await upsertHousehold({
      ownerId: ident.userId,
      id: ident.householdId,
      name: "x",
      dietStyle: "x",
      notes: "",
      servings: 1,
    });
    const file = path.join(os.tmpdir(), `import-${crypto.randomUUID()}.db`);
    writeFixture(file);
    const result = await importSqlite({ dbPath: file, email: ident.email });
    expect(result.meals).toBe(1);
    const rows = await getDb().select().from(meals);
    expect(rows[0]?.title).toBe("Imported stew");
    expect(rows[0]?.planId).toBeNull();
    expect(rows[0]?.householdId).toBe(ident.householdId);
    fs.rmSync(file, { force: true });
    await deleteTestUser(ident.userId);
  });

  it("refuses a second import without force", async () => {
    const ident = await createTestIdentity("owner2@example.com");
    await upsertHousehold({
      ownerId: ident.userId,
      id: ident.householdId,
      name: "x",
      dietStyle: "x",
      notes: "",
      servings: 1,
    });
    const file = path.join(os.tmpdir(), `import-${crypto.randomUUID()}.db`);
    writeFixture(file);
    await importSqlite({ dbPath: file, email: ident.email });
    await expect(
      importSqlite({ dbPath: file, email: ident.email }),
    ).rejects.toThrow(/already has meals/i);
    fs.rmSync(file, { force: true });
    await deleteTestUser(ident.userId);
  });
});
```

The importer reads these SQLite tables when present: `households`, `people`, `kitchen_prefs`, `kitchen_items`, `week_plans`, `meals`, `library_generate_prefs`, `ai_settings`, `ai_traces`. Skip a table if `sqlite.prepare("select 1 from " + table)` throws. Map `plan_id ''` → `null`, `0/1` integers → boolean, `*_json` text → parsed objects. Do not import `ai_usage`.

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run scripts/import-sqlite.test.ts
```

- [ ] **Step 3: Implement `importSqlite` + CLI argv parse (`--email`, `--db`, `--force`)**

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -am "chore: add sqlite to supabase import script"
```

---

### Task 9: Docs and production wiring notes

**Files:**
- Modify: `README.md`, `AGENTS.md`, `.env.example` (if anything missing)

**Interfaces:** none. Docs only.

- [ ] **Step 1: Rewrite README setup**

1. Copy `.env.example` → `.env.local`
2. `supabase start`
3. Fill `NEXT_PUBLIC_SUPABASE_URL`, publishable key, `DATABASE_URL` (pooler for `npm run dev`, direct 54322 also fine locally), `XAI_API_KEY`
4. Invite your email in Studio (Authentication → Users) because signup is off
5. `npm run dev` → `http://localhost:3000/login`
6. Magic link in Inbucket `http://localhost:54324`
7. Production: Vercel + hosted Supabase; set the same env vars; Auth URL allowlist; **do not** point preview deploys at the production DB; `maxDuration` already in routes
8. After first hosted login: `npx tsx scripts/import-sqlite.ts --email you@example.com --db data/mortang.db`
9. Hosted Auth email template (Magic link) must use PKCE: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`

- [ ] **Step 2: Update AGENTS.md**

Replace SQLite / one-household / no-auth bullets with:

- Supabase Postgres, Drizzle postgres.js, `DATABASE_URL`
- Magic link, invite-only, `households.owner_id`
- Tests: local `supabase start`, `createTestIdentity`, no `MORTANG_DB_PATH`
- AI on Node routes, `maxDuration = 300`, `AI_DAILY_CAP`, no Edge
- `better-sqlite3` is import-script only

Keep the product flows (generate merge, pins, library, shopping list) unchanged.

- [ ] **Step 3: Run `npx vitest run` and `npx tsc --noEmit`**

Expected: PASS / clean.

- [ ] **Step 4: Commit**

```bash
git commit -am "docs: describe supabase auth and vercel hosting"
```

---

## Execution notes

- Work on `feat/supabase-vercel` in a git worktree.
- If `supabase start` is not running, Task 1+ tests fail with a connection error — start it, do not mock Postgres.
- Hosted Vercel/Supabase project creation is dashboard work after Task 9, not a code task: create projects, `supabase link`, `supabase db push`, set env, invite yourself, run the import script.
- Open signup, shared households, and Netlify stay out of scope.

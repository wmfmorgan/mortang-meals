# Mortang Meals — Supabase + Vercel migration

Date: 2026-09-11
Status: Approved design — not yet implemented
Supersedes: local-only SQLite, no-auth model in [`AGENTS.md`](../../../AGENTS.md) once this ships

## Goal

Host Mortang Meals so invited people can open a public URL, sign in with a magic link, and use their own household (plans, library, shopping list, generate) without sharing data. Keep the current product: one Next.js app, browser never calls an AI provider, generate stays an in-tab NDJSON stream.

Success: you invite an email in the Supabase dashboard, that person clicks a magic link, completes setup, generates a week, and shops. Your existing `data/mortang.db` can be imported once into your account.

## Non-goals (v1)

- Shared households / member invites
- Open signup
- Netlify (or Netlify Identity / Netlify Database)
- Edge Functions for AI (Vercel Edge, Netlify Edge, or Supabase Edge)
- Clerk, Auth0, or any auth besides Supabase magic links
- Billing / Stripe
- Dual SQLite + Postgres runtime
- In-app invite UI
- Browser access to the Supabase Data API

## Key decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Host | Vercel, Node Fluid Compute | Next.js native; 300s default timeout; streaming without Edge. Netlify sync functions die at 60s, which week generate + web search + retry will exceed. |
| AI runtime | Existing Next.js `/api/*` handlers | Adapter, Zod validation, retry, and NDJSON progress already live here. Edge has no benefit and several hard limits. |
| Database | Supabase Postgres | Hosted + local (`supabase start`). Replaces `better-sqlite3`. |
| Auth | Supabase magic link, invite-only | `signInWithOtp` with `shouldCreateUser: false`. New users via dashboard invite. |
| Tenancy | One login, one household | `households.owner_id = auth.users.id`, unique. Every child table has `household_id`. |
| Data access | Drizzle on the server | Browser still only hits our routes. Repos become async and take `householdId`. |
| AI bill | Shared `XAI_API_KEY` + daily cap | Invite-only, so the guest list is small. Cap before inviting anyone besides you. Custom-provider key skips the cap. |
| Existing data | One-shot SQLite import script | Maps `data/mortang.db` onto the household for a given email. |

## Architecture

```
Browser
  │  session cookies (PKCE)
  ▼
Next.js on Vercel (Node / Fluid Compute)
  ├── pages + server actions (household, kitchen)
  ├── /api/* (meals, generate, swap, import, library, …)
  ├── @supabase/ssr → Auth
  └── Drizzle + postgres.js → Postgres transaction pooler (:6543)
         │
         ▼
Supabase
  ├── Auth (magic links; Inbucket locally)
  └── Postgres + RLS (defense in depth; Data API grants revoked)
```

Hard rules that stay:

- Browser talks only to this app. Never to xAI. Never to PostgREST for app tables.
- `XAI_API_KEY` is an env var on Vercel / `.env.local`. Not in git. Not in Postgres.
- `better-sqlite3` is not a production dependency. It may remain a **devDependency** for the import script only.
- `src/app/layout.tsx` stays `force-dynamic`. Do not cache authenticated HTML.
- Automated tests mock `complete`. No live model calls.
- Domain modules (allergen, duplicates, brief, shopping-list, catalog, week, slot-mask) stay pure and synchronous.

## Auth

### Routes

| Path | Role |
| --- | --- |
| `/login` | Email field. “Email me a link.” |
| `/auth/confirm` | PKCE exchange: `verifyOtp({ token_hash, type: 'email' })`, then redirect. |
| `/logout` | `signOut`, redirect `/login`. |

Login calls:

```ts
supabase.auth.signInWithOtp({
  email,
  options: {
    shouldCreateUser: false,
    emailRedirectTo: `${origin}/auth/confirm`,
  },
})
```

Unknown emails get a generic “If that address can sign in, check your inbox” message. Do not reveal whether the email exists.

### Middleware

This repo is Next.js 15. Use `src/middleware.ts` (not `proxy.ts`).

- Public: `/login`, `/auth/*`, static assets.
- Everything else: `supabase.auth.getClaims()`. No claims → redirect `/login`.
- Never trust `getSession()` on the server.
- After login, pages that need a household (`/`, `/meals`, `/shopping-list`, `/kitchen`, `/household`, `/settings`, `/developer`) redirect to `/setup` when none exists. `/setup` is authenticated but does not require a household.

### Invites

v1: Supabase dashboard → Invite user. That email creates the `auth.users` row. No in-app invite UI. After they accept the invite, later visits use magic links (`shouldCreateUser: false`).

### Email / URLs

- Local: Inbucket (`http://localhost:54324`).
- Hosted: PKCE magic-link template:

  `{SiteURL}/auth/confirm?token_hash={{ .TokenHash }}&type=email`

- Redirect allowlist: `http://localhost:3000/**`, production Vercel URL, later custom domain.

### Nav

Show signed-in email and a Log out control. Match olive/linen. No new design system.

## Schema

Source of truth: imperative SQL in `supabase/migrations/`. Drizzle `pgTable` in `src/lib/schema.ts` mirrors it. Never `drizzle-kit push` against hosted Postgres.

### Types

- Primary keys: `uuid` default `gen_random_uuid()`.
- Flags that were SQLite integers 0/1 become `boolean`: `is_current`, `favorited`, `enabled`, `built_in`, `used_web_search`, `pinned`, `draft`, `takeout`, `leftover`, `developer_tools`, `web_search`.
- `stars` stays `smallint` 0–5 (0 = unrated).
- Lists/objects: `jsonb` (allergies, avoidances, slot_mask, ingredients, steps, extras, library prefs json).
- Library / standalone meals: `plan_id uuid null` (replace today’s empty string). Every `plan_id = ""` check in repos becomes `plan_id is null`.
- `source_url`: `text null`.
- `day` / `slot` / `kind` / `aisle` stay text with the same app-level enums.

### Tables

**households**

- `id uuid pk`
- `owner_id uuid not null unique references auth.users(id) on delete cascade`
- `name`, `diet_style`, `notes`, `servings` (same meaning as today)

**people** — `household_id` + existing fields; `allergies jsonb`, `avoidances jsonb`

**kitchen_prefs** — one row per household (`household_id unique`) + existing fields

**kitchen_items** — `household_id` + name, kind, enabled, built_in

**week_plans** — `household_id` + week_start, is_current, slot_mask jsonb, name, favorited

- unique `(household_id, week_start)`
- unique partial index `(household_id) where is_current`

**meals** — `household_id` + existing recipe fields; `plan_id uuid null`; extras jsonb; boolean flags as above; `stars smallint`

**library_generate_prefs** — one row per household

**ai_settings** — one row per household; `custom_api_key text null`. Handlers still expose the key as a **boolean** only.

**ai_traces** — `household_id`; keep last 25 **per household**

**ai_usage** (new)

```sql
create table ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  generate_count integer not null default 0,
  primary key (user_id, day)
);
```

### Indexes

- `(household_id)` on every child table
- `(household_id, week_start)` on week_plans
- `(household_id, slot, draft, created_at desc)` on meals (library listing)

### RLS and grants

- `enable row level security` on every public app table.
- Policy shape: `TO authenticated`, `using` / `with check` via

  `household_id in (select id from households where owner_id = (select auth.uid()))`

  Households themselves: `owner_id = (select auth.uid())`.
- UPDATE policies always have both `USING` and `WITH CHECK`.
- **Revoke** table privileges from `anon` and `authenticated` on app tables. The Next.js server uses `DATABASE_URL` (bypasses RLS). RLS exists so enabling the Data API later cannot leak rows.
- Never authorize from `user_metadata`.
- No `SECURITY DEFINER` functions in `public`.

### Connections

- Server: `postgres` (postgres.js) with `prepare: false` against the **transaction pooler**.
- One module-level client. Do not open a new TCP connection per query.
- Env: `DATABASE_URL` (server only), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Prefer new publishable keys (`sb_publishable_…`) over legacy `anon`.

## Application changes

### Repos

Today they are synchronous SQLite (`.get()` / `.all()` / `.run()`). All repo functions become `async` and take `householdId: string` (or resolve it from `ownerId`).

`getHousehold()` is deleted. Replacements:

- `getHouseholdForUser(userId: string): Promise<Household | null>`
- Pages/handlers load the user from `@supabase/ssr`, then the household. 401 if no session; redirect `/setup` if no household (HTML) or 400 with a setup message (JSON APIs).

Setup `upsertHousehold` creates the row with `owner_id = auth.uid()`.

At most one `is_current` plan **per household**.

### Handlers

Existing HTTP handlers stay in `src/ai/http.ts` and `src/meals/http.ts`. They gain an auth+household preamble. Thin `src/app/api/*/route.ts` files stay thin.

Generate / swap / extra / library generate / import keep current validation, one retry, and “do not replace last good data on failure.”

AI routes set `export const maxDuration = 300`.

### Daily cap

Constant `AI_DAILY_CAP = 10` (easy to change). Count generate, library generate, import, and swap against the shared host key.

- Increment `ai_usage` for `(user_id, current date in UTC)` **before** the model call.
- If `generate_count >= AI_DAILY_CAP`, return 429: `"Daily generate limit reached. Try again tomorrow."`
- Skip the cap when settings `mode === 'custom'` and a custom key is set (they pay their provider).
- Extra suggestion/recipe counts as a generate for the cap (it calls the model). Pin/place/fill/leftover/takeout do not.

The existing NDJSON error event shows the 429 message. No job queue.

### Settings / traces

Per household. Developer nav still hidden unless that household’s `developerTools` is on. Traces never echo `Bearer` or `api_key=`.

## SQLite import

`scripts/import-sqlite.ts`:

1. Open `data/mortang.db` (or `--db path`) with `better-sqlite3`.
2. Require `--email`.
3. Resolve `households` where `owner_id` matches that user’s `auth.users` row. Fail if the user or household does not exist (log in / finish setup first).
4. If that household already has meals, refuse unless `--force` (force deletes that household’s people, kitchen, plans, meals, prefs, settings, traces, usage — not `auth.users`).
5. Copy household fields, people, kitchen items/prefs, week plans, meals (map `plan_id ''` → `null`), library prefs, ai settings, ai traces.
6. Dev-only. Not an API route.

## Testing

- Tests use **local Supabase Postgres**, not PGlite and not a temp SQLite file. `auth.users` is a real FK. `resetDbForTests()` truncates app tables and deletes test users it created; it does not wipe unrelated `auth.users`.
- HTTP smoke tests: fake `complete`, create an `auth.users` row + household in `beforeEach`, pass that identity into handlers (not a forged JWT).
- Auth: `/login` renders; unauthenticated `/` redirects; unknown email does not create a user.
- RLS: two JWT users; user A’s `authenticated` client cannot read user B’s meals. Drizzle-as-server-role **can** see all rows — that is expected; tests must not treat that as a leak.
- Cap: 10th generate succeeds, 11th is 429 and previous plan unchanged. Custom-key mode is not capped.
- Import: fixture sqlite → empty household; second run without `--force` fails; `--force` replaces.
- No live xAI.

## Local and production

**Local**

```
supabase start
# copy URL + publishable key + DATABASE_URL (pooler) into .env.local
npm run dev
```

Magic links in Inbucket. Local invites go through Studio (Authentication → Users → Invite) so `auth.users` matches production. Tests that need a user insert via `auth.admin` or a seed user, not by inventing JWT claims.

**Production**

1. Hosted Supabase project + Vercel project.
2. Preview deploys must **not** use the production database (Supabase branch or a staging project).
3. Vercel env: `XAI_API_KEY`, `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Auth site URL + redirect URLs.
5. Invite your email. Confirm magic link. Run the import script.
6. Invite others only after the cap is live.

## PR plan

| PR | Title | Depends on | Ships |
| --- | --- | --- | --- |
| 1 | `chore: supabase postgres schema and drizzle client` | — | `supabase/` migrations, Drizzle pg, async `getDb()`, drop production sqlite. Tests against Postgres. App is not user-complete. |
| 2 | `feat: magic link auth and household scoping` | 1 | Login/confirm/logout, middleware, `owner_id`, every repo/handler scoped, setup creates household. |
| 3 | `feat: per-user AI daily cap` | 2 | `ai_usage`, 429 path, skip cap for custom keys, `maxDuration = 300`. |
| 4 | `chore: sqlite import script` | 2 | `scripts/import-sqlite.ts` + fixture test. |
| 5 | `chore: vercel production wiring` | 3, 4 | `.env.example`, README, AGENTS.md. Project creation in dashboards is a deploy step. |

## Docs to update when this ships

- `AGENTS.md` — stack, env, tenancy, auth, testing DB
- `README.md` — hosted setup, magic links, `supabase start`
- `.env.example` — the four public/server keys above (no secret values)
- `docs/BACKLOG.md` — optional later: open signup, shared household, in-app invites

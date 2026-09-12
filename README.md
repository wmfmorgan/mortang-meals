# Mortang Meals

Invite-only household meal planner. One household per user, a week of recipes, a meal library, and a shopping list. Runs on Next.js; the browser never calls an AI provider.

How the app works (read this before changing it): [AGENTS.md](./AGENTS.md)

## Local setup

This worktree’s `supabase/config.toml` uses **563xx** ports so it does not collide with other local Supabase projects (API `56321`, DB `56322`, Studio `56323`, Mailpit `56324`).

1. Copy `.env.example` → `.env.local`
2. `npm install` (use `npm install --legacy-peer-deps` if peer dependency resolution fails)
3. `supabase start`
4. Fill `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` — local API, e.g. `http://127.0.0.1:56321`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — from `supabase status`
   - `DATABASE_URL` — direct local DB is fine: `postgresql://postgres:postgres@127.0.0.1:56322/postgres` (hosted deploys should use the transaction pooler URL)
   - `XAI_API_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — needed for tests and the SQLite import script (`supabase status`)
5. Auth is **email + password** (no magic-link emails, no Google on the login page). Signup stays off.
   - Studio → Authentication → Users → Add user: set email, password, confirm email (or update an existing user and set a password).
6. `npm run dev` → `http://localhost:3000/login` → sign in with that email and password

```
npm test        # vitest (needs supabase start)
npm run build
```

Settings can point at a local OpenAI-compatible server instead of Grok.

## Production (Vercel + hosted Supabase)

Dashboard work — create the projects if they do not exist yet; this repo does not assume a linked Vercel project.

1. Create a hosted Supabase project and a Vercel project for this app.
2. Disable public signup (Authentication → Providers / Allow new users). Keep **Email** provider on. Invite-only = signup off + admin-created users with passwords (no magic-link OTP, no Google required for login).
3. `supabase link` then `supabase db push` (or apply `supabase/migrations/` in the dashboard).
4. Set Vercel env (Production; use a separate DB for Preview — **do not** point preview deploys at the production database). With the Vercel ↔ Supabase Marketplace integration, `POSTGRES_*` and `NEXT_PUBLIC_SUPABASE_*` are injected automatically; also set:
   - `XAI_API_KEY`
   - Optional `DATABASE_URL` (transaction pooler) — if omitted, the app uses `POSTGRES_PRISMA_URL` / `POSTGRES_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` only if you run the import script against hosted from a trusted machine (never expose it to the browser)
5. Auth URL allowlist can stay pointed at `/auth/confirm` for any leftover callback flows; password login does not need it day-to-day. Site URL may be the app origin.
6. Add or update yourself in Studio (Users) with email + password, email confirmed. Sign in once at `/login`.
7. Optional one-time migrate from the old local SQLite file. After first login/setup, run with **`--force`** (wipes that household’s app rows, not `auth.users`, then copies sqlite). Without `--force`, the empty current week from `openPlan` plus unique week constraints / duplicate people can fail the import:

   `npx tsx scripts/import-sqlite.ts --email you@example.com --db data/mortang.db --force`

AI routes already set `maxDuration = 300`. Shared-key usage is capped at `AI_DAILY_CAP = 10` per user per UTC day. No Supabase Edge Functions.

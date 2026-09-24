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
   - `SUPABASE_SERVICE_ROLE_KEY` — production household member emails on `/household`; also tests and the SQLite import script (`supabase status`). Never expose to the browser.
5. Auth is **email + password or magic link** (no Google). Signup stays off; magic link uses `shouldCreateUser: false`.
   - Studio → Authentication → Users → Add user: set email, optional password, confirm email (or update an existing user).
   - Magic-link emails land in **Mailpit** at `http://127.0.0.1:56324` (this repo’s local Supabase port). Open the message and follow the link through `/auth/confirm`.
6. `npm run dev` → `http://localhost:3000/login` → **Sign in** with email + password, or **Email me a link** (check Mailpit).

```
npm test        # vitest (needs supabase start)
npm run build
```

Settings can point at a local OpenAI-compatible server instead of Grok.

## Production (Vercel + hosted Supabase)

Dashboard work — create the projects if they do not exist yet; this repo does not assume a linked Vercel project.

1. Create a hosted Supabase project and a Vercel project for this app.
2. Disable public signup (Authentication → Providers / Allow new users). Keep **Email** provider on. Invite-only = signup off + admin-created users (password and/or magic link; no Google; app OTP uses `shouldCreateUser: false`).
3. Configure **custom SMTP** under Authentication → Emails (required for magic links on hosted). Without SMTP, password sign-in still works; magic-link emails will not send.
4. Auth URL configuration (Authentication → URL Configuration):
   - **Site URL** = `https://www.mortang.com` (canonical production origin)
   - **Redirect URLs** must include at least:
     - `https://www.mortang.com/auth/confirm`
     - `https://www.mortang.com/**`
     - optional: `https://mortang-meals.vercel.app/**` for the Vercel alias
   - Do **not** rely on `*.vercel.app` team deployment hostnames for magic links unless those exact origins are allowlisted.
5. Magic-link **email template** (Authentication → Emails → Magic Link) must use the token-hash confirm link — **not** the default `{{ .ConfirmationURL }}` verify link. Body example (same as `supabase/templates/magic_link.html`):

   ```html
   <h2>Sign in to Mortang Meals</h2>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Sign in</a></p>
   ```

   The default hosted template (`/auth/v1/verify?token=pkce_…`) needs a same-browser PKCE cookie and a matching allowlisted `redirect_to`; it commonly dumps users back on `/login`.
6. `supabase link` then `supabase db push` (or apply `supabase/migrations/` in the dashboard).
7. Set Vercel env (Production; use a separate DB for Preview — **do not** point preview deploys at the production database). With the Vercel ↔ Supabase Marketplace integration, `POSTGRES_*` and `NEXT_PUBLIC_SUPABASE_*` are injected automatically; also set:
   - `XAI_API_KEY`
   - `NEXT_PUBLIC_SITE_URL=https://www.mortang.com` — magic-link `emailRedirectTo` uses this instead of the current `*.vercel.app` host
   - Optional `DATABASE_URL` (transaction pooler) — if omitted, the app uses `POSTGRES_PRISMA_URL` / `POSTGRES_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` — required in production for household member emails on `/household` (and for tests / import script on a trusted machine; never expose to the browser). Without it the page still loads with “Unknown email”.
8. Add or update yourself in Studio (Users) with email, optional password, email confirmed. Sign in once at `/login` with password or magic link.
9. Optional one-time migrate from the old local SQLite file. After first login/setup, run with **`--force`** (wipes that household’s app rows, not `auth.users`, then copies sqlite). Without `--force`, the empty current week from `openPlan` plus unique week constraints / duplicate people can fail the import:

   `npx tsx scripts/import-sqlite.ts --email you@example.com --db data/mortang.db --force`

AI routes already set `maxDuration = 300`. Shared-key usage is capped at `AI_DAILY_CAP = 10` per user per UTC day. No Supabase Edge Functions.

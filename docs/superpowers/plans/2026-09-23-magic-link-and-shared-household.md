# Magic-link login + shared household — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore invite-only magic-link login alongside password sign-in, and let multiple Auth users share one household (same meals, plans, shopping list).

**Architecture:** Login offers `signInWithOtp` (magic link, `shouldCreateUser: false`) and existing `signInWithPassword`; `/auth/confirm` already exchanges tokens. Separately, `household_members` + invite codes let an owner add a partner who has no household yet; auth resolves `householdId` via membership.

**Tech Stack:** Next.js 15, Supabase Auth (OTP + password) + Postgres migrations, Drizzle, Vitest, existing olive/linen UI.

**Out of scope:** Change-password Account page. Open signup (`shouldCreateUser` stays false). Email-based household invites (in-app code/link only). Merging two meal libraries. Ownership transfer. Google OAuth.

## Global Constraints

- Invite-only Auth: admin creates users (dashboard invite or `auth.admin.createUser`); app never self-registers.
- Login: magic link **and** password on the same screen.
- Magic link: `signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: homedOrigin + '/auth/confirm' } })`. Generic success copy that does not reveal whether the email exists.
- One household per user (`household_members.user_id` unique).
- Join only when invitee has **no** household membership (join before completing solo `/setup`).
- Equal edit access for members; only household **owner** creates/revokes invites and removes members.
- Owner cannot remove themselves while other members remain.
- App-admin Settings (`isAdminEmail`) stays separate from household owner.
- Schema via `supabase/migrations/`; mirror in `src/lib/schema.ts`.
- Tests: mock/no live mail in unit tests; local Mailpit for manual magic-link checks; `createTestIdentity` for DB tests.
- Browser-verify all UI (login modes, join, shared Plans/Meals) before declaring done.
- Hosted Supabase needs working SMTP + redirect allowlist + magic-link email template pointing at `/auth/confirm?token_hash=…&type=email` (or `magiclink`).

## Approved product decisions

| Topic | Decision |
| --- | --- |
| Login UI | Magic link + password |
| Shared household | Membership table + invite code |
| Member permissions | Equal full access; owner manages membership |
| Join eligibility | Only accounts with no household yet |
| Password change / Account page | Deferred |
| Order in this plan | Magic link first (helps onboard partner), then shared household |

---

## Part A — Magic-link login (restore)

### Design

1. `/login` keeps email + password **Sign in**.
2. Add **Email me a link** (same email field). Calls `signInWithOtp` with `shouldCreateUser: false` and `emailRedirectTo` = `${window.location.origin}/auth/confirm`.
3. On OTP send success: show “If that address can sign in, check your inbox for a link.” Do not surface “user not found” distinctly when Supabase reveals it—normalize to the same message when possible.
4. `/auth/confirm` already handles `token_hash` + type (`email` | `magiclink` | `invite`), PKCE `code`, and implicit hash—keep it; extend tests only if login regressions appear.
5. Middleware already allows `/login` and `/auth/*`.
6. Docs: README + Agents.md — magic link + password; local Mailpit port **56324** (this repo); hosted SMTP required.
7. Login page lede: invite-only; use magic link or the password an admin set.

### File map (Part A)

| Path | Change |
| --- | --- |
| `src/app/login/login-form.tsx` | OTP button + password submit; pending states |
| `src/app/login/login-form.test.tsx` | Assert magic-link control + `signInWithOtp` call |
| `src/app/login/page.tsx` | Update lede copy |
| `README.md`, `Agents.md` | Document dual login; SMTP / Mailpit |
| `docs/superpowers/specs/2026-09-23-magic-link-and-shared-household-design.md` | Combined design record |

---

### Task 1: Login form — magic link + password

**Files:**
- Modify: `src/app/login/login-form.tsx`
- Modify: `src/app/login/login-form.test.tsx`
- Modify: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: `createClient().auth.signInWithPassword`, `signInWithOtp`
- Produces: dual-mode login UI

- [ ] **Step 1: Update failing/expanded tests**

Keep password sign-in tests. Change “no magic-link controls” to expect an “Email me a link” control. Add test: clicking it calls `signInWithOtp` with `shouldCreateUser: false` and `emailRedirectTo` ending in `/auth/confirm`. Add test: successful OTP shows inbox message without navigating away.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- src/app/login/login-form.test.tsx`

- [ ] **Step 3: Implement form**

```tsx
// Sketch — match existing field/button classes
async function sendMagicLink() {
  setPending(true);
  setStatus(null);
  const supabase = createClient();
  const origin = window.location.origin;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });
  setPending(false);
  if (error) {
    setStatus(error.message); // or normalize unknown-user to generic copy
    return;
  }
  setStatus("If that address can sign in, check your inbox for a link.");
}
```

Password field: keep `required` only for password submit (use two buttons: `type="submit"` Sign in, `type="button"` Email me a link). For magic link, do not require password. HTML5: remove `required` from password; validate password non-empty only in password submit handler.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Browser verify login**

Local: `npm run dev` + `supabase start`. Create/confirm test user. Password sign-in still works. Magic link: trigger OTP, open Mailpit `http://127.0.0.1:56324`, click link, land signed in via `/auth/confirm`. Mobile viewport on `/login`.

- [ ] **Step 6: Commit**

```bash
git add src/app/login
git commit -m "feat(auth): restore magic-link login beside password"
```

---

### Task 2: Auth docs for magic link (local + hosted)

**Files:**
- Modify: `README.md`, `Agents.md`
- Create: `docs/superpowers/specs/2026-09-23-magic-link-and-shared-household-design.md` (Parts A+B design; can land once at end of Task 2 or Task 7)

- [ ] **Step 1: Update Agents.md Auth bullet** — invite-only email+password **or** magic link; no Google; signup off; `shouldCreateUser: false`.
- [ ] **Step 2: Update README** — dual login; Mailpit 56324; hosted SMTP + redirect URLs + email template `{SiteURL}/auth/confirm?token_hash={{ .TokenHash }}&type=email`.
- [ ] **Step 3: Commit docs (or fold into final docs task if preferred)**

```bash
git add README.md Agents.md docs/superpowers/specs/2026-09-23-magic-link-and-shared-household-design.md
git commit -m "docs: magic-link + password auth"
```

---

## Part B — Shared household membership

### Design (approved earlier)

- Tables: `household_members` (`owner` | `member`, unique `user_id`), `household_invites` (8-char code, 7-day expiry, single-use, revocable).
- Backfill owners into `household_members`.
- `getHouseholdForUser` via membership join; `upsertHousehold` creates owner membership.
- Owner on Household: members list (emails via service role), create/revoke invite, remove member.
- `/join?code=` accept; setup wizard links “Have an invite code?” when no household.
- RLS: `is_household_member(household_id)` helper; policies allow members (app uses privileged `DATABASE_URL`, still update for correctness).

### File map (Part B)

| Path | Responsibility |
| --- | --- |
| `supabase/migrations/20260923120000_household_members.sql` | Tables, backfill, RLS |
| `src/lib/schema.ts` | Drizzle mirrors |
| `src/household/repo.ts` | Membership-aware lookup + owner row on upsert |
| `src/household/members-repo.ts` | Invites + members CRUD/accept |
| `src/lib/test-identity.ts` | Seed owner membership |
| `src/lib/supabase/admin.ts` | Shared service-role client (extract from test-identity) |
| `src/app/household/actions.ts` | create/revoke/remove/accept actions |
| `src/app/household/household-members.tsx` | UI section |
| `src/app/household/page.tsx` | Wire section |
| `src/app/join/*` | Join page |
| `src/app/setup/setup-wizard.tsx` | Link to `/join` |

---

### Task 3: Migration + resolve household by membership

**Files:** migration, `schema.ts`, `repo.ts`, `test-identity.ts`, `repo.test.ts`, `schema.migration.test.ts`

**Interfaces:**
- Produces: membership tables; `getHouseholdForUser` for any member; owner membership on upsert

- [ ] **Step 1: Failing tests** — user B with membership sees A’s household; upsert creates owner membership.
- [ ] **Step 2: Run — FAIL**
- [ ] **Step 3: Migration SQL** — as previously specified (`household_members`, `household_invites`, backfill, `is_household_member`, policy updates). Apply with local Supabase.
- [ ] **Step 4: Drizzle + repo + test-identity**
- [ ] **Step 5: Run — PASS** (`repo.test.ts`, `schema.migration.test.ts`)
- [ ] **Step 6: Commit** — `feat(household): membership table and resolve by member`

---

### Task 4: Members / invites repository

**Files:** `src/household/members-repo.ts`, `members-repo.test.ts`, optional `src/lib/supabase/admin.ts`

**Produces:**
- `listMembers`, `listInvites`, `createInvite`, `revokeInvite`, `removeMember`, `acceptInvite`

**Rules:** owner-only invite/revoke/remove; accept rejects existing membership / bad codes; 8-char unambiguous alphabet; emails via `auth.admin.getUserById`.

- [ ] **Step 1–5:** TDD cycle + commit `feat(household): invite and membership repository`

---

### Task 5: Household UI + `/join` + setup link

**Files:** household actions/page/members component, `src/app/join/*`, setup wizard

- [ ] **Step 1:** Failing UI/action tests as practical
- [ ] **Step 2:** Server actions with clear error strings
- [ ] **Step 3:** Members section + join form
- [ ] **Step 4:** Setup “Have an invite code?”
- [ ] **Step 5: Browser E2E**
  1. Owner A: create invite on Household.
  2. Invite/create user B (dashboard or admin API); B magic-links or passwords in **without** finishing solo setup.
  3. B opens `/join?code=…` → Accept → shared Plans/Meals.
  4. A removes B → B loses access.
  5. Desktop + ~768 mobile on Household members + `/join` + `/login`.
- [ ] **Step 6: Commit** — `feat(household): invite UI and join page`

---

### Task 6: Agents.md + design/plan docs + production SQL note

- [ ] Finalize combined design under `docs/superpowers/specs/2026-09-23-magic-link-and-shared-household-design.md`
- [ ] Copy plan to `docs/superpowers/plans/2026-09-23-magic-link-and-shared-household.md`
- [ ] Agents.md: shared households in scope; Screens `/join`; Hard constraints updated
- [ ] Give user hosted migration SQL for Supabase project `oedttrktnexcifxukyie` + reminder to confirm SMTP/redirects for magic links on Vercel production
- [ ] Commit docs

---

## Self-review (plan vs decisions)

| Requirement | Task |
| --- | --- |
| Magic link + password login | Task 1 |
| Confirm route reuse / docs / SMTP | Task 1–2 |
| Membership + invites schema | Task 3 |
| Invite accept / owner controls | Task 4–5 |
| Equal member edit access | Task 3 (shared householdId) |
| Empty-only join + setup link | Task 4–5 |
| Browser verification | Tasks 1 & 5 |
| Password change Account page | Out of scope |

**Risk:** Hosted magic links fail without SMTP and redirect allowlist—document and verify on production after deploy, not only locally via Mailpit.

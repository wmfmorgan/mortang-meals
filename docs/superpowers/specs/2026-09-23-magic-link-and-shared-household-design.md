# Magic-link login + shared household — design

Status: **shipped** 2026-09-23 (Part A + Part B on `feat/magic-link-shared-household`).

## Goal

Restore invite-only **magic-link** login alongside **password** sign-in, and let multiple Auth users share one household (same meals, plans, shopping list).

## Non-goals

- Change-password / Account page
- Open signup (`shouldCreateUser` stays `false`)
- Email-based household invites (in-app code/link only)
- Merging two existing meal libraries
- Ownership transfer
- Google OAuth on the login page

## Part A — Magic-link + password login

### Behavior

1. `/login` shows email + password and **Sign in**, plus **Email me a link** on the same email field.
2. Password → `signInWithPassword({ email, password })`; success navigates home (or `?next=`) and refreshes.
3. Magic link → `signInWithOtp` with `shouldCreateUser: false` and `emailRedirectTo` = `${origin}/auth/confirm` (includes `next` when set).
4. OTP success (and unknown-user / signup-disallowed errors) show the same generic copy: “If that address can sign in, check your inbox for a link.” Distinct errors (e.g. rate limit) still surface.
5. `/auth/confirm` already handles `token_hash` + type (`email` | `magiclink` | `invite`), PKCE `code`, and implicit hash — reuse; do not invent a second callback.
6. Middleware already allows `/login` and `/auth/*`. Unauthenticated deep links (e.g. `/join`) redirect to `/login?next=…` with an open-redirect guard.

### Invite-only

- Public signup off in the Auth dashboard.
- Admin creates users (Studio or `auth.admin.createUser`) with confirmed email; password optional if they will only use magic link.
- App never self-registers via OTP.

### Local vs hosted mail

| Environment | How magic-link mail works |
| --- | --- |
| Local (`supabase start`) | Mailpit web UI on **port 56324** for this repo (`http://127.0.0.1:56324`). Template: `supabase/templates/magic_link.html`. |
| Hosted (Vercel + Supabase) | Custom **SMTP** required. Site URL + redirect allowlist must include `{app origin}/auth/confirm`. Template link: `{SiteURL}/auth/confirm?token_hash={{ .TokenHash }}&type=email`. |

Without hosted SMTP, password sign-in still works; magic-link emails will not send.

### Success (Part A)

- Invited users sign in with password or magic link
- Uninvited emails cannot self-register
- No Google on `/login`
- Local magic links verified via Mailpit 56324 → `/auth/confirm`

---

## Part B — Shared household membership

### Product rules

| Topic | Decision |
| --- | --- |
| Shared household | `household_members` + invite codes |
| Member permissions | Equal full edit access; only **owner** manages membership |
| Join eligibility | Only accounts with **no** household membership yet (join before solo `/setup`) |
| One household per user | `household_members.user_id` unique |
| Owner self-remove | Owner cannot remove themselves while other members remain |
| App-admin Settings | `isAdminEmail` stays separate from household owner |

### Data model

- **`household_members`**: `household_id`, `user_id` (unique), role `owner` | `member`. Backfill existing `households.owner_id` as owners.
- **`household_invites`**: 8-char unambiguous code, 7-day expiry, single-use, revocable by owner.
- Resolve household via membership join (`getHouseholdForUser`); `upsertHousehold` creates the owner membership row on insert; later saves update by household id and do not re-bind `owner_id`.
- RLS helper `is_household_member(household_id)` and policies updated for correctness (app still uses privileged `DATABASE_URL`).

### UX

- Owner on **Household**: members list (emails via service role), create/revoke invite, remove member (`HouseholdMembers` on `/household`).
- `/join?code=` accept flow for invitees with no membership (`JoinForm` + `acceptInviteAction`).
- Setup wizard links “Have an invite code?” when the user has no household yet.
- Signed-out `/join` returns via `/login?next=/join?code=…`.

### File map (Part B) — as shipped

| Path | Responsibility |
| --- | --- |
| `supabase/migrations/20260923120000_household_members.sql` | Tables, backfill, RLS |
| `src/lib/schema.ts` | Drizzle mirrors |
| `src/household/repo.ts` | Membership-aware lookup; owner row on create; update-by-id saves |
| `src/household/members-repo.ts` | Invites + members CRUD/accept |
| `src/lib/test-identity.ts` | Seed owner membership |
| `src/lib/supabase/admin.ts` | Shared service-role client |
| `src/lib/safe-next-path.ts` | Open-redirect guard for `?next=` |
| `src/app/household/actions.ts` | create/revoke/remove/accept + household save |
| `src/app/household/household-members.tsx` | UI section (owner controls) |
| `src/app/household/page.tsx` | Loads members/invites/`isOwner`; wires `HouseholdMembers` |
| `src/app/join/page.tsx` | Join route; requires signed-in user; passes `?code=` |
| `src/app/join/join-form.tsx` | Accept form |
| `src/app/setup/setup-wizard.tsx` | Link to `/join` when no household |
| `src/lib/supabase/middleware.ts` | Unauthed → `/login?next=…` |
| `src/app/login/*`, `src/app/auth/confirm/*` | Honor `next` after password / magic-link confirm |

### Success (Part B)

- Partner with no household accepts a code and sees the same Plans / Meals / shopping list
- Owner can revoke unused invites and remove members
- Solo setup path unchanged for users who never join

## Risks

Hosted magic links fail without SMTP and a correct redirect allowlist / email template — verify on production after deploy, not only via local Mailpit. Production Postgres must apply `20260923120000_household_members.sql` (prefer SQL Editor paste on hosted Supabase) before shared-household code is live.

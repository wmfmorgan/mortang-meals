# Email + password login (invite-only) — design

Status: approved 2026-09-12.

## Goal

Replace Google OAuth on `/login` with **email + password** (`signInWithPassword`). No magic-link OTP, no social buttons, no SMTP for day-to-day login. Users are created by an admin (Studio or `auth.admin.createUser`) with a password and confirmed email; public signup stays off.

## Non-goals

- Forgot-password / reset emails (needs SMTP; admin resets in Studio for now)
- Google / other OAuth on the login page
- Supabase OAuth Server (IdP for third parties)
- Open signup, in-app invites

## Behavior

1. `/login` shows email + password fields and **Sign in**.
2. Submit → `signInWithPassword({ email, password })`.
3. Success → navigate to `/` and refresh (cookie session).
4. Failure → show a generic or provider error (invalid credentials); do not reveal whether the email exists if Supabase returns a generic message.
5. Auth callback `/auth/confirm` can remain for any leftover flows; login no longer depends on it.

## Admin onboarding

Studio → Users → Add user (or update existing): set email, password, confirm email. Or:

```ts
await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
```

## Success

- Sign in without Google or email rate limits
- Uninvited emails cannot self-register
- No Google / magic-link UI

# Google OAuth only (no magic link) — design

Status: approved 2026-09-12.

## Goal

Replace magic-link / OTP email login with **Google OAuth**. Day-to-day sign-in never sends email. Access stays invite-only via **admin-created** `auth.users` rows whose email matches the Google account (no invite email required).

## Non-goals

- Custom SMTP, editable email templates
- GitHub / other OAuth providers (same pattern later)
- Password, phone OTP, passkeys
- Open Google signup
- In-app invite UI

## Behavior

1. `/login` shows **Continue with Google** only.
2. `signInWithOAuth({ provider: 'google', options: { redirectTo: origin + '/auth/confirm', queryParams: { prompt: 'select_account' } } })`.
3. Callback reuses `/auth/confirm` (`?code=` → `exchangeCodeForSession`).
4. Hosted Auth: **Allow new users to sign up = off**. Google cannot create new users.
5. Onboard: Studio/API `createUser` with the person’s Gmail and `email_confirm: true` (no invite mail) → they click Continue with Google. Automatic identity linking by email.
6. Magic-link OTP UI and `signInWithOtp` are removed from the login form.

## Dashboard (manual)

- Google Cloud OAuth Web client; redirect `https://<project-ref>.supabase.co/auth/v1/callback`
- Supabase → Providers → Google enabled with Client ID/Secret
- Signup disabled; URL allowlist includes `/auth/confirm`

## App changes

- `login-form.tsx` / tests / `login/page.tsx` lede
- README + AGENTS: Google-only + admin create user

## Success

- Invited (admin-created) Google email signs in without SMTP
- Uninvited Google accounts cannot create a lasting session
- No “Email me a link” on `/login`

# Email-bound household invites — design

Status: shipped 2026-09-23 (branch `feat/email-household-invite`).

## Goal

Owners invite a partner by **email**. The app provisions (or reuses) a Supabase Auth user, creates an email-bound invite code, and emails a magic link that returns to `/join?code=…` after confirm.

## Security

- Owner-only server action + `requireOwner`
- Service role only on the server (`createAdminClient`)
- Magic link never returned to the browser
- `invited_email` checked on accept (case-insensitive)
- Public OTP remains `shouldCreateUser: false`; only the invite path may `createUser`
- Canonical `NEXT_PUBLIC_SITE_URL` for redirect origins

## Flow

1. Household → email → Send invite  
2. Normalize email → ensure Auth user → reject if already a household member → insert invite with `invited_email` → `signInWithOtp` with `next=/join?code=`  
3. Invitee opens link → confirm → join → accept (email must match)

## Schema

`household_invites.invited_email text` (nullable for legacy rows; required for new creates). Migration: `20260923205018_invite_email.sql`.

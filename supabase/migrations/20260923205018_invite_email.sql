-- Bind household invites to an invited email (nullable for legacy rows).
alter table public.household_invites
  add column if not exists invited_email text;

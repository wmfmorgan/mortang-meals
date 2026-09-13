-- Per-meal servings (library generate override, import, manual create).
alter table public.meals
  add column if not exists servings integer not null default 2;

-- Backfill from household when possible.
update public.meals m
set servings = h.servings
from public.households h
where m.household_id = h.id
  and m.servings = 2
  and h.servings is distinct from 2;

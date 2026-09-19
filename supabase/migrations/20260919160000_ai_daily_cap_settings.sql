-- Owner-configurable shared-key AI daily cap (global).
alter table public.app_settings
  add column if not exists ai_daily_cap_enabled boolean not null default true;

alter table public.app_settings
  add column if not exists ai_daily_cap integer not null default 10;

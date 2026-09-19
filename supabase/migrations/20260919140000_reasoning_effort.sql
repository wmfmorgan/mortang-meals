-- Global Grok reasoning effort (low | medium | high | xhigh).
alter table public.app_settings
  add column if not exists reasoning_effort text not null default 'high';

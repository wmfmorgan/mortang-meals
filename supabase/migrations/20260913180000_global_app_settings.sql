-- Global AI provider settings (shared by all households).
-- Developer tools remain on public.ai_settings per household.

create table if not exists public.app_settings (
  id text primary key,
  mode text not null,
  base_url text not null,
  model text not null,
  custom_api_key text,
  web_search boolean not null,
  constraint app_settings_singleton check (id = 'default')
);

insert into public.app_settings (id, mode, base_url, model, custom_api_key, web_search)
select 'default', mode, base_url, model, custom_api_key, web_search
from public.ai_settings
order by id
limit 1
on conflict (id) do nothing;

insert into public.app_settings (id, mode, base_url, model, custom_api_key, web_search)
values ('default', 'grok', 'https://api.x.ai/v1', 'grok-4.6', null, false)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;
revoke all on table public.app_settings from anon, authenticated;

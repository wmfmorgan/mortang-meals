-- App schema for Mortang Meals on Supabase Postgres.
-- Server uses DATABASE_URL (bypasses RLS). RLS + revokes keep Data API closed.

create table public.households (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null,
  diet_style text not null,
  notes text not null,
  servings integer not null
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  age integer not null,
  sex text,
  allergies jsonb not null default '[]'::jsonb,
  avoidances jsonb not null default '[]'::jsonb
);

create table public.kitchen_prefs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null unique references public.households (id) on delete cascade,
  expertise text not null,
  overall_diet text not null,
  breakfast_diet text not null,
  lunch_diet text not null,
  dinner_diet text not null,
  max_cook_minutes integer not null,
  involved text not null
);

create table public.kitchen_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  kind text not null,
  enabled boolean not null,
  built_in boolean not null
);

create table public.week_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  week_start text not null,
  is_current boolean not null,
  slot_mask jsonb not null,
  name text not null default '',
  favorited boolean not null default false,
  unique (household_id, week_start)
);
create unique index week_plans_one_current
  on public.week_plans (household_id) where is_current;

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  plan_id uuid,
  day text not null,
  slot text not null,
  title text not null,
  why_it_fits text not null,
  cook_minutes integer not null,
  method text not null,
  ingredients jsonb not null,
  steps jsonb not null,
  used_web_search boolean not null default false,
  pinned boolean not null default false,
  week_start text not null default '',
  created_at timestamptz not null default now(),
  source_url text,
  extras jsonb not null default '{}'::jsonb,
  draft boolean not null default false,
  stars smallint not null default 0,
  takeout boolean not null default false,
  leftover boolean not null default false
);

create table public.library_generate_prefs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null unique references public.households (id) on delete cascade,
  json jsonb not null
);

create table public.ai_settings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null unique references public.households (id) on delete cascade,
  mode text not null,
  base_url text not null,
  model text not null,
  custom_api_key text,
  developer_tools boolean not null,
  web_search boolean not null
);

create table public.ai_traces (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_at timestamptz not null,
  kind text not null,
  mode text not null,
  base_url text not null,
  model text not null,
  request_text text not null,
  response_text text not null,
  validation text not null
);

create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  generate_count integer not null default 0,
  primary key (user_id, day)
);

create index people_household_id_idx on public.people (household_id);
create index kitchen_items_household_id_idx on public.kitchen_items (household_id);
create index week_plans_household_week_idx on public.week_plans (household_id, week_start);
create index meals_household_id_idx on public.meals (household_id);
create index meals_library_idx on public.meals (household_id, slot, draft, created_at desc);
create index ai_traces_household_created_idx on public.ai_traces (household_id, created_at desc);

-- RLS: households by owner_id
alter table public.households enable row level security;
create policy "households_select" on public.households for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "households_insert" on public.households for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "households_update" on public.households for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "households_delete" on public.households for delete to authenticated
  using (owner_id = (select auth.uid()));
revoke all on table public.households from anon, authenticated;

-- RLS: people
alter table public.people enable row level security;
create policy "people_select" on public.people for select to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "people_insert" on public.people for insert to authenticated
  with check (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "people_update" on public.people for update to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())))
  with check (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "people_delete" on public.people for delete to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())));
revoke all on table public.people from anon, authenticated;

-- RLS: kitchen_prefs
alter table public.kitchen_prefs enable row level security;
create policy "kitchen_prefs_select" on public.kitchen_prefs for select to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "kitchen_prefs_insert" on public.kitchen_prefs for insert to authenticated
  with check (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "kitchen_prefs_update" on public.kitchen_prefs for update to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())))
  with check (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "kitchen_prefs_delete" on public.kitchen_prefs for delete to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())));
revoke all on table public.kitchen_prefs from anon, authenticated;

-- RLS: kitchen_items
alter table public.kitchen_items enable row level security;
create policy "kitchen_items_select" on public.kitchen_items for select to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "kitchen_items_insert" on public.kitchen_items for insert to authenticated
  with check (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "kitchen_items_update" on public.kitchen_items for update to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())))
  with check (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "kitchen_items_delete" on public.kitchen_items for delete to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())));
revoke all on table public.kitchen_items from anon, authenticated;

-- RLS: week_plans
alter table public.week_plans enable row level security;
create policy "week_plans_select" on public.week_plans for select to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "week_plans_insert" on public.week_plans for insert to authenticated
  with check (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "week_plans_update" on public.week_plans for update to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())))
  with check (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "week_plans_delete" on public.week_plans for delete to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())));
revoke all on table public.week_plans from anon, authenticated;

-- RLS: meals
alter table public.meals enable row level security;
create policy "meals_select" on public.meals for select to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "meals_insert" on public.meals for insert to authenticated
  with check (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "meals_update" on public.meals for update to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())))
  with check (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "meals_delete" on public.meals for delete to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())));
revoke all on table public.meals from anon, authenticated;

-- RLS: library_generate_prefs
alter table public.library_generate_prefs enable row level security;
create policy "library_generate_prefs_select" on public.library_generate_prefs for select to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "library_generate_prefs_insert" on public.library_generate_prefs for insert to authenticated
  with check (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "library_generate_prefs_update" on public.library_generate_prefs for update to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())))
  with check (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "library_generate_prefs_delete" on public.library_generate_prefs for delete to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())));
revoke all on table public.library_generate_prefs from anon, authenticated;

-- RLS: ai_settings
alter table public.ai_settings enable row level security;
create policy "ai_settings_select" on public.ai_settings for select to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "ai_settings_insert" on public.ai_settings for insert to authenticated
  with check (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "ai_settings_update" on public.ai_settings for update to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())))
  with check (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "ai_settings_delete" on public.ai_settings for delete to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())));
revoke all on table public.ai_settings from anon, authenticated;

-- RLS: ai_traces
alter table public.ai_traces enable row level security;
create policy "ai_traces_select" on public.ai_traces for select to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "ai_traces_insert" on public.ai_traces for insert to authenticated
  with check (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "ai_traces_update" on public.ai_traces for update to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())))
  with check (household_id in (select id from public.households where owner_id = (select auth.uid())));
create policy "ai_traces_delete" on public.ai_traces for delete to authenticated
  using (household_id in (select id from public.households where owner_id = (select auth.uid())));
revoke all on table public.ai_traces from anon, authenticated;

-- RLS: ai_usage (keyed by user_id, not household_id)
alter table public.ai_usage enable row level security;
create policy "ai_usage_select" on public.ai_usage for select to authenticated
  using (user_id = (select auth.uid()));
create policy "ai_usage_insert" on public.ai_usage for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "ai_usage_update" on public.ai_usage for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "ai_usage_delete" on public.ai_usage for delete to authenticated
  using (user_id = (select auth.uid()));
revoke all on table public.ai_usage from anon, authenticated;

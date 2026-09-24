-- Shared household membership + invite codes.
-- App still uses DATABASE_URL (bypasses RLS); policies stay correct for Data API.

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  max_uses int not null default 1 check (max_uses >= 1),
  use_count int not null default 0 check (use_count >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

insert into public.household_members (household_id, user_id, role)
select id, owner_id, 'owner' from public.households
on conflict (user_id) do nothing;

create or replace function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = p_household_id
      and m.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

-- households: members can read/update; insert still requires owner_id = auth.uid()
drop policy if exists "households_select" on public.households;
drop policy if exists "households_update" on public.households;
drop policy if exists "households_delete" on public.households;
create policy "households_select" on public.households for select to authenticated
  using (public.is_household_member(id));
create policy "households_update" on public.households for update to authenticated
  using (public.is_household_member(id))
  with check (public.is_household_member(id));
create policy "households_delete" on public.households for delete to authenticated
  using (public.is_household_member(id));

-- Child tables: membership instead of owner_id subquery
drop policy if exists "people_select" on public.people;
drop policy if exists "people_insert" on public.people;
drop policy if exists "people_update" on public.people;
drop policy if exists "people_delete" on public.people;
create policy "people_select" on public.people for select to authenticated
  using (public.is_household_member(household_id));
create policy "people_insert" on public.people for insert to authenticated
  with check (public.is_household_member(household_id));
create policy "people_update" on public.people for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "people_delete" on public.people for delete to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "kitchen_prefs_select" on public.kitchen_prefs;
drop policy if exists "kitchen_prefs_insert" on public.kitchen_prefs;
drop policy if exists "kitchen_prefs_update" on public.kitchen_prefs;
drop policy if exists "kitchen_prefs_delete" on public.kitchen_prefs;
create policy "kitchen_prefs_select" on public.kitchen_prefs for select to authenticated
  using (public.is_household_member(household_id));
create policy "kitchen_prefs_insert" on public.kitchen_prefs for insert to authenticated
  with check (public.is_household_member(household_id));
create policy "kitchen_prefs_update" on public.kitchen_prefs for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "kitchen_prefs_delete" on public.kitchen_prefs for delete to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "kitchen_items_select" on public.kitchen_items;
drop policy if exists "kitchen_items_insert" on public.kitchen_items;
drop policy if exists "kitchen_items_update" on public.kitchen_items;
drop policy if exists "kitchen_items_delete" on public.kitchen_items;
create policy "kitchen_items_select" on public.kitchen_items for select to authenticated
  using (public.is_household_member(household_id));
create policy "kitchen_items_insert" on public.kitchen_items for insert to authenticated
  with check (public.is_household_member(household_id));
create policy "kitchen_items_update" on public.kitchen_items for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "kitchen_items_delete" on public.kitchen_items for delete to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "week_plans_select" on public.week_plans;
drop policy if exists "week_plans_insert" on public.week_plans;
drop policy if exists "week_plans_update" on public.week_plans;
drop policy if exists "week_plans_delete" on public.week_plans;
create policy "week_plans_select" on public.week_plans for select to authenticated
  using (public.is_household_member(household_id));
create policy "week_plans_insert" on public.week_plans for insert to authenticated
  with check (public.is_household_member(household_id));
create policy "week_plans_update" on public.week_plans for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "week_plans_delete" on public.week_plans for delete to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "meals_select" on public.meals;
drop policy if exists "meals_insert" on public.meals;
drop policy if exists "meals_update" on public.meals;
drop policy if exists "meals_delete" on public.meals;
create policy "meals_select" on public.meals for select to authenticated
  using (public.is_household_member(household_id));
create policy "meals_insert" on public.meals for insert to authenticated
  with check (public.is_household_member(household_id));
create policy "meals_update" on public.meals for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "meals_delete" on public.meals for delete to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "library_generate_prefs_select" on public.library_generate_prefs;
drop policy if exists "library_generate_prefs_insert" on public.library_generate_prefs;
drop policy if exists "library_generate_prefs_update" on public.library_generate_prefs;
drop policy if exists "library_generate_prefs_delete" on public.library_generate_prefs;
create policy "library_generate_prefs_select" on public.library_generate_prefs for select to authenticated
  using (public.is_household_member(household_id));
create policy "library_generate_prefs_insert" on public.library_generate_prefs for insert to authenticated
  with check (public.is_household_member(household_id));
create policy "library_generate_prefs_update" on public.library_generate_prefs for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "library_generate_prefs_delete" on public.library_generate_prefs for delete to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "ai_settings_select" on public.ai_settings;
drop policy if exists "ai_settings_insert" on public.ai_settings;
drop policy if exists "ai_settings_update" on public.ai_settings;
drop policy if exists "ai_settings_delete" on public.ai_settings;
create policy "ai_settings_select" on public.ai_settings for select to authenticated
  using (public.is_household_member(household_id));
create policy "ai_settings_insert" on public.ai_settings for insert to authenticated
  with check (public.is_household_member(household_id));
create policy "ai_settings_update" on public.ai_settings for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "ai_settings_delete" on public.ai_settings for delete to authenticated
  using (public.is_household_member(household_id));

drop policy if exists "ai_traces_select" on public.ai_traces;
drop policy if exists "ai_traces_insert" on public.ai_traces;
drop policy if exists "ai_traces_update" on public.ai_traces;
drop policy if exists "ai_traces_delete" on public.ai_traces;
create policy "ai_traces_select" on public.ai_traces for select to authenticated
  using (public.is_household_member(household_id));
create policy "ai_traces_insert" on public.ai_traces for insert to authenticated
  with check (public.is_household_member(household_id));
create policy "ai_traces_update" on public.ai_traces for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "ai_traces_delete" on public.ai_traces for delete to authenticated
  using (public.is_household_member(household_id));

-- New tables: RLS on, members can select peers / invites; grants revoked
alter table public.household_members enable row level security;
create policy "household_members_select" on public.household_members for select to authenticated
  using (public.is_household_member(household_id));
create policy "household_members_insert" on public.household_members for insert to authenticated
  with check (public.is_household_member(household_id));
create policy "household_members_update" on public.household_members for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "household_members_delete" on public.household_members for delete to authenticated
  using (public.is_household_member(household_id));
revoke all on table public.household_members from anon, authenticated;

alter table public.household_invites enable row level security;
create policy "household_invites_select" on public.household_invites for select to authenticated
  using (public.is_household_member(household_id));
create policy "household_invites_insert" on public.household_invites for insert to authenticated
  with check (public.is_household_member(household_id));
create policy "household_invites_update" on public.household_invites for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "household_invites_delete" on public.household_invites for delete to authenticated
  using (public.is_household_member(household_id));
revoke all on table public.household_invites from anon, authenticated;

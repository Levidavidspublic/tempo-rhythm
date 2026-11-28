create table public.day_plans (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null check (pg_catalog.isfinite(local_date)),
  timezone text,
  intention text,
  top_task_ids uuid[],
  top_task_1_id uuid generated always as (top_task_ids[1]) stored,
  top_task_2_id uuid generated always as (top_task_ids[2]) stored,
  top_task_3_id uuid generated always as (top_task_ids[3]) stored,
  energy text check (energy in ('low', 'medium', 'high')),
  status text not null check (status in ('draft', 'committed')),
  committed_at bigint,
  reflection text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique,
  constraint day_plans_user_id_id_key unique (user_id, id),
  constraint day_plans_user_id_id_local_date_key unique (user_id, id, local_date),
  constraint day_plans_top_task_ids_check check (
    case when top_task_ids is null or pg_catalog.cardinality(top_task_ids) = 0 then true
      when pg_catalog.array_ndims(top_task_ids) = 1 and pg_catalog.array_lower(top_task_ids, 1) = 1 then
        pg_catalog.cardinality(top_task_ids) <= 3 and pg_catalog.array_position(top_task_ids, null) is null
      else false
    end
  ),
  foreign key (user_id, top_task_1_id) references public.tasks (user_id, id),
  foreign key (user_id, top_task_2_id) references public.tasks (user_id, id),
  foreign key (user_id, top_task_3_id) references public.tasks (user_id, id)
);

create unique index day_plans_owner_live_date_key on public.day_plans (user_id, local_date)
  where deleted_at is null;
create index day_plans_owner_deleted_date_idx on public.day_plans (user_id, deleted_at, local_date);

create table public.time_blocks (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null check (pg_catalog.isfinite(local_date)),
  day_plan_id uuid,
  title text not null check (title ~ '[^[:space:]]'),
  start_minute smallint not null check (start_minute between 0 and 1439),
  duration_minutes smallint not null check (duration_minutes between 5 and 720),
  starts_at_ms bigint not null,
  ends_at_ms bigint not null check (ends_at_ms > starts_at_ms),
  kind text not null check (kind in ('focus', 'task', 'habit', 'break', 'other')),
  task_id uuid,
  habit_id uuid,
  status text not null check (status in ('planned', 'done', 'skipped')),
  source text not null check (source in ('user', 'coach')),
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique,
  foreign key (user_id, day_plan_id, local_date) references public.day_plans (user_id, id, local_date),
  foreign key (user_id, task_id) references public.tasks (user_id, id),
  foreign key (user_id, habit_id) references public.habits (user_id, id)
);

create index time_blocks_owner_deleted_date_idx
  on public.time_blocks (user_id, deleted_at, local_date, start_minute, starts_at_ms);
create index time_blocks_owner_deleted_start_idx on public.time_blocks (user_id, deleted_at, starts_at_ms);
create index time_blocks_task_id_idx on public.time_blocks (task_id);

alter table public.day_plans enable row level security;
alter table public.time_blocks enable row level security;
revoke all on public.day_plans, public.time_blocks from public, anon, authenticated;
revoke delete, truncate on public.day_plans, public.time_blocks from project_admin;
grant select, insert, update on public.day_plans, public.time_blocks to authenticated, project_admin;

create policy day_plans_select_own on public.day_plans
  for select to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active());
create policy day_plans_insert_own on public.day_plans
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.account_is_active());
create policy day_plans_update_own on public.day_plans
  for update to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active())
  with check (user_id = (select auth.uid()) and public.account_is_active());

create policy time_blocks_select_own on public.time_blocks
  for select to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active());
create policy time_blocks_insert_own on public.time_blocks
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.account_is_active());
create policy time_blocks_update_own on public.time_blocks
  for update to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active())
  with check (user_id = (select auth.uid()) and public.account_is_active());

insert into realtime.channels (pattern, description, enabled)
values
  ('day_plans:%', 'Per-owner day plan changes', true),
  ('time_blocks:%', 'Per-owner time block changes', true)
on conflict (pattern) do update
set description = excluded.description, enabled = excluded.enabled;

create trigger day_plans_publish_owner_change
  after insert or update on public.day_plans
  for each row execute function public.publish_owner_change();

create trigger time_blocks_publish_owner_change
  after insert or update on public.time_blocks
  for each row execute function public.publish_owner_change();

create table public.goals (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  target_date bigint,
  progress_percent double precision not null default 0 check (progress_percent between 0 and 100),
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique
);

create index goals_user_live_updated_idx
  on public.goals (user_id, deleted_at, updated_at desc);
create index goals_user_live_status_updated_idx
  on public.goals (user_id, deleted_at, status, updated_at desc);

alter table public.goals enable row level security;

revoke all on public.goals from public, anon, authenticated;
grant select on public.goals to authenticated;
grant insert (user_id, title, description, target_date, progress_percent, status, created_at, updated_at)
  on public.goals to authenticated;
grant update (title, description, target_date, progress_percent, status, updated_at, deleted_at)
  on public.goals to authenticated;

create policy goals_select_own on public.goals
  for select to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active());

create policy goals_insert_own on public.goals
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.account_is_active());

create policy goals_update_own on public.goals
  for update to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active())
  with check (user_id = (select auth.uid()) and public.account_is_active());

insert into realtime.channels (pattern, description, enabled)
values ('goals:%', 'Per-owner goal changes (id only)', true)
on conflict (pattern) do update
set description = excluded.description, enabled = excluded.enabled;

create trigger goals_publish_owner_change
  after insert or update on public.goals
  for each row execute function public.publish_owner_change();

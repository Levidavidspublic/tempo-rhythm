create table public.coach_settings (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dial smallint not null default 5 check (dial between 0 and 10),
  task_load smallint not null default 2 check (task_load between 2 and 4),
  panic_until bigint,
  accepted_streak integer not null default 0 check (accepted_streak >= 0),
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique
);

create unique index coach_settings_live_owner_key on public.coach_settings (user_id)
  where deleted_at is null;
create index coach_settings_owner_deleted_idx on public.coach_settings (user_id, deleted_at);

alter table public.coach_settings enable row level security;
revoke all on public.coach_settings from public, anon, authenticated, project_admin;
grant select on public.coach_settings to authenticated;
grant insert (id, user_id, dial, panic_until, created_at, updated_at) on public.coach_settings to authenticated;
grant update (dial, panic_until, updated_at, deleted_at) on public.coach_settings to authenticated;
grant select, insert, update on public.coach_settings to project_admin;

create policy coach_settings_select_own on public.coach_settings
  for select to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active());

create policy coach_settings_insert_own on public.coach_settings
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.account_is_active());

create policy coach_settings_update_own on public.coach_settings
  for update to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active())
  with check (user_id = (select auth.uid()) and public.account_is_active());

create table public.coach_web_searches (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  utc_date_key date not null check (pg_catalog.isfinite(utc_date_key)),
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique
);

create index coach_web_searches_owner_utc_date_idx on public.coach_web_searches (user_id, utc_date_key);

alter table public.coach_web_searches enable row level security;
revoke all on public.coach_web_searches from public, anon, authenticated, project_admin;
grant select, insert, update on public.coach_web_searches to project_admin;

insert into realtime.channels (pattern, description, enabled)
values ('coach_settings:%', 'Per-owner coach settings changes', true)
on conflict (pattern) do update
set description = excluded.description, enabled = excluded.enabled;

create trigger coach_settings_publish_owner_change
  after insert or update on public.coach_settings
  for each row execute function public.publish_owner_change();

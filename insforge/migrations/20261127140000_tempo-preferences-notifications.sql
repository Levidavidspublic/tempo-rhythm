create table public.user_preferences (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  locale text not null default 'en' check (locale in ('en', 'he')),
  week_starts_on integer not null default 1 check (week_starts_on in (0, 1, 6)),
  time_zone text not null default 'UTC' check (time_zone ~ '[^[:space:]]'),
  email_reminders boolean not null default true,
  in_app_notifications boolean not null default true,
  coach_web_search boolean not null default false,
  created_at bigint not null default trunc(extract(epoch from statement_timestamp()) * 1000)::bigint,
  updated_at bigint not null default trunc(extract(epoch from statement_timestamp()) * 1000)::bigint,
  deleted_at bigint,
  legacy_convex_id text unique
);

create unique index user_preferences_live_owner_idx
  on public.user_preferences (user_id) where deleted_at is null;

create table public.notifications (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null check (kind in ('system', 'reminder', 'billing')),
  read_at bigint,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique
);

create index notifications_live_owner_created_idx
  on public.notifications (user_id, created_at desc, id) where deleted_at is null;

create index notifications_unread_owner_created_idx
  on public.notifications (user_id, created_at desc, id)
  where deleted_at is null and read_at is null;

alter table public.user_preferences enable row level security;
alter table public.notifications enable row level security;

revoke all on public.user_preferences, public.notifications from public, anon, authenticated;
grant select on public.user_preferences, public.notifications to authenticated;
grant insert (user_id, theme, locale, week_starts_on, time_zone, email_reminders,
  in_app_notifications, coach_web_search) on public.user_preferences to authenticated;
grant update (theme, locale, week_starts_on, time_zone, email_reminders,
  in_app_notifications, coach_web_search) on public.user_preferences to authenticated;

do $$
begin
  if exists (select from pg_catalog.pg_roles where rolname = 'project_admin') then
    grant select, insert, update on public.user_preferences, public.notifications to project_admin;
  end if;
end;
$$;

create policy user_preferences_select_own on public.user_preferences
  for select to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active() and deleted_at is null);

create policy user_preferences_insert_own on public.user_preferences
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.account_is_active() and deleted_at is null);

create policy user_preferences_update_own on public.user_preferences
  for update to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active() and deleted_at is null)
  with check (user_id = (select auth.uid()) and public.account_is_active() and deleted_at is null);

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active() and deleted_at is null);

create function public.stamp_user_preferences_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := trunc(extract(epoch from statement_timestamp()) * 1000)::bigint;
  return new;
end;
$$;

revoke execute on function public.stamp_user_preferences_update() from public, anon, authenticated;

create trigger user_preferences_stamp_update
  before update on public.user_preferences
  for each row when (current_user = 'authenticated')
  execute function public.stamp_user_preferences_update();

create function public.mark_notification_read(notification_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  now_ms bigint;
  changed integer;
begin
  if owner_id is null or not public.account_is_active() then
    return 0;
  end if;

  now_ms := pg_catalog.trunc(extract(epoch from pg_catalog.statement_timestamp()) * 1000)::bigint;
  update public.notifications
  set read_at = now_ms, updated_at = now_ms
  where id = notification_id and user_id = owner_id and deleted_at is null and read_at is null;

  get diagnostics changed = row_count;
  return changed;
end;
$$;

create function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  now_ms bigint;
  changed integer;
begin
  if owner_id is null or not public.account_is_active() then
    return 0;
  end if;

  now_ms := pg_catalog.trunc(extract(epoch from pg_catalog.statement_timestamp()) * 1000)::bigint;
  update public.notifications
  set read_at = now_ms, updated_at = now_ms
  where user_id = owner_id and deleted_at is null and read_at is null;

  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke execute on function public.mark_notification_read(uuid), public.mark_all_notifications_read()
  from public, anon;
grant execute on function public.mark_notification_read(uuid), public.mark_all_notifications_read()
  to authenticated;

insert into realtime.channels (pattern, description, enabled)
values
  ('user_preferences:%', 'Per-owner preference changes (id only)', true),
  ('notifications:%', 'Per-owner notification changes (id only)', true)
on conflict (pattern) do update
set description = excluded.description, enabled = excluded.enabled;

create trigger user_preferences_publish_owner_change
  after insert or update on public.user_preferences
  for each row execute function public.publish_owner_change();

create trigger notifications_publish_owner_change
  after insert or update on public.notifications
  for each row execute function public.publish_owner_change();

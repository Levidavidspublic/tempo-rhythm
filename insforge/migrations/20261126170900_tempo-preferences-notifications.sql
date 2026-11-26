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
grant select, insert, update on public.user_preferences, public.notifications to project_admin;

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
language sql
security definer
set search_path = pg_catalog
as $$
  with stamp as (
    select trunc(extract(epoch from statement_timestamp()) * 1000)::bigint as now_ms
  ), marked as (
    update public.notifications
    set read_at = stamp.now_ms, updated_at = stamp.now_ms
    from stamp
    where id = notification_id and user_id = (select auth.uid())
      and public.account_is_active() and deleted_at is null and read_at is null
    returning 1
  )
  select count(*)::integer from marked;
$$;

create function public.mark_all_notifications_read()
returns integer
language sql
security definer
set search_path = pg_catalog
as $$
  with stamp as (
    select trunc(extract(epoch from statement_timestamp()) * 1000)::bigint as now_ms
  ), marked as (
    update public.notifications
    set read_at = stamp.now_ms, updated_at = stamp.now_ms
    from stamp
    where user_id = (select auth.uid())
      and public.account_is_active() and deleted_at is null and read_at is null
    returning 1
  )
  select count(*)::integer from marked;
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

create policy tempo_preferences_notifications_owner_subscribe on realtime.channels
  for select to authenticated
  using (
    public.account_is_active()
    and (
      (pattern = 'user_preferences:%'
        and realtime.channel_name() = 'user_preferences:' || (select auth.uid())::text)
      or (pattern = 'notifications:%'
        and realtime.channel_name() = 'notifications:' || (select auth.uid())::text)
    )
  );

create trigger user_preferences_publish_owner_change
  after insert or update on public.user_preferences
  for each row execute function public.publish_owner_change();

create trigger notifications_publish_owner_change
  after insert or update on public.notifications
  for each row execute function public.publish_owner_change();

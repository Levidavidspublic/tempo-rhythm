create table public.calendar_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (title ~ '[^[:space:]]'),
  starts_at_ms bigint,
  ends_at_ms bigint,
  start_date date,
  end_date date,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique,
  constraint calendar_events_schedule_check check (
    (
      starts_at_ms is not null and start_date is null and end_date is null
      and (ends_at_ms is null or ends_at_ms > starts_at_ms)
    ) or (
      starts_at_ms is null and ends_at_ms is null
      and start_date is not null and end_date is not null and end_date > start_date
    )
  )
);

create index calendar_events_user_id_idx on public.calendar_events (user_id);
create index calendar_events_live_timed_idx
  on public.calendar_events (user_id, starts_at_ms, id)
  where deleted_at is null and starts_at_ms is not null;
create index calendar_events_live_all_day_idx
  on public.calendar_events (user_id, start_date, id)
  where deleted_at is null and start_date is not null;

alter table public.calendar_events enable row level security;

create policy calendar_events_select_own on public.calendar_events
  for select to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active());

create policy calendar_events_insert_own on public.calendar_events
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.account_is_active());

create policy calendar_events_update_own on public.calendar_events
  for update to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active())
  with check (user_id = (select auth.uid()) and public.account_is_active());

insert into realtime.channels (pattern, description, enabled)
values ('calendar_events:%', 'Per-owner calendar event changes (id only)', true)
on conflict (pattern) do update
set description = excluded.description, enabled = excluded.enabled;

create trigger calendar_events_publish_owner_change
  after insert or update on public.calendar_events
  for each row execute function public.publish_owner_change();

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000001913', 'q58-calendar-owner@example.invalid'),
  ('00000000-0000-4000-8000-000000001914', 'q58-calendar-neighbor@example.invalid');

set local role authenticated;
set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000001914';

insert into public.calendar_events (user_id, title, starts_at_ms, created_at, updated_at, legacy_convex_id)
values (auth.uid(), 'Neighbor event', 1795651200000, 1, 1, 'q58-neighbor');

set local "request.jwt.claim.sub" = '00000000-0000-4000-8000-000000001913';
set local realtime.channel_name = 'calendar_events:00000000-0000-4000-8000-000000001913';

insert into public.calendar_events (
  user_id, title, starts_at_ms, ends_at_ms, start_date, end_date, created_at, updated_at, legacy_convex_id
)
values
  (auth.uid(), 'Timed point', 1795651200000, null, null, null, 1, 1, 'q58-timed'),
  (auth.uid(), 'Timed span', 1795654800000, 1795658400000, null, null, 1, 1, 'q58-later'),
  (auth.uid(), 'All-day span', null, null, date '2026-11-26', date '2026-11-27', 1, 1, 'q58-all-day');

do $$
declare
  invalid_schedule record;
  rejected_constraint text;
begin
  if (select array_agg(legacy_convex_id order by starts_at_ms, id)
      from public.calendar_events
      where deleted_at is null and starts_at_ms >= 1795651200000 and starts_at_ms < 1795654800000)
      is distinct from array['q58-timed'] then
    raise exception 'Timed range must include the owner start, exclude the upper bound and hide the neighbor';
  end if;

  if (select array_agg(legacy_convex_id order by start_date, id)
      from public.calendar_events
      where deleted_at is null and start_date >= date '2026-11-26' and start_date < date '2026-11-27')
      is distinct from array['q58-all-day'] then
    raise exception 'All-day range must use local dates and exclude timed rows';
  end if;

  if not exists (select 1 from realtime.channels where pattern = 'calendar_events:%') then
    raise exception 'Owner could not subscribe to their calendar channel';
  end if;
  perform pg_catalog.set_config('realtime.channel_name', 'calendar_events:00000000-0000-4000-8000-000000001914', true);
  if exists (select 1 from realtime.channels where pattern = 'calendar_events:%') then
    raise exception 'Owner could subscribe to a neighbor calendar channel';
  end if;

  update public.calendar_events set title = 'Foreign change' where legacy_convex_id = 'q58-neighbor';
  if found then
    raise exception 'Owner could update a neighbor event';
  end if;

  begin
    insert into public.calendar_events (user_id, title, starts_at_ms, created_at, updated_at)
    values ('00000000-0000-4000-8000-000000001914', 'Foreign insert', 1795651200000, 1, 1);
    raise exception 'Owner could insert a neighbor event';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.calendar_events set user_id = '00000000-0000-4000-8000-000000001914'
    where legacy_convex_id = 'q58-timed';
    raise exception 'Owner could transfer event ownership';
  exception when insufficient_privilege then null;
  end;

  update public.calendar_events set deleted_at = 2, updated_at = 2 where legacy_convex_id = 'q58-timed';
  if not found or exists (
    select 1 from public.calendar_events where legacy_convex_id = 'q58-timed' and deleted_at is null
  ) then
    raise exception 'Soft-deleted event remained in live rows';
  end if;

  update public.calendar_events set deleted_at = null, updated_at = 3 where legacy_convex_id = 'q58-timed';
  if not found or not exists (
    select 1 from public.calendar_events where legacy_convex_id = 'q58-timed' and deleted_at is null
  ) then
    raise exception 'Owner could not restore a soft-deleted event';
  end if;

  delete from public.calendar_events where legacy_convex_id = 'q58-timed';
  if found then
    raise exception 'Owner could hard-delete an event';
  end if;

  for invalid_schedule in
    select * from (values
      (null::bigint, null::bigint, null::date, null::date),
      (1000, null, date '2026-11-26', date '2026-11-27'),
      (1000, 999, null, null),
      (null, null, date '2026-11-26', null),
      (null, null, date '2026-11-27', date '2026-11-26')
    ) as schedules (starts_at_ms, ends_at_ms, start_date, end_date)
  loop
    begin
      insert into public.calendar_events (
        user_id, title, starts_at_ms, ends_at_ms, start_date, end_date, created_at, updated_at
      ) values (
        auth.uid(), 'Invalid time', invalid_schedule.starts_at_ms, invalid_schedule.ends_at_ms,
        invalid_schedule.start_date, invalid_schedule.end_date, 1, 1
      );
      raise exception 'Invalid calendar schedule was accepted';
    exception when check_violation then
      get stacked diagnostics rejected_constraint = constraint_name;
      if rejected_constraint <> 'calendar_events_schedule_check' then raise; end if;
    end;
  end loop;

  begin
    update public.calendar_events set title = E' \t\n' where legacy_convex_id = 'q58-timed';
    raise exception 'Whitespace-only event title was accepted';
  exception when check_violation then null;
  end;
end;
$$;

set local role anon;
do $$
begin
  if exists (select 1 from public.calendar_events) then
    raise exception 'Anonymous role could read calendar events';
  end if;
end;
$$;

reset role;
update public.account_gate set is_active = false where user_id = '00000000-0000-4000-8000-000000001913';
set local role authenticated;
set local realtime.channel_name = 'calendar_events:00000000-0000-4000-8000-000000001913';

do $$
begin
  if exists (select 1 from public.calendar_events) then
    raise exception 'Inactive owner could read calendar events';
  end if;
  if exists (select 1 from realtime.channels where pattern = 'calendar_events:%') then
    raise exception 'Inactive owner could subscribe to their calendar channel';
  end if;
  begin
    insert into public.calendar_events (user_id, title, starts_at_ms, created_at, updated_at)
    values (auth.uid(), 'Inactive insert', 1795651200000, 1, 1);
    raise exception 'Inactive owner could insert calendar events';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;

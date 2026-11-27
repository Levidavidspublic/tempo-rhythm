begin;

update public.account_gate set approval_status = 'approved' where user_id in (:'owner_id', :'other_id');
select set_config('tempo_test.owner_id', :'owner_id', true);
select set_config('tempo_test.other_id', :'other_id', true);

set local role authenticated;
select set_config('request.jwt.claims',
  jsonb_build_object('sub', :'other_id', 'role', 'authenticated')::text, true);
insert into public.calendar_events (user_id, title, starts_at_ms, created_at, updated_at, legacy_convex_id)
values (auth.uid(), 'Neighbor event', 1795651200000, 1, 1, 'calendar-neighbor');

select set_config('request.jwt.claims',
  jsonb_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);
select set_config('realtime.channel_name', 'calendar_events:' || :'owner_id', true);

insert into public.calendar_events (
  user_id, title, starts_at_ms, ends_at_ms, start_date, end_date, created_at, updated_at, legacy_convex_id
)
values
  (auth.uid(), 'Timed point', 1795651200000, null, null, null, 1, 1, 'calendar-timed'),
  (auth.uid(), 'Timed span', 1795654800000, 1795658400000, null, null, 1, 1, 'calendar-later'),
  (auth.uid(), 'All-day span', null, null, date '2026-11-26', date '2026-11-27', 1, 1, 'calendar-all-day');

do $$
declare
  other_id constant uuid := current_setting('tempo_test.other_id')::uuid;
  invalid_schedule record;
  rejected_constraint text;
begin
  if (select array_agg(legacy_convex_id order by starts_at_ms, id)
      from public.calendar_events
      where deleted_at is null and starts_at_ms >= 1795651200000 and starts_at_ms < 1795654800000)
      is distinct from array['calendar-timed'] then
    raise exception 'Timed range must include the owner start, exclude the upper bound and hide the neighbor';
  end if;

  if (select array_agg(legacy_convex_id order by start_date, id)
      from public.calendar_events
      where deleted_at is null and start_date >= date '2026-11-26' and start_date < date '2026-11-27')
      is distinct from array['calendar-all-day'] then
    raise exception 'All-day range must use local dates and exclude timed rows';
  end if;

  if not exists (select from realtime.channels where pattern = 'calendar_events:%') then
    raise exception 'Owner could not subscribe to their calendar channel';
  end if;

  begin
    update public.calendar_events set user_id = other_id where legacy_convex_id = 'calendar-timed';
    raise exception 'Owner could transfer event ownership';
  exception when sqlstate '42501' then null;
  end;

  update public.calendar_events set title = 'Updated point', deleted_at = 2, updated_at = 2
  where legacy_convex_id = 'calendar-timed';
  if not exists (
    select from public.calendar_events
    where legacy_convex_id = 'calendar-timed' and title = 'Updated point' and deleted_at = 2 and updated_at = 2
  ) then
    raise exception 'Owner could not update and soft-delete the event';
  end if;

  update public.calendar_events set deleted_at = null, updated_at = 3 where legacy_convex_id = 'calendar-timed';
  if not exists (select from public.calendar_events where legacy_convex_id = 'calendar-timed' and deleted_at is null) then
    raise exception 'Owner could not restore a soft-deleted event';
  end if;

  begin
    delete from public.calendar_events where legacy_convex_id = 'calendar-timed';
    if found then
      raise exception 'Owner could hard-delete an event';
    end if;
  exception when sqlstate '42501' then null;
  end;

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
    exception when sqlstate '23514' then
      get stacked diagnostics rejected_constraint = constraint_name;
      if rejected_constraint <> 'calendar_events_schedule_check' then raise; end if;
    end;
  end loop;

  begin
    update public.calendar_events set title = E' \t\n' where legacy_convex_id = 'calendar-timed';
    raise exception 'Whitespace-only event title was accepted';
  exception when sqlstate '23514' then null;
  end;
end;
$$;

select set_config('request.jwt.claims',
  jsonb_build_object('sub', :'other_id', 'role', 'authenticated')::text, true);

do $$
declare
  owner_id constant uuid := current_setting('tempo_test.owner_id')::uuid;
begin
  if exists (select from public.calendar_events where user_id = owner_id) then
    raise exception 'Cross-owner calendar read was allowed';
  end if;
  update public.calendar_events set title = 'Foreign change' where user_id = owner_id;
  if found then
    raise exception 'Cross-owner calendar update was allowed';
  end if;
  begin
    insert into public.calendar_events (user_id, title, starts_at_ms, created_at, updated_at)
    values (owner_id, 'Foreign insert', 1795651200000, 1, 1);
    raise exception 'Cross-owner calendar insert was allowed';
  exception when sqlstate '42501' then null;
  end;
  if exists (select from realtime.channels where pattern = 'calendar_events:%') then
    raise exception 'Cross-owner calendar subscription was allowed';
  end if;
end;
$$;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  begin
    if exists (select from public.calendar_events) then
      raise exception 'Anonymous calendar read was allowed';
    end if;
  exception when sqlstate '42501' then null;
  end;
  begin
    insert into public.calendar_events (user_id, title, starts_at_ms, created_at, updated_at)
    values (current_setting('tempo_test.owner_id')::uuid, 'Anonymous insert', 1795651200000, 1, 1);
    raise exception 'Anonymous calendar insert was allowed';
  exception when sqlstate '42501' then null;
  end;
end;
$$;

reset role;

do $$
declare
  owner_id constant uuid := current_setting('tempo_test.owner_id')::uuid;
  expected record;
begin
  for expected in select * from (values
    ('calendar-timed', 'INSERT', 1), ('calendar-later', 'INSERT', 1),
    ('calendar-all-day', 'INSERT', 1), ('calendar-timed', 'UPDATE', 2)
  ) as events(legacy_id, op, total)
  loop
    if (select count(*)
        from realtime.messages m
        join realtime.channels c on c.id = m.channel_id
        join public.calendar_events e on e.legacy_convex_id = expected.legacy_id
        where c.pattern = 'calendar_events:%' and c.enabled
          and m.channel_name = 'calendar_events:' || owner_id::text
          and m.event_name = expected.op and m.sender_type = 'system'
          and m.payload = jsonb_build_object('table', 'calendar_events', 'op', expected.op, 'id', e.id))
        <> expected.total then
      raise exception 'Incorrect calendar event count, channel, or id-only payload for %.%',
        expected.legacy_id, expected.op;
    end if;
  end loop;

  begin
    insert into public.calendar_events (user_id, title, starts_at_ms, created_at, updated_at)
    values ('00000000-0000-4000-8000-000000000099', 'Missing owner', 1795651200000, 1, 1);
    raise exception 'A calendar event with no auth user was allowed';
  exception when sqlstate '23503' then null;
  end;
  begin
    insert into public.calendar_events (user_id, title, starts_at_ms, created_at, updated_at, legacy_convex_id)
    values (owner_id, 'Duplicate legacy ID', 1795651200000, 1, 1, 'calendar-timed');
    raise exception 'Duplicate legacy ID was allowed';
  exception when sqlstate '23505' then null;
  end;
end;
$$;

update public.account_gate set is_active = false where user_id = :'owner_id';
set local role authenticated;
select set_config('request.jwt.claims',
  jsonb_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);

do $$
begin
  if exists (select from public.calendar_events) then
    raise exception 'Inactive owner could read calendar events';
  end if;
  update public.calendar_events set title = 'Inactive change' where legacy_convex_id = 'calendar-timed';
  if found then
    raise exception 'Inactive owner could update calendar events';
  end if;
  begin
    insert into public.calendar_events (user_id, title, starts_at_ms, created_at, updated_at)
    values (auth.uid(), 'Inactive insert', 1795651200000, 1, 1);
    raise exception 'Inactive owner could insert calendar events';
  exception when sqlstate '42501' then null;
  end;
end;
$$;

rollback;

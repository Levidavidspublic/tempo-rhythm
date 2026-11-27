begin;

update public.account_gate set approval_status = 'approved'
where user_id in (:'owner_id', :'other_id');

select set_config('tempo_test.owner_id', :'owner_id', true);
select set_config('tempo_test.other_id', :'other_id', true);

insert into public.habits (id, user_id, name, cadence, created_at, updated_at)
values ('00000000-0000-4000-8000-000000002911', :'other_id', 'Other', 'weekly', 1, 1);

insert into public.habit_check_ins (user_id, habit_id, local_date, checked_at, source, created_at, updated_at)
values (:'other_id', '00000000-0000-4000-8000-000000002911', '2026-11-26', 1, 'legacy', 1, 1);

do $$
begin
  begin
    insert into public.habit_check_ins (user_id, habit_id, local_date, checked_at, source, created_at, updated_at)
    values (current_setting('tempo_test.owner_id')::uuid, '00000000-0000-4000-8000-000000002911',
      '2026-11-27', 1, 'today', 1, 1);
    raise exception 'Composite foreign key allowed a mismatched habit owner';
  exception when sqlstate '23503' then null;
  end;
  begin
    insert into public.habits (user_id, name, cadence, created_at, updated_at)
    values ('00000000-0000-4000-8000-000000009911', 'Missing owner', 'daily', 1, 1);
    raise exception 'Habit referenced a nonexistent auth user';
  exception when sqlstate '23503' then null;
  end;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims',
  jsonb_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);

do $$
declare
  owner_id constant uuid := auth.uid();
  other_id constant uuid := current_setting('tempo_test.other_id')::uuid;
  other_habit_id constant uuid := '00000000-0000-4000-8000-000000002911';
  own_habit_id constant uuid := '00000000-0000-4000-8000-000000002910';
  first_check_in_id constant uuid := '00000000-0000-4000-8000-000000003910';
begin
  insert into public.habits (id, user_id, name, cadence, created_at, updated_at, legacy_convex_id)
  values (own_habit_id, owner_id, 'Walk', 'daily', 1, 1, 'q54-habit');

  if (select count(*) from public.habits) <> 1
      or not exists (select 1 from public.habits where id = own_habit_id)
      or exists (select 1 from public.habit_check_ins) then
    raise exception 'Owner saw foreign rows or could not read their own habit';
  end if;

  update public.habits set name = 'Walk farther', updated_at = 2 where id = own_habit_id;
  if not found or not exists (select 1 from public.habits where id = own_habit_id and name = 'Walk farther') then
    raise exception 'Owner could not update their habit';
  end if;

  update public.habits set name = 'Denied' where id = other_habit_id;
  if found then raise exception 'Owner could update another account habit'; end if;
  update public.habit_check_ins set note = 'Denied' where habit_id = other_habit_id;
  if found then raise exception 'Owner could update another account check-in'; end if;

  begin
    insert into public.habits (user_id, name, cadence, created_at, updated_at)
    values (other_id, 'Denied', 'daily', 1, 1);
    raise exception 'RLS allowed inserting a habit for another account';
  exception when sqlstate '42501' then null;
  end;
  begin
    update public.habits set user_id = other_id where id = own_habit_id;
    raise exception 'RLS allowed transferring a habit to another account';
  exception when sqlstate '42501' then null;
  end;
  begin
    update public.habits set cadence = 'monthly' where id = own_habit_id;
    raise exception 'Cadence constraint allowed an unsupported cadence';
  exception when sqlstate '23514' then null;
  end;
  begin
    update public.habits set current_streak = -1 where id = own_habit_id;
    raise exception 'Streak constraint allowed a negative streak';
  exception when sqlstate '23514' then null;
  end;
  begin
    update public.habits set current_streak = 2, longest_streak = 1 where id = own_habit_id;
    raise exception 'Streak constraint allowed the longest streak below the current streak';
  exception when sqlstate '23514' then null;
  end;
  begin
    insert into public.habits (user_id, name, cadence, created_at, updated_at, legacy_convex_id)
    values (owner_id, 'Duplicate', 'daily', 1, 1, 'q54-habit');
    raise exception 'Duplicate legacy habit ID was accepted';
  exception when sqlstate '23505' then null;
  end;

  begin
    insert into public.habit_check_ins (user_id, habit_id, local_date, checked_at, source, created_at, updated_at)
    values (owner_id, other_habit_id, '2026-11-28', 1, 'today', 1, 1);
    raise exception 'RLS allowed checking in against another account habit';
  exception when sqlstate '42501' then null;
  end;

  insert into public.habit_check_ins (id, user_id, habit_id, local_date, checked_at, source,
    created_at, updated_at, legacy_convex_id)
  values (first_check_in_id, owner_id, own_habit_id, '2026-11-26', 1, 'today', 1, 1, 'q54-check-in');

  update public.habit_check_ins set note = 'Walked after lunch', updated_at = 2 where id = first_check_in_id;
  if not found or not exists (select 1 from public.habit_check_ins
      where id = first_check_in_id and note = 'Walked after lunch') then
    raise exception 'Owner could not read or update their check-in';
  end if;

  begin
    update public.habit_check_ins set habit_id = other_habit_id, local_date = '2026-11-29'
    where id = first_check_in_id;
    raise exception 'RLS allowed relinking a check-in to another account habit';
  exception when sqlstate '42501' then null;
  end;
  begin
    insert into public.habit_check_ins (user_id, habit_id, local_date, checked_at, source, created_at, updated_at)
    values (owner_id, own_habit_id, '2026-11-26', 2, 'habits', 2, 2);
    raise exception 'Unique index allowed a second live habit check-in for the day';
  exception when sqlstate '23505' then null;
  end;
  begin
    insert into public.habit_check_ins (user_id, habit_id, local_date, checked_at, source,
      created_at, updated_at, legacy_convex_id)
    values (owner_id, own_habit_id, '2026-11-27', 2, 'habits', 2, 2, 'q54-check-in');
    raise exception 'Duplicate legacy check-in ID was accepted';
  exception when sqlstate '23505' then null;
  end;
  begin
    insert into public.habit_check_ins (user_id, habit_id, local_date, checked_at, source, created_at, updated_at)
    values (owner_id, own_habit_id, '2026-12-01', 2, 'invalid', 2, 2);
    raise exception 'Source constraint allowed an unsupported check-in source';
  exception when sqlstate '23514' then null;
  end;
  begin
    insert into public.habit_check_ins (user_id, habit_id, local_date, checked_at, source, created_at, updated_at)
    values (owner_id, own_habit_id, '10000-01-01', 2, 'today', 2, 2);
    raise exception 'Date constraint allowed a year outside the supported range';
  exception when sqlstate '23514' then null;
  end;
  begin
    insert into public.habit_check_ins (user_id, habit_id, local_date, checked_at, source, created_at, updated_at)
    values (owner_id, own_habit_id, '2026-02-29', 2, 'today', 2, 2);
    raise exception 'Calendar date allowed February 29 in a non-leap year';
  exception when sqlstate '22008' then null;
  end;

  delete from public.habit_check_ins where id = first_check_in_id;
  if found or not exists (select 1 from public.habit_check_ins where id = first_check_in_id) then
    raise exception 'RLS allowed hard deleting a check-in';
  end if;
  update public.habit_check_ins set deleted_at = 3, updated_at = 3 where id = first_check_in_id;
  if not found or exists (select 1 from public.habit_check_ins where deleted_at is null) then
    raise exception 'Undo did not leave the day unchecked';
  end if;
  insert into public.habit_check_ins (user_id, habit_id, local_date, checked_at, source, created_at, updated_at)
  values (owner_id, own_habit_id, '2026-11-26', 4, 'habits', 4, 4);
  if (select count(*) from public.habit_check_ins) <> 2
      or (select count(*) from public.habit_check_ins where deleted_at is null) <> 1
      or not exists (select 1 from public.habit_check_ins where id = first_check_in_id and deleted_at = 3) then
    raise exception 'Rechecking did not retain the tombstone and new live row';
  end if;

  delete from public.habits where id = own_habit_id;
  if found or not exists (select 1 from public.habits where id = own_habit_id) then
    raise exception 'RLS allowed hard deleting a habit';
  end if;
  update public.habits set deleted_at = 5, updated_at = 5 where id = own_habit_id;
  if not found or (select deleted_at from public.habits where id = own_habit_id) is distinct from 5::bigint then
    raise exception 'Owner could not archive their habit';
  end if;
  begin
    insert into public.habit_check_ins (user_id, habit_id, local_date, checked_at, source, created_at, updated_at)
    values (owner_id, own_habit_id, '2026-11-30', 5, 'today', 5, 5);
    raise exception 'RLS allowed checking in against an archived habit';
  exception when sqlstate '42501' then null;
  end;
  update public.habits set deleted_at = null, updated_at = 6 where id = own_habit_id;
  if not found or not exists (select 1 from public.habits where id = own_habit_id and deleted_at is null) then
    raise exception 'Owner could not restore their habit';
  end if;

  perform set_config('realtime.channel_name', 'habits:' || owner_id::text, true);
  if (select array_agg(pattern) from realtime.channels) is distinct from array['habits:%'] then
    raise exception 'Owner could not subscribe to their habit channel';
  end if;
  perform set_config('realtime.channel_name', 'habit_check_ins:' || owner_id::text, true);
  if (select array_agg(pattern) from realtime.channels) is distinct from array['habit_check_ins:%'] then
    raise exception 'Owner could not subscribe to their check-in channel';
  end if;
end;
$$;

select set_config('request.jwt.claims',
  jsonb_build_object('sub', :'other_id', 'role', 'authenticated')::text, true);
do $$
declare
  owner_id constant uuid := current_setting('tempo_test.owner_id')::uuid;
begin
  if exists (select 1 from public.habits where user_id = owner_id)
      or exists (select 1 from public.habit_check_ins where user_id = owner_id) then
    raise exception 'Other user could read the owner habit or check-in';
  end if;
  update public.habits set name = 'Denied' where user_id = owner_id;
  if found then raise exception 'Other user could edit the owner habit'; end if;
  update public.habit_check_ins set note = 'Denied' where user_id = owner_id;
  if found then raise exception 'Other user could edit the owner check-in'; end if;
  if exists (select 1 from realtime.channels) then
    raise exception 'Other user could subscribe to the owner check-in channel';
  end if;
end;
$$;

reset role;
do $$
declare
  owner_id constant uuid := current_setting('tempo_test.owner_id')::uuid;
  expected record;
begin
  for expected in select * from (values
    ('habits', '00000000-0000-4000-8000-000000002910'::uuid, 'INSERT', 1),
    ('habits', '00000000-0000-4000-8000-000000002910'::uuid, 'UPDATE', 3),
    ('habit_check_ins', '00000000-0000-4000-8000-000000003910'::uuid, 'INSERT', 1),
    ('habit_check_ins', '00000000-0000-4000-8000-000000003910'::uuid, 'UPDATE', 2)
  ) as events(table_name, row_id, op, event_count)
  loop
    if (select count(*) from realtime.messages
        where channel_name = expected.table_name || ':' || owner_id::text
          and event_name = expected.op and sender_type = 'system'
          and payload = jsonb_build_object('table', expected.table_name, 'op', expected.op, 'id', expected.row_id))
        <> expected.event_count then
      raise exception 'Incorrect event count, channel, or row metadata for %.%', expected.table_name, expected.op;
    end if;
  end loop;
end;
$$;

update public.account_gate set is_active = false where user_id = :'owner_id';
set local role authenticated;
select set_config('request.jwt.claims',
  jsonb_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);
do $$
begin
  if exists (select 1 from public.habits) or exists (select 1 from public.habit_check_ins) then
    raise exception 'Inactive account could see habit data';
  end if;
  begin
    insert into public.habits (user_id, name, cadence, created_at, updated_at)
    values (auth.uid(), 'Denied', 'daily', 1, 1);
    raise exception 'RLS allowed an inactive account to create a habit';
  exception when sqlstate '42501' then null;
  end;
end;
$$;

set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';
do $$
begin
  if exists (select 1 from public.habits) or exists (select 1 from public.habit_check_ins) then
    raise exception 'Anonymous role could see habit data';
  end if;
end;
$$;

rollback;

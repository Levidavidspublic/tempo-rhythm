begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000001910', 'q54-owner@example.invalid'),
  ('00000000-0000-4000-8000-000000001911', 'q54-other@example.invalid'),
  ('00000000-0000-4000-8000-000000001912', 'q54-inactive@example.invalid');

insert into public.habits (id, user_id, name, cadence, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000002911', '00000000-0000-4000-8000-000000001911', 'Other', 'weekly', 1, 1),
  ('00000000-0000-4000-8000-000000002912', '00000000-0000-4000-8000-000000001912', 'Inactive', 'daily', 1, 1);

insert into public.habit_check_ins (user_id, habit_id, local_date, checked_at, source, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000001911', '00000000-0000-4000-8000-000000002911', '2026-11-26', 1, 'legacy', 1, 1),
  ('00000000-0000-4000-8000-000000001912', '00000000-0000-4000-8000-000000002912', '2026-11-26', 1, 'today', 1, 1);

update public.account_gate set is_active = false where user_id = '00000000-0000-4000-8000-000000001912';

do $$
begin
  begin
    insert into public.habit_check_ins (user_id, habit_id, local_date, checked_at, source, created_at, updated_at)
    values ('00000000-0000-4000-8000-000000001910', '00000000-0000-4000-8000-000000002911', '2026-11-26', 1, 'today', 1, 1);
    raise exception 'Owned link constraint allowed a mismatched owner';
  exception when foreign_key_violation then
    null;
  end;
end;
$$;

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000001910"}';

do $$
declare
  owner_id uuid := auth.uid();
  other_id constant uuid := '00000000-0000-4000-8000-000000001911';
  other_habit_id constant uuid := '00000000-0000-4000-8000-000000002911';
  owned_habit_id uuid;
  first_check_in_id uuid;
  later_check_in_id uuid;
begin
  insert into public.habits (user_id, name, cadence, created_at, updated_at)
  values (owner_id, 'Walk', 'daily', 1, 1)
  returning id into owned_habit_id;

  if (select count(*) from public.habits) <> 1 or exists (select 1 from public.habit_check_ins) then
    raise exception 'Owner saw foreign rows or could not read their own habit';
  end if;

  update public.habits set name = 'Denied' where id = other_habit_id;
  if found then
    raise exception 'Owner could update another account habit';
  end if;

  update public.habit_check_ins set note = 'Denied' where habit_id = other_habit_id;
  if found then
    raise exception 'Owner could update another account check-in';
  end if;

  begin
    insert into public.habits (user_id, name, cadence, created_at, updated_at)
    values (other_id, 'Denied', 'daily', 1, 1);
    raise exception 'RLS allowed inserting a habit for another account';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.habits set user_id = other_id where id = owned_habit_id;
    raise exception 'RLS allowed transferring a habit to another account';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.habit_check_ins (user_id, habit_id, local_date, checked_at, source, created_at, updated_at)
    values (owner_id, other_habit_id, '2026-11-26', 1, 'today', 1, 1);
    raise exception 'RLS allowed checking in against another account habit';
  exception when insufficient_privilege then
    null;
  end;

  insert into public.habit_check_ins (user_id, habit_id, local_date, checked_at, source, created_at, updated_at)
  values (owner_id, owned_habit_id, '2026-11-26', 1, 'today', 1, 1)
  returning id into first_check_in_id;

  begin
    update public.habit_check_ins set habit_id = other_habit_id where id = first_check_in_id;
    raise exception 'RLS allowed relinking a check-in to another account habit';
  exception when insufficient_privilege then
    null;
  end;

  begin
    insert into public.habit_check_ins (user_id, habit_id, local_date, checked_at, source, created_at, updated_at)
    values (owner_id, owned_habit_id, '2026-11-26', 2, 'habits', 2, 2);
    raise exception 'Unique constraint allowed a second live habit check-in for the day';
  exception when unique_violation then
    null;
  end;

  begin
    insert into public.habit_check_ins (user_id, habit_id, local_date, checked_at, source, created_at, updated_at)
    values (owner_id, owned_habit_id, '2026-11-27', 2, 'invalid', 2, 2);
    raise exception 'Source constraint allowed an unsupported check-in source';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.habit_check_ins (user_id, habit_id, local_date, checked_at, source, created_at, updated_at)
    values (owner_id, owned_habit_id, '2026-02-29', 2, 'today', 2, 2);
    raise exception 'Calendar date allowed February 29 in a non-leap year';
  exception when datetime_field_overflow then
    null;
  end;

  delete from public.habit_check_ins where id = first_check_in_id;
  if found then
    raise exception 'RLS allowed hard deleting a check-in';
  end if;

  update public.habit_check_ins set deleted_at = 2, updated_at = 2 where id = first_check_in_id;
  if not found or exists (select 1 from public.habit_check_ins where deleted_at is null) then
    raise exception 'Undo did not leave the day unchecked';
  end if;

  insert into public.habit_check_ins (user_id, habit_id, local_date, checked_at, source, created_at, updated_at)
  values (owner_id, owned_habit_id, '2026-11-26', 3, 'habits', 3, 3)
  returning id into later_check_in_id;

  if later_check_in_id = first_check_in_id or (select count(*) from public.habit_check_ins) <> 2 then
    raise exception 'Rechecking did not retain the tombstone and new live row';
  end if;

  delete from public.habits where id = owned_habit_id;
  if found then
    raise exception 'RLS allowed hard deleting a habit';
  end if;

  update public.habits set deleted_at = 4, updated_at = 4 where id = owned_habit_id;
  if not found then
    raise exception 'Owner could not archive their habit';
  end if;

  begin
    insert into public.habit_check_ins (user_id, habit_id, local_date, checked_at, source, created_at, updated_at)
    values (owner_id, owned_habit_id, '2026-11-27', 5, 'today', 5, 5);
    raise exception 'RLS allowed checking in against an archived habit';
  exception when insufficient_privilege then
    null;
  end;

  update public.habits set deleted_at = null, updated_at = 5 where id = owned_habit_id;
  if not found then
    raise exception 'Owner could not restore their habit';
  end if;

  perform pg_catalog.set_config('realtime.channel_name', 'habit_check_ins:' || owner_id::text, true);
  if not exists (select 1 from realtime.channels where pattern = 'habit_check_ins:%') then
    raise exception 'Owner could not subscribe to their check-in channel';
  end if;

  perform pg_catalog.set_config('realtime.channel_name', 'habits:' || other_id::text, true);
  if exists (select 1 from realtime.channels where pattern = 'habits:%') then
    raise exception 'RLS allowed subscribing to another account habit channel';
  end if;
end;
$$;

set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000001912"}';

do $$
begin
  if exists (select 1 from public.habits) or exists (select 1 from public.habit_check_ins) then
    raise exception 'Inactive account could see habit data';
  end if;

  begin
    insert into public.habits (user_id, name, cadence, created_at, updated_at)
    values (auth.uid(), 'Denied', 'daily', 1, 1);
    raise exception 'RLS allowed an inactive account to create a habit';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

do $$
begin
  if exists (select 1 from public.habits) or exists (select 1 from public.habit_check_ins) then
    raise exception 'Anonymous role could see habit data';
  end if;
end;
$$;

rollback;

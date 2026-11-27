begin;

update public.account_gate set approval_status = 'approved' where user_id in (:'owner_id', :'other_id');
select set_config('tempo_test.owner_id', :'owner_id', true);
select set_config('tempo_test.other_id', :'other_id', true);

insert into public.goals (user_id, title, created_at, updated_at, legacy_convex_id)
values (:'other_id', 'Other goal', 1795690000000, 1795690000000, 'goals-fixture-other');

set local role authenticated;
select set_config('request.jwt.claims',
  jsonb_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);

do $$
declare
  now_ms constant bigint := 1795690000000;
  goal_id uuid;
begin
  insert into public.goals (user_id, title, created_at, updated_at)
  values (auth.uid(), 'Owner goal', now_ms, now_ms)
  returning id into strict goal_id;

  if not exists (
    select from public.goals where id = goal_id and user_id = auth.uid()
      and deleted_at is null and status = 'active' and progress_percent = 0
  ) then
    raise exception 'Owner cannot read goal defaults';
  end if;

  update public.goals set status = 'archived', progress_percent = 42.5, updated_at = now_ms + 1
  where id = goal_id;
  if not exists (
    select from public.goals where id = goal_id and status = 'archived' and progress_percent = 42.5
  ) then
    raise exception 'Owner cannot update goal';
  end if;

  update public.goals set deleted_at = now_ms + 2, updated_at = now_ms + 2 where id = goal_id;
  if not exists (select from public.goals where id = goal_id and deleted_at = now_ms + 2) then
    raise exception 'Owner cannot soft-delete goal';
  end if;
  update public.goals set deleted_at = null, updated_at = now_ms + 3 where id = goal_id;
  if not exists (select from public.goals where id = goal_id and deleted_at is null) then
    raise exception 'Owner cannot restore goal';
  end if;

  if has_column_privilege('public.goals', 'user_id', 'UPDATE')
    or has_column_privilege('public.goals', 'id', 'INSERT, UPDATE')
    or has_column_privilege('public.goals', 'legacy_convex_id', 'INSERT, UPDATE')
    or has_column_privilege('public.goals', 'created_at', 'UPDATE') then
    raise exception 'Client can write protected goal fields';
  end if;
  begin
    delete from public.goals where id = goal_id;
    raise exception 'Hard delete was allowed';
  exception when sqlstate '42501' then null;
  end;
  begin
    update public.goals set status = 'resting' where id = goal_id;
    raise exception 'Invalid stored status was allowed';
  exception when sqlstate '23514' then null;
  end;
  begin
    update public.goals set progress_percent = 101 where id = goal_id;
    raise exception 'Out-of-range progress was allowed';
  exception when sqlstate '23514' then null;
  end;

  perform set_config('realtime.channel_name', 'goals:' || auth.uid()::text, true);
  if not exists (select from realtime.channels where pattern = 'goals:%') then
    raise exception 'Owner cannot select own goals channel';
  end if;
  perform set_config('tempo_test.goal_id', goal_id::text, true);
end;
$$;

select set_config('request.jwt.claims',
  jsonb_build_object('sub', :'other_id', 'role', 'authenticated')::text, true);

do $$
declare
  owner_id constant uuid := current_setting('tempo_test.owner_id')::uuid;
  goal_id constant uuid := current_setting('tempo_test.goal_id')::uuid;
begin
  if exists (select from public.goals where id = goal_id) then
    raise exception 'Cross-owner read was allowed';
  end if;
  update public.goals set title = 'Forbidden' where id = goal_id;
  if found then
    raise exception 'Cross-owner update was allowed';
  end if;
  begin
    insert into public.goals (user_id, title, created_at, updated_at)
    values (owner_id, 'Forbidden', 1795690000000, 1795690000000);
    raise exception 'Cross-owner insert was allowed';
  exception when sqlstate '42501' then null;
  end;
  if exists (select from realtime.channels where pattern = 'goals:%') then
    raise exception 'Cross-owner goals channel was allowed';
  end if;
end;
$$;

reset role;
do $$
declare
  owner_id constant uuid := current_setting('tempo_test.owner_id')::uuid;
  other_id constant uuid := current_setting('tempo_test.other_id')::uuid;
  goal_id constant uuid := current_setting('tempo_test.goal_id')::uuid;
  expected record;
begin
  for expected in select * from (values ('INSERT', 1), ('UPDATE', 3)) as events(op, total)
  loop
    if (select count(*)
        from realtime.messages m join realtime.channels c on c.id = m.channel_id
        where c.pattern = 'goals:%' and c.enabled and m.channel_name = 'goals:' || owner_id::text
          and m.event_name = expected.op and m.sender_type = 'system'
          and m.payload = jsonb_build_object('table', 'goals', 'op', expected.op, 'id', goal_id))
        <> expected.total then
      raise exception 'Incorrect goals event count, channel, or id-only payload for %', expected.op;
    end if;
  end loop;

  begin
    insert into public.goals (user_id, title, created_at, updated_at)
    values ('00000000-0000-4000-8000-000000000099', 'Missing owner', 1795690000000, 1795690000000);
    raise exception 'A goal with no auth user was allowed';
  exception when sqlstate '23503' then null;
  end;
  begin
    insert into public.goals (user_id, title, created_at, updated_at, legacy_convex_id)
    values (other_id, 'Duplicate legacy ID', 1795690000000, 1795690000000, 'goals-fixture-other');
    raise exception 'Duplicate legacy ID was allowed';
  exception when sqlstate '23505' then null;
  end;
end;
$$;

update public.account_gate set is_active = false where user_id = :'other_id';
set local role authenticated;

do $$
begin
  if exists (select from public.goals where user_id = auth.uid()) then
    raise exception 'Inactive owner can read own goal';
  end if;
  update public.goals set title = 'Forbidden' where user_id = auth.uid();
  if found then
    raise exception 'Inactive owner can update own goal';
  end if;
  begin
    insert into public.goals (user_id, title, created_at, updated_at)
    values (auth.uid(), 'Forbidden', 1795690000000, 1795690000000);
    raise exception 'Inactive owner can insert a goal';
  exception when sqlstate '42501' then null;
  end;
end;
$$;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  if exists (select from public.goals) then
    raise exception 'Anonymous read was allowed';
  end if;
exception when sqlstate '42501' then null;
end;
$$;

rollback;

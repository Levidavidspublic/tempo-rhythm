begin;

insert into auth.users (id, email)
values
  ('5a130000-0000-4000-8000-000000000001', 'goals-owner@example.invalid'),
  ('5a130000-0000-4000-8000-000000000002', 'goals-other@example.invalid');

insert into public.goals (user_id, title, created_at, updated_at, legacy_convex_id)
values ('5a130000-0000-4000-8000-000000000002', 'Other goal', 1795690000000, 1795690000000, 'goals-fixture-other');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '5a130000-0000-4000-8000-000000000001', 'role', 'authenticated'
)::text, true);

do $$
declare
  other_user constant uuid := '5a130000-0000-4000-8000-000000000002';
  now_ms constant bigint := 1795690000000;
  goal_id uuid;
begin
  insert into public.goals (user_id, title, created_at, updated_at)
  values (auth.uid(), 'Owner goal', now_ms, now_ms)
  returning id into strict goal_id;

  if not exists (
    select 1 from public.goals
    where id = goal_id and user_id = auth.uid()
      and deleted_at is null and status = 'active' and progress_percent = 0
  ) then
    raise exception 'Owner cannot read goal defaults';
  end if;

  update public.goals set status = 'archived', progress_percent = 42.5, updated_at = now_ms + 1
  where id = goal_id;
  if not exists (
    select 1 from public.goals
    where id = goal_id and deleted_at is null and status = 'archived' and progress_percent = 42.5
  ) then
    raise exception 'Archived goal is not selectable';
  end if;

  update public.goals set deleted_at = now_ms + 2, updated_at = now_ms + 2 where id = goal_id;
  if not exists (select 1 from public.goals where id = goal_id and deleted_at = now_ms + 2) then
    raise exception 'Owner cannot soft-delete goal';
  end if;
  update public.goals set deleted_at = null, updated_at = now_ms + 3 where id = goal_id;
  if not exists (select 1 from public.goals where id = goal_id and deleted_at is null) then
    raise exception 'Owner cannot restore goal';
  end if;

  if exists (select 1 from public.goals where user_id = other_user) then
    raise exception 'Cross-owner read was allowed';
  end if;
  update public.goals set title = 'Forbidden' where user_id = other_user;
  if found then
    raise exception 'Cross-owner update was allowed';
  end if;
  begin
    insert into public.goals (user_id, title, created_at, updated_at)
    values (other_user, 'Forbidden', now_ms, now_ms);
    raise exception 'Cross-owner insert was allowed';
  exception when insufficient_privilege then null;
  end;

  if has_column_privilege('public.goals', 'user_id', 'UPDATE')
    or has_column_privilege('public.goals', 'id', 'INSERT, UPDATE')
    or has_column_privilege('public.goals', 'legacy_convex_id', 'INSERT, UPDATE')
    or has_column_privilege('public.goals', 'created_at', 'UPDATE') then
    raise exception 'Client can write protected goal fields';
  end if;
  begin
    delete from public.goals where id = goal_id;
    raise exception 'Hard delete was allowed';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.goals set status = 'resting' where id = goal_id;
    raise exception 'Invalid stored status was allowed';
  exception when check_violation then null;
  end;
  begin
    update public.goals set progress_percent = 101 where id = goal_id;
    raise exception 'Out-of-range progress was allowed';
  exception when check_violation then null;
  end;

  perform set_config('realtime.channel_name', 'goals:' || auth.uid()::text, true);
  if not exists (select 1 from realtime.channels where pattern = 'goals:%') then
    raise exception 'Owner cannot select own goals channel';
  end if;
  perform set_config('realtime.channel_name', 'goals:' || other_user::text, true);
  if exists (select 1 from realtime.channels where pattern = 'goals:%') then
    raise exception 'Cross-owner goals channel was allowed';
  end if;
end;
$$;

reset role;
update public.account_gate set is_active = false
where user_id = '5a130000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', '5a130000-0000-4000-8000-000000000002', 'role', 'authenticated'
)::text, true);

do $$
begin
  if exists (select 1 from public.goals where user_id = auth.uid()) then
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
  exception when insufficient_privilege then null;
  end;
  perform set_config('realtime.channel_name', 'goals:' || auth.uid()::text, true);
  if exists (select 1 from realtime.channels where pattern = 'goals:%') then
    raise exception 'Inactive owner can select own goals channel';
  end if;
end;
$$;

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  perform 1 from public.goals;
  raise exception 'Anonymous read was allowed';
exception when insufficient_privilege then null;
end;
$$;

rollback;

begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'focus-owner@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'focus-other@example.test');

insert into public.tasks (id, user_id, title, status, priority, created_at, updated_at, deleted_at)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
   'Live owned task', 'todo', 'medium', 1, 1, null),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002',
   'Other user task', 'todo', 'medium', 1, 1, null),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001',
   'Deleted owned task', 'todo', 'medium', 1, 2, 2);

insert into public.focus_blocks (user_id, started_at_ms, duration_ms, created_at, updated_at, deleted_at)
values
  ('00000000-0000-4000-8000-000000000002', 150, 1, 1, 1, null),
  ('00000000-0000-4000-8000-000000000001', 175, 1, 1, 2, 2);

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001"}', true
);

do $$
declare
  owner_id uuid := auth.uid();
  other_id uuid := '00000000-0000-4000-8000-000000000002';
  block_id uuid;
  invalid_task uuid;
  invalid_duration bigint;
  deleted_ms bigint;
  updated_ms bigint;
  starts bigint[];
begin
  insert into public.focus_blocks (user_id, started_at_ms, duration_ms, created_at, updated_at)
  values (owner_id, 99, 1, 1, 1), (owner_id, 100, 1, 1, 1), (owner_id, 300, 1, 1, 1);

  insert into public.focus_blocks (
    user_id, started_at_ms, duration_ms, label, task_id, created_at, updated_at, legacy_convex_id
  ) values (
    owner_id, 200, 28800000, repeat('x', 120), '10000000-0000-4000-8000-000000000001', 1, 1, 'focus-fixture'
  ) returning id into strict block_id;

  select array_agg(started_at_ms order by started_at_ms desc) into starts
  from public.focus_blocks
  where deleted_at is null and started_at_ms >= 100 and started_at_ms < 300;
  if starts is distinct from array[200, 100]::bigint[] then
    raise exception 'Expected newest-first, live, owner-only blocks in [100, 300); got %', starts;
  end if;

  update public.focus_blocks set deleted_at = 2
  where id = block_id returning deleted_at, updated_at into strict deleted_ms, updated_ms;
  if deleted_ms is null or deleted_ms <= 2 or deleted_ms is distinct from updated_ms then
    raise exception 'Soft delete did not stamp both timestamps on the server';
  end if;

  begin
    update public.focus_blocks set deleted_at = 3 where id = block_id;
    raise exception 'Repeated soft delete must be denied';
  exception when check_violation then null;
  end;

  update public.focus_blocks set deleted_at = null where id = block_id;
  if not found or not exists (
    select 1 from public.focus_blocks where id = block_id and deleted_at is null
  ) then
    raise exception 'Recent soft delete should be reversible';
  end if;

  begin
    update public.focus_blocks set deleted_at = null where id = block_id;
    raise exception 'A live block is not restorable';
  exception when check_violation then null;
  end;

  begin
    update public.focus_blocks set deleted_at = null where started_at_ms = 175;
    raise exception 'Restore outside the 30-day grace window must be denied';
  exception when check_violation then null;
  end;

  update public.focus_blocks set deleted_at = 2 where user_id = other_id;
  if found then raise exception 'Updating another owner''s block must affect no rows'; end if;

  begin
    insert into public.focus_blocks (user_id, started_at_ms, duration_ms, created_at, updated_at)
    values (other_id, 400, 1, 1, 1);
    raise exception 'Inserting a block for another owner must be denied';
  exception when insufficient_privilege then null;
  end;

  foreach invalid_task in array array[
    '10000000-0000-4000-8000-000000000002'::uuid,
    '10000000-0000-4000-8000-000000000003'::uuid
  ] loop
    begin
      insert into public.focus_blocks (user_id, started_at_ms, duration_ms, task_id, created_at, updated_at)
      values (owner_id, 400, 1, invalid_task, 1, 1);
      raise exception 'Linking a foreign or deleted task must be denied';
    exception when insufficient_privilege then null;
    end;
  end loop;

  foreach invalid_duration in array array[0, 28800001]::bigint[] loop
    begin
      insert into public.focus_blocks (user_id, started_at_ms, duration_ms, created_at, updated_at)
      values (owner_id, 400, invalid_duration, 1, 1);
      raise exception 'An out-of-bounds duration must be denied';
    exception when check_violation then null;
    end;
  end loop;

  begin
    insert into public.focus_blocks (user_id, started_at_ms, duration_ms, label, created_at, updated_at)
    values (owner_id, 400, 1, repeat('x', 121), 1, 1);
    raise exception 'A label longer than 120 characters must be denied';
  exception when check_violation then null;
  end;

  begin
    update public.focus_blocks set user_id = other_id where id = block_id;
    raise exception 'Reassigning a block must be denied';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.focus_blocks where id = block_id;
    raise exception 'Hard delete must be denied';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
update public.account_gate set is_active = false
where user_id = '00000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000002"}', true
);

do $$
begin
  if exists (select 1 from public.focus_blocks) then
    raise exception 'Inactive accounts must not read even their own blocks';
  end if;

  begin
    insert into public.focus_blocks (user_id, started_at_ms, duration_ms, created_at, updated_at)
    values (auth.uid(), 400, 1, 1, 1);
    raise exception 'Inactive accounts must not insert blocks';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role anon;
select pg_catalog.set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  perform 1 from public.focus_blocks;
  raise exception 'Anonymous reads must be denied';
exception when insufficient_privilege then null;
end;
$$;

rollback;

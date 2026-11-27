begin;

update public.account_gate set approval_status = 'approved'
where user_id in (:'owner_id', :'other_id');

select set_config('tempo_test.owner_id', :'owner_id', true);

insert into public.tasks (id, user_id, title, status, priority, created_at, updated_at, deleted_at)
values
  ('10000000-0000-4000-8000-000000000001', :'owner_id', 'Live owned task', 'todo', 'medium', 1, 1, null),
  ('10000000-0000-4000-8000-000000000002', :'other_id', 'Other user task', 'todo', 'medium', 1, 1, null),
  ('10000000-0000-4000-8000-000000000003', :'owner_id', 'Deleted owned task', 'todo', 'medium', 1, 2, 2);

insert into public.focus_blocks (id, user_id, started_at_ms, duration_ms, created_at, updated_at, deleted_at)
values
  ('20000000-0000-4000-8000-000000000002', :'other_id', 150, 1, 1, 1, null),
  ('20000000-0000-4000-8000-000000000003', :'owner_id', 175, 1, 1, 2, 2);

do $$
declare
  fk_name text;
begin
  begin
    insert into public.focus_blocks (user_id, started_at_ms, duration_ms, task_id, created_at, updated_at)
    values (current_setting('tempo_test.owner_id')::uuid, 400, 1, '10000000-0000-4000-8000-000000000002', 1, 1);
    raise exception 'The composite FK accepted a different owner';
  exception when sqlstate '23503' then
    get stacked diagnostics fk_name = constraint_name;
    if fk_name is distinct from 'focus_blocks_owner_task_fk' then
      raise exception 'Unexpected FK violation: %', fk_name;
    end if;
  end;
end
$$;

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);
select set_config('realtime.channel_name', 'focus_blocks:' || :'owner_id', true);

do $$
declare
  owner_id uuid := auth.uid();
  block_id constant uuid := '20000000-0000-4000-8000-000000000001';
  invalid_task uuid;
  invalid_duration bigint;
  block public.focus_blocks;
  starts bigint[];
begin
  insert into public.focus_blocks (user_id, started_at_ms, duration_ms, created_at, updated_at)
  values (owner_id, 99, 1, 1, 1), (owner_id, 100, 1, 1, 1), (owner_id, 300, 1, 1, 1);

  insert into public.focus_blocks (
    id, user_id, started_at_ms, duration_ms, label, task_id, created_at, updated_at, legacy_convex_id
  ) values (
    block_id, owner_id, 200, 28800000, repeat('x', 120), '10000000-0000-4000-8000-000000000001', 1, 1, 'focus-fixture'
  );

  select array_agg(started_at_ms order by started_at_ms desc) into starts
  from public.focus_blocks
  where deleted_at is null and started_at_ms >= 100 and started_at_ms < 300;
  if starts is distinct from array[200, 100]::bigint[] then
    raise exception 'Expected newest-first live owner blocks in [100, 300); got %', starts;
  end if;
  if (select array_agg(pattern) from realtime.channels) is distinct from array['focus_blocks:%'] then
    raise exception 'Owner cannot subscribe to their focus channel';
  end if;

  select * into strict block from public.apply_focus_block_lifecycle(block_id, false);
  if block.deleted_at is null or block.deleted_at <= 2 or block.deleted_at is distinct from block.updated_at then
    raise exception 'Soft delete did not stamp both timestamps on the server';
  end if;

  begin
    perform public.apply_focus_block_lifecycle(block_id, false);
    raise exception 'Repeated soft delete must be denied';
  exception when sqlstate '23514' then null;
  end;

  select * into strict block from public.apply_focus_block_lifecycle(block_id, true);
  if block.deleted_at is not null or not exists (
    select 1 from public.focus_blocks where id = block_id and deleted_at is null
  ) then
    raise exception 'Recent soft delete should be reversible';
  end if;

  begin
    perform public.apply_focus_block_lifecycle(block_id, true);
    raise exception 'A live block is not restorable';
  exception when sqlstate '23514' then null;
  end;

  begin
    perform public.apply_focus_block_lifecycle('20000000-0000-4000-8000-000000000003', true);
    raise exception 'Restore outside the 30-day grace window must be denied';
  exception when sqlstate '23514' then null;
  end;

  foreach invalid_task in array array[
    '10000000-0000-4000-8000-000000000002'::uuid,
    '10000000-0000-4000-8000-000000000003'::uuid
  ] loop
    begin
      insert into public.focus_blocks (user_id, started_at_ms, duration_ms, task_id, created_at, updated_at)
      values (owner_id, 400, 1, invalid_task, 1, 1);
      raise exception 'Linking a foreign or deleted task must be denied';
    exception when sqlstate '42501' then null;
    end;
  end loop;

  foreach invalid_duration in array array[0, 28800001]::bigint[] loop
    begin
      insert into public.focus_blocks (user_id, started_at_ms, duration_ms, created_at, updated_at)
      values (owner_id, 400, invalid_duration, 1, 1);
      raise exception 'An out-of-bounds duration must be denied';
    exception when sqlstate '23514' then null;
    end;
  end loop;

  begin
    insert into public.focus_blocks (user_id, started_at_ms, duration_ms, label, created_at, updated_at)
    values (owner_id, 400, 1, repeat('x', 121), 1, 1);
    raise exception 'A label longer than 120 characters must be denied';
  exception when sqlstate '23514' then null;
  end;

  begin
    update public.focus_blocks set deleted_at = 2 where id = block_id;
    raise exception 'Direct update must not bypass the lifecycle function';
  exception when sqlstate '42501' then null;
  end;

  begin
    delete from public.focus_blocks where id = block_id;
    raise exception 'Hard delete must be denied';
  exception when sqlstate '42501' then null;
  end;
end
$$;

select set_config('request.jwt.claims', jsonb_build_object('sub', :'other_id', 'role', 'authenticated')::text, true);

do $$
declare
  owner_id uuid := current_setting('tempo_test.owner_id')::uuid;
  block_id constant uuid := '20000000-0000-4000-8000-000000000001';
begin
  if exists (select 1 from public.focus_blocks where user_id = owner_id)
     or exists (select 1 from realtime.channels) then
    raise exception 'The other account can read the owner rows or subscribe to their channel';
  end if;

  begin
    perform public.apply_focus_block_lifecycle(block_id, false);
    raise exception 'The other account can soft-delete an owner block';
  exception when sqlstate 'P0002' then null;
  end;

  begin
    insert into public.focus_blocks (user_id, started_at_ms, duration_ms, created_at, updated_at)
    values (owner_id, 400, 1, 1, 1);
    raise exception 'The other account can insert a block for the owner';
  exception when sqlstate '42501' then null;
  end;
end
$$;

reset role;
update public.account_gate set is_active = false where user_id = :'other_id';
set local role authenticated;

do $$
begin
  if exists (select 1 from public.focus_blocks) then
    raise exception 'Inactive accounts must not read their own blocks';
  end if;
  begin
    perform public.apply_focus_block_lifecycle('20000000-0000-4000-8000-000000000002', false);
    raise exception 'Inactive accounts must not change their own blocks';
  exception when sqlstate '42501' then null;
  end;
end
$$;

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
do $$
begin
  begin
    perform public.apply_focus_block_lifecycle('20000000-0000-4000-8000-000000000001', false);
    raise exception 'The lifecycle function must require a subject';
  exception when sqlstate '42501' then null;
  end;
end
$$;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  if has_function_privilege('public.apply_focus_block_lifecycle(uuid, boolean)', 'EXECUTE') then
    raise exception 'Anonymous accounts must not have execute permission';
  end if;

  begin
    if exists (select 1 from public.focus_blocks) then
      raise exception 'Anonymous accounts must not read focus blocks';
    end if;
  exception when sqlstate '42501' then null;
  end;

  begin
    perform public.apply_focus_block_lifecycle('20000000-0000-4000-8000-000000000001', false);
    raise exception 'Anonymous accounts must not execute the lifecycle function';
  exception when sqlstate '42501' then null;
  end;
end
$$;

reset role;
do $$
declare
  channel text := 'focus_blocks:' || current_setting('tempo_test.owner_id');
  block_id constant uuid := '20000000-0000-4000-8000-000000000001';
begin
  if (select count(*) from realtime.messages
      where channel_name = channel and event_name = 'INSERT' and sender_type = 'system'
        and payload = jsonb_build_object('table', 'focus_blocks', 'op', 'INSERT', 'id', block_id)) <> 1
    or (select count(*) from realtime.messages
        where channel_name = channel and event_name = 'UPDATE' and sender_type = 'system'
          and payload = jsonb_build_object('table', 'focus_blocks', 'op', 'UPDATE', 'id', block_id)) <> 2 then
    raise exception 'Expected id-only events for the insert, delete, and restore';
  end if;
end
$$;

rollback;

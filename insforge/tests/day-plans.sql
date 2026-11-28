begin;

update public.account_gate set approval_status = 'approved'
where user_id in (:'owner_id', :'other_id');

select set_config('tempo_test.owner_id', :'owner_id', true);

insert into public.tasks (id, user_id, title, status, priority, created_at, updated_at)
values
  ('24000000-0000-4000-8000-000000000001', :'owner_id', 'Owner task', 'todo', 'low', 1, 1),
  ('24000000-0000-4000-8000-000000000002', :'other_id', 'Other task', 'todo', 'low', 1, 1);

insert into public.habits (id, user_id, name, cadence, created_at, updated_at)
values
  ('24000000-0000-4000-8000-000000000011', :'owner_id', 'Owner habit', 'daily', 1, 1),
  ('24000000-0000-4000-8000-000000000012', :'other_id', 'Other habit', 'daily', 1, 1);

insert into public.day_plans (id, user_id, local_date, status, created_at, updated_at)
values ('24000000-0000-4000-8000-000000000022', :'other_id', date '2026-11-27', 'draft', 1, 1);

insert into public.time_blocks (id, user_id, local_date, day_plan_id, title, start_minute,
  duration_minutes, starts_at_ms, ends_at_ms, kind, status, source, created_at, updated_at)
values ('24000000-0000-4000-8000-000000000032', :'other_id', date '2026-11-27',
  '24000000-0000-4000-8000-000000000022', 'Other block', 0, 5, 1000, 301000,
  'focus', 'planned', 'user', 1, 1);

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);

do $$
declare
  plan_id constant uuid := '24000000-0000-4000-8000-000000000021';
  block_id constant uuid := '24000000-0000-4000-8000-000000000031';
  task_id constant uuid := '24000000-0000-4000-8000-000000000001';
  foreign_task constant uuid := '24000000-0000-4000-8000-000000000002';
  fk record;
  bad_tasks uuid[];
  bad_array text;
  slot integer;
  relation text;
begin
  insert into public.day_plans (id, user_id, local_date, top_task_ids, energy, status, created_at, updated_at)
  values (plan_id, auth.uid(), date '2026-11-27', array[task_id], 'medium', 'draft', 1, 1);
  insert into public.time_blocks (id, user_id, local_date, day_plan_id, title, start_minute,
    duration_minutes, starts_at_ms, ends_at_ms, kind, task_id, habit_id, status, source, created_at, updated_at)
  values (block_id, auth.uid(), date '2026-11-27', plan_id, 'Owner block', 0, 5, 1000, 301000,
    'habit', task_id, '24000000-0000-4000-8000-000000000011', 'planned', 'user', 1, 1);

  if (select array_agg(id) from public.day_plans) is distinct from array[plan_id]
    or (select array_agg(id) from public.time_blocks) is distinct from array[block_id] then
    raise exception 'Owner did not see precisely their own plan and block';
  end if;

  foreach bad_array in array array[
    array[task_id, task_id, task_id, task_id]::text,
    array[null::uuid]::text,
    array[array[task_id]]::text,
    format('[0:0]={%s}', task_id)
  ] loop
    begin
      update public.day_plans set top_task_ids = bad_array::uuid[] where id = plan_id;
      raise exception 'Invalid top tasks were accepted: %', bad_array;
    exception when sqlstate '23514' then null;
    end;
  end loop;

  for slot in 1..3 loop
    bad_tasks := pg_catalog.array_fill(task_id, array[3]);
    bad_tasks[slot] := foreign_task;
    begin
      update public.day_plans set top_task_ids = bad_tasks where id = plan_id;
      raise exception 'Top task slot % linked another account', slot;
    exception when sqlstate '23503' then null;
    end;
  end loop;

  for fk in select * from (values
    ('day_plan_id', '24000000-0000-4000-8000-000000000022'::uuid),
    ('task_id', foreign_task),
    ('habit_id', '24000000-0000-4000-8000-000000000012'::uuid)
  ) as references_to_other(column_name, foreign_id) loop
    begin
      execute format('update public.time_blocks set %I = $1 where id = $2', fk.column_name)
      using fk.foreign_id, block_id;
      raise exception 'Time block linked another account through %', fk.column_name;
    exception when sqlstate '23503' then null;
    end;
  end loop;
  begin
    update public.time_blocks set local_date = date '2026-11-28' where id = block_id;
    raise exception 'Time block kept a plan from another date';
  exception when sqlstate '23503' then null;
  end;
  begin
    insert into public.day_plans (user_id, local_date, status, created_at, updated_at)
    values (auth.uid(), date '2026-11-27', 'draft', 1, 1);
    raise exception 'Owner created two live plans for the same date';
  exception when sqlstate '23505' then null;
  end;
  begin
    update public.time_blocks set duration_minutes = 4 where id = block_id;
    raise exception 'Time block allowed a duration under five minutes';
  exception when sqlstate '23514' then null;
  end;
  begin
    update public.time_blocks set ends_at_ms = starts_at_ms where id = block_id;
    raise exception 'Time block accepted nonpositive elapsed time';
  exception when sqlstate '23514' then null;
  end;

  update public.day_plans set status = 'committed', committed_at = 2, updated_at = 2 where id = plan_id;
  if not found or not exists (select 1 from public.day_plans where id = plan_id and status = 'committed') then
    raise exception 'Owner cannot update their plan';
  end if;
  update public.time_blocks set status = 'done', updated_at = 2 where id = block_id;
  if not found or not exists (select 1 from public.time_blocks where id = block_id and status = 'done') then
    raise exception 'Owner cannot update their block';
  end if;
  update public.day_plans set deleted_at = 3, updated_at = 3 where id = plan_id;
  if not found or not exists (select 1 from public.day_plans where id = plan_id and deleted_at = 3) then
    raise exception 'Owner cannot soft-delete their plan';
  end if;
  update public.time_blocks set deleted_at = 3, updated_at = 3 where id = block_id;
  if not found or not exists (select 1 from public.time_blocks where id = block_id and deleted_at = 3) then
    raise exception 'Owner cannot soft-delete their block';
  end if;

  foreach relation in array array['day_plans', 'time_blocks'] loop
    begin
      execute format('delete from public.%I', relation);
      raise exception 'Owner hard-deleted %', relation;
    exception when sqlstate '42501' then null;
    end;
    perform set_config('realtime.channel_name', relation || ':' || auth.uid()::text, true);
    if (select array_agg(pattern) from realtime.channels) is distinct from array[relation || ':%'] then
      raise exception 'Owner cannot subscribe to %', relation;
    end if;
  end loop;
end
$$;

select set_config('request.jwt.claims', jsonb_build_object('sub', :'other_id', 'role', 'authenticated')::text, true);
do $$
declare
  owner_id constant uuid := current_setting('tempo_test.owner_id')::uuid;
  relation text;
begin
  foreach relation in array array['day_plans', 'time_blocks'] loop
    perform set_config('realtime.channel_name', relation || ':' || owner_id::text, true);
    if exists (select 1 from realtime.channels) then
      raise exception 'Another account can subscribe to %', relation;
    end if;
  end loop;
  if exists (select 1 from public.day_plans where user_id = owner_id)
    or exists (select 1 from public.time_blocks where user_id = owner_id) then
    raise exception 'Another account can read the owner rows';
  end if;
  update public.day_plans set intention = 'Denied' where user_id = owner_id;
  if found then raise exception 'Another account could update the owner plan'; end if;
  update public.time_blocks set title = 'Denied' where user_id = owner_id;
  if found then raise exception 'Another account could update the owner block'; end if;
  begin
    insert into public.day_plans (user_id, local_date, status, created_at, updated_at)
    values (owner_id, date '2026-11-28', 'draft', 1, 1);
    raise exception 'Another account could insert the owner plan';
  exception when sqlstate '42501' then null;
  end;
  begin
    insert into public.time_blocks (user_id, local_date, title, start_minute, duration_minutes,
      starts_at_ms, ends_at_ms, kind, status, source, created_at, updated_at)
    values (owner_id, date '2026-11-28', 'Denied', 0, 5, 1000, 301000, 'focus', 'planned', 'user', 1, 1);
    raise exception 'Another account could insert the owner block';
  exception when sqlstate '42501' then null;
  end;
end
$$;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
declare
  relation text;
begin
  foreach relation in array array['day_plans', 'time_blocks'] loop
    begin
      execute format('select 1 from public.%I', relation);
      raise exception 'Anonymous client can read %', relation;
    exception when sqlstate '42501' then null;
    end;
  end loop;
end
$$;

reset role;
do $$
declare
  expected record;
begin
  for expected in select * from (values
    ('day_plans', '24000000-0000-4000-8000-000000000021'::uuid),
    ('time_blocks', '24000000-0000-4000-8000-000000000031'::uuid)
  ) as changes(table_name, row_id) loop
    if (select count(*) from realtime.messages
        where channel_name = expected.table_name || ':' || current_setting('tempo_test.owner_id')) <> 3
      or (select count(*) from realtime.messages
          where channel_name = expected.table_name || ':' || current_setting('tempo_test.owner_id')
            and sender_type = 'system' and event_name = 'INSERT'
            and payload = jsonb_build_object('table', expected.table_name, 'op', 'INSERT', 'id', expected.row_id)) <> 1
      or (select count(*) from realtime.messages
          where channel_name = expected.table_name || ':' || current_setting('tempo_test.owner_id')
            and sender_type = 'system' and event_name = 'UPDATE'
            and payload = jsonb_build_object('table', expected.table_name, 'op', 'UPDATE', 'id', expected.row_id)) <> 2
    then
      raise exception 'Expected ID-only insert and update events from %', expected.table_name;
    end if;
  end loop;
end
$$;

set local role project_admin;
do $$
begin
  begin
    delete from public.day_plans;
    raise exception 'project_admin hard delete must be denied';
  exception when sqlstate '42501' then null;
  end;
  begin
    truncate public.time_blocks;
    raise exception 'project_admin truncate must be denied';
  exception when sqlstate '42501' then null;
  end;
end;
$$;

rollback;

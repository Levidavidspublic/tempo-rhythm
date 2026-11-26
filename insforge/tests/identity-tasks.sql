begin;

select set_config('tempo_test.owner_id', :'owner_id', true);
select set_config('tempo_test.other_id', :'other_id', true);

do $$
declare
  fixture_users uuid[] := array[
    current_setting('tempo_test.owner_id')::uuid,
    current_setting('tempo_test.other_id')::uuid
  ];
begin
  if (select count(*) from public.account_gate where user_id = any(fixture_users)
      and approval_status = 'pending') <> 2
    or (select count(*) from public.profiles where user_id = any(fixture_users)) <> 2
    or (select count(*) from public.subscription_states where user_id = any(fixture_users)) <> 2 then
    raise exception 'auth.users trigger did not create the pending gate, profile and subscription rows';
  end if;
end
$$;

insert into public.task_repeat_cfgs (id, user_id, repeat_cycle, repeat_every, weekdays,
  skip_overdue, wait_for_completion, repeat_from_completion_date, is_paused, created_at, updated_at)
values ('00000000-0000-4000-8000-000000000011', :'other_id', 'DAILY', 1, '{}',
  false, false, false, false, 1, 1);

insert into public.tasks (id, user_id, title, status, priority, created_at, updated_at)
values ('00000000-0000-4000-8000-000000000012', :'other_id', 'Other parent', 'todo', 'low', 1, 1);

set local role authenticated;
select set_config('request.jwt.claims',
  jsonb_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);

do $$
declare
  owner_id uuid := current_setting('tempo_test.owner_id')::uuid;
  repeat_id uuid;
  parent_id uuid;
  child_id uuid;
begin
  if (select count(*) from public.account_gate) <> 1 or
     (select count(*) from public.profiles) <> 1 or
     exists (select from public.subscription_states) then
    raise exception 'identity RLS exposed another account or private billing rows';
  end if;
  update public.profiles set name = 'Owner', updated_at = 2 where user_id = owner_id;
  if not found then raise exception 'owner could not update profile'; end if;

  insert into public.task_repeat_cfgs (user_id, repeat_cycle, repeat_every, weekdays,
    skip_overdue, wait_for_completion, repeat_from_completion_date, is_paused, created_at, updated_at)
  values (owner_id, 'DAILY', 1, '{}', false, false, false, false, 1, 1) returning id into repeat_id;
  insert into public.tasks (user_id, title, status, priority, created_at, updated_at)
  values (owner_id, 'Owner parent', 'todo', 'low', 1, 1) returning id into parent_id;
  insert into public.tasks (user_id, title, status, priority, created_at, updated_at,
    repeat_cfg_id, parent_task_id)
  values (owner_id, 'Owner child', 'todo', 'low', 1, 1, repeat_id, parent_id) returning id into child_id;
  update public.tasks set title = 'Owner updated', updated_at = 2 where id = child_id;
  if not found or (select count(*) from public.tasks) <> 2 or
     (select count(*) from public.task_repeat_cfgs) <> 1 then
    raise exception 'owner reads or writes failed';
  end if;

  begin
    update public.tasks set repeat_cfg_id = '00000000-0000-4000-8000-000000000011'
      where id = child_id;
    raise exception 'cross-owner recurrence link succeeded';
  exception when foreign_key_violation then null;
  end;

  begin
    update public.tasks set parent_task_id = '00000000-0000-4000-8000-000000000012'
      where id = child_id;
    raise exception 'cross-owner parent link succeeded';
  exception when foreign_key_violation then null;
  end;

  delete from public.tasks where id = child_id;
  if found or not exists (select from public.tasks where id = child_id) then
    raise exception 'authenticated owner hard-deleted a task';
  end if;
  update public.tasks set deleted_at = 3, updated_at = 3 where id = child_id;
  if not found then raise exception 'authenticated owner could not soft-delete a task'; end if;
end
$$;

select set_config('request.jwt.claims',
  jsonb_build_object('sub', :'other_id', 'role', 'authenticated')::text, true);

do $$
declare
  owner_id uuid := current_setting('tempo_test.owner_id')::uuid;
begin
  if exists (select from public.tasks where user_id = owner_id)
     or exists (select from public.task_repeat_cfgs where user_id = owner_id)
     or exists (select from public.profiles where user_id = owner_id)
     or exists (select from public.account_gate where user_id = owner_id) then
    raise exception 'other user can see owner rows';
  end if;
  update public.tasks set title = 'Unauthorized update', updated_at = 3 where user_id = owner_id;
  if found then raise exception 'other user updated an owner task'; end if;
  begin
    insert into public.tasks (user_id, title, status, priority, created_at, updated_at)
    values (owner_id, 'Unauthorized insert', 'todo', 'low', 1, 1);
    raise exception 'other user inserted an owner task';
  exception when insufficient_privilege then null;
  end;
end
$$;

reset role;
update public.account_gate set is_active = false where user_id = :'owner_id';
set local role authenticated;
select set_config('request.jwt.claims',
  jsonb_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);

do $$
begin
  if public.account_is_active() or exists (select from public.tasks) or
     exists (select from public.profiles) or exists (select from public.task_repeat_cfgs) then
    raise exception 'inactive account can read owner data';
  end if;
  begin
    insert into public.tasks (user_id, title, status, priority, created_at, updated_at)
    values (auth.uid(), 'Inactive insert', 'todo', 'low', 1, 1);
    raise exception 'inactive account inserted a task';
  exception when insufficient_privilege then null;
  end;
end
$$;

rollback;

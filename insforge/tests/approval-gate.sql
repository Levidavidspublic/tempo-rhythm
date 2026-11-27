begin;

select set_config('tempo_test.owner_id', :'owner_id', true);
select set_config('tempo_test.other_id', :'other_id', true);
select set_config('tempo_test.revoked_id', '00000000-0000-4000-8000-000000000031', true);

insert into auth.users (id, email)
values (current_setting('tempo_test.revoked_id')::uuid, 'tempo-revoked@example.invalid');

update public.account_gate set approval_status = 'approved' where user_id = :'owner_id';
update public.account_gate set approval_status = 'revoked'
where user_id = current_setting('tempo_test.revoked_id')::uuid;

insert into public.tasks (user_id, title, status, priority, created_at, updated_at)
select user_id, 'Existing task', 'todo', 'low', 1, 1
from public.account_gate
where user_id in (:'owner_id', :'other_id', current_setting('tempo_test.revoked_id')::uuid);

set local role authenticated;

do $$
declare
  approved_id uuid := current_setting('tempo_test.owner_id')::uuid;
  actor record;
  task_id uuid;
begin
  for actor in
    select * from (values
      (approved_id, 'approved'),
      (current_setting('tempo_test.other_id')::uuid, 'pending'),
      (current_setting('tempo_test.revoked_id')::uuid, 'revoked')
    ) as cases(user_id, approval_status)
  loop
    perform set_config('request.jwt.claims',
      jsonb_build_object('sub', actor.user_id, 'role', 'authenticated')::text, true);

    if (select count(*) from public.account_gate) <> 1
      or not exists (select from public.account_gate
        where user_id = actor.user_id and approval_status = actor.approval_status) then
      raise exception '% account cannot read exactly its own gate row', actor.approval_status;
    end if;

    if actor.approval_status = 'approved' then
      if not public.account_is_active()
        or not exists (select from public.tasks where user_id = actor.user_id)
        or not exists (select from public.profiles where user_id = actor.user_id)
        or exists (select from public.tasks where user_id <> actor.user_id)
        or exists (select from public.profiles where user_id <> actor.user_id) then
        raise exception 'approved account cannot read exactly its own tasks and profile';
      end if;

      insert into public.tasks (user_id, title, status, priority, created_at, updated_at)
      values (actor.user_id, 'New task', 'todo', 'low', 1, 1) returning id into task_id;

      update public.tasks set title = 'Updated task', updated_at = 2 where id = task_id;
      if not found then raise exception 'approved account could not update its task'; end if;

      update public.profiles set name = 'Approved owner', updated_at = 2 where user_id = actor.user_id;
      if not found then raise exception 'approved account could not update its profile'; end if;
    else
      if public.account_is_active() or exists (select from public.tasks)
        or exists (select from public.profiles) then
        raise exception '% account can read owner data', actor.approval_status;
      end if;

      update public.tasks set title = 'Unexpected task update', updated_at = 2 where user_id = actor.user_id;
      if found then raise exception '% account updated a task', actor.approval_status; end if;

      update public.profiles set name = 'Unexpected profile update', updated_at = 2 where user_id = actor.user_id;
      if found then raise exception '% account updated a profile', actor.approval_status; end if;

      begin
        insert into public.tasks (user_id, title, status, priority, created_at, updated_at)
        values (actor.user_id, 'Unexpected task insert', 'todo', 'low', 1, 1);
        raise exception '% account inserted a task', actor.approval_status;
      exception when insufficient_privilege then null;
      end;

      begin
        insert into public.profiles (user_id, name, created_at, updated_at)
        values (actor.user_id, 'Unexpected profile insert', 1, 1) on conflict do nothing;
        raise exception '% account passed the profile insert policy', actor.approval_status;
      exception when insufficient_privilege then null;
      end;
    end if;
  end loop;
end
$$;

rollback;

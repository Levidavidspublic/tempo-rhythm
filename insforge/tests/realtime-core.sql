begin;

select set_config('tempo_test.owner_id', :'owner_id', true);
select set_config('tempo_test.message_count', (select count(*) from realtime.messages)::text, true);

set local role authenticated;
select set_config('request.jwt.claims',
  jsonb_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);

insert into public.tasks (id, user_id, title, status, priority, created_at, updated_at)
values ('00000000-0000-4000-8000-000000000021', :'owner_id', 'Private task title', 'todo', 'low', 1, 1);
update public.tasks set title = 'Private new title', updated_at = 2
where id = '00000000-0000-4000-8000-000000000021';
insert into public.task_repeat_cfgs (id, user_id, repeat_cycle, repeat_every, weekdays,
  skip_overdue, wait_for_completion, repeat_from_completion_date, is_paused, created_at, updated_at)
values ('00000000-0000-4000-8000-000000000022', :'owner_id', 'DAILY', 1, '{}',
  false, false, false, false, 1, 1);
update public.profiles set name = 'Private profile name', updated_at = 2 where user_id = :'owner_id';

reset role;
do $$
declare
  owner_id uuid := current_setting('tempo_test.owner_id')::uuid;
  expected record;
begin
  if (select count(*) from realtime.messages) <> current_setting('tempo_test.message_count')::integer + 4 then
    raise exception 'expected exactly one event per change';
  end if;
  for expected in
    select * from (values
      ('tasks', 'INSERT', '00000000-0000-4000-8000-000000000021'::uuid),
      ('tasks', 'UPDATE', '00000000-0000-4000-8000-000000000021'::uuid),
      ('task_repeat_cfgs', 'INSERT', '00000000-0000-4000-8000-000000000022'::uuid),
      ('profiles', 'UPDATE', owner_id)
    ) as events(table_name, op, row_id)
  loop
    if (select count(*) from realtime.messages
        where channel_name = expected.table_name || ':' || owner_id::text
          and event_name = expected.op
          and sender_type = 'system'
          and payload = jsonb_build_object('table', expected.table_name, 'op', expected.op,
            'id', expected.row_id)) <> 1 then
      raise exception 'incorrect channel, operation, or id-only payload for %.%',
        expected.table_name, expected.op;
    end if;
  end loop;
  if exists (select from realtime.channels where pattern in ('account_gate:%', 'subscription_states:%')) then
    raise exception 'gate or subscription rows should not have a realtime channel';
  end if;
end
$$;

set local role authenticated;
select set_config('realtime.channel_name', 'tasks:' || :'owner_id', true);
do $$
begin
  if (select array_agg(pattern) from realtime.channels) is distinct from array['tasks:%'] then
    raise exception 'owner could not subscribe to exactly the requested task channel';
  end if;
end
$$;

select set_config('realtime.channel_name', 'tasks:' || :'owner_id' || ':extra', true);
do $$
begin
  if exists (select from realtime.channels) then
    raise exception 'owner subscription accepted a channel with an extra segment';
  end if;
end
$$;

select set_config('realtime.channel_name', 'tasks:' || :'owner_id', true);
select set_config('request.jwt.claims',
  jsonb_build_object('sub', :'other_id', 'role', 'authenticated')::text, true);
do $$
begin
  if exists (select from realtime.channels) then
    raise exception 'other user can subscribe to the owner task channel';
  end if;
  begin
    insert into realtime.messages (channel_name, event_name, payload, sender_type)
    values (realtime.channel_name(), 'INSERT', '{}'::jsonb, 'user');
    raise exception 'client can publish directly to the owner stream';
  exception when insufficient_privilege then null;
  end;
end
$$;

rollback;

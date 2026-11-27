begin;

update public.account_gate set approval_status = 'approved'
where user_id in (:'owner_id', :'other_id');

select set_config('tempo_test.owner_id', :'owner_id', true);

insert into public.conversations (id, user_id, created_at, updated_at)
values
  ('25000000-0000-4000-8000-000000000001', :'owner_id', 1, 1),
  ('25000000-0000-4000-8000-000000000002', :'other_id', 1, 1);

insert into public.tasks (id, user_id, title, status, priority, created_at, updated_at)
values
  ('25000000-0000-4000-8000-000000000011', :'owner_id', 'Owner task 1', 'todo', 'low', 1, 1),
  ('25000000-0000-4000-8000-000000000012', :'owner_id', 'Owner task 2', 'todo', 'low', 1, 1),
  ('25000000-0000-4000-8000-000000000013', :'owner_id', 'Owner task 3', 'todo', 'low', 1, 1),
  ('25000000-0000-4000-8000-000000000014', :'owner_id', 'Owner task 4', 'todo', 'low', 1, 1),
  ('25000000-0000-4000-8000-000000000015', :'other_id', 'Other task', 'todo', 'low', 1, 1);

set local role project_admin;
insert into public.chat_requests (
  id, user_id, conversation_id, request_key, payload_digest, sequence, status,
  agent_prompt_message_id, generation_epoch, created_at, updated_at
) values (
  '25000000-0000-4000-8000-000000000021', :'owner_id',
  '25000000-0000-4000-8000-000000000001', 'request_1', repeat('a', 64), 0, 'queued', 'prompt_1', 0, 1, 1
);

insert into public.coach_proposals (id, user_id, task_ids, ten_second_action, realism, created_at, updated_at)
values ('25000000-0000-4000-8000-000000000032', :'other_id',
  array['25000000-0000-4000-8000-000000000015'::uuid],
  'Other action', '{"ok":true,"totalMinutes":5,"availableMinutes":30,"note":""}', 1, 1);

do $$
declare
  request_id constant uuid := '25000000-0000-4000-8000-000000000021';
begin
  if has_table_privilege('public.chat_requests', 'TRUNCATE')
    or has_table_privilege('public.coach_proposals', 'DELETE')
    or has_table_privilege('public.coach_proposals', 'TRUNCATE') then
    raise exception 'The service has a hard-delete privilege on the queue or proposals';
  end if;
  if not exists (select 1 from public.chat_requests where id = request_id and status = 'queued') then
    raise exception 'The service cannot read its queue row';
  end if;
  begin
    update public.chat_requests set conversation_id = '25000000-0000-4000-8000-000000000002'
    where id = request_id;
    raise exception 'A chat request linked another account''s conversation';
  exception when sqlstate '23503' then null;
  end;
  begin
    update public.chat_requests set payload_digest = repeat('A', 64) where id = request_id;
    raise exception 'A noncanonical chat request digest was accepted';
  exception when sqlstate '23514' then null;
  end;
  begin
    insert into public.chat_requests (
      user_id, conversation_id, request_key, payload_digest, sequence, status,
      agent_prompt_message_id, generation_epoch, created_at, updated_at
    ) select user_id, conversation_id, request_key, payload_digest, sequence + 1, status,
      agent_prompt_message_id, generation_epoch, created_at, updated_at
      from public.chat_requests where id = request_id;
    raise exception 'The conversation admitted a duplicate request key';
  exception when sqlstate '23505' then null;
  end;

  update public.chat_requests set status = 'running', generation_epoch = 1,
    generation_lease_expires_at_ms = 1000, updated_at = 2 where id = request_id;
  if not found then raise exception 'The service cannot claim its queue row'; end if;
  update public.chat_requests set status = 'completed', agent_result_message_id = 'result_1',
    deleted_at = 3, generation_lease_expires_at_ms = null, updated_at = 3 where id = request_id;
  if not found or not exists (select 1 from public.chat_requests
      where id = request_id and status = 'completed' and deleted_at = 3) then
    raise exception 'The service cannot complete and soft-delete its queue row';
  end if;
  begin
    delete from public.chat_requests where id = request_id;
    raise exception 'The service hard-deleted the chat request';
  exception when sqlstate '42501' then null;
  end;
end
$$;

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);
select set_config('realtime.channel_name', 'coach_proposals:' || :'owner_id', true);

do $$
declare
  proposal_id constant uuid := '25000000-0000-4000-8000-000000000031';
  own_tasks constant uuid[] := array[
    '25000000-0000-4000-8000-000000000011'::uuid,
    '25000000-0000-4000-8000-000000000012'::uuid,
    '25000000-0000-4000-8000-000000000013'::uuid,
    '25000000-0000-4000-8000-000000000014'::uuid
  ];
  foreign_task constant uuid := '25000000-0000-4000-8000-000000000015';
  good_realism constant jsonb := '{"ok":true,"totalMinutes":20,"availableMinutes":30,"note":""}';
  bad_tasks uuid[];
  slot integer;
begin
  begin
    perform 1 from public.chat_requests;
    raise exception 'The owner could read the private queue directly';
  exception when sqlstate '42501' then null;
  end;
  begin
    update public.chat_requests set status = 'failed';
    raise exception 'The owner could update the private queue directly';
  exception when sqlstate '42501' then null;
  end;

  for slot in 1..4 loop
    bad_tasks := own_tasks;
    bad_tasks[slot] := foreign_task;
    begin
      insert into public.coach_proposals (user_id, task_ids, ten_second_action, realism, created_at, updated_at)
      values (auth.uid(), bad_tasks, 'Own action', good_realism, 1, 1);
      raise exception 'Proposal task slot % linked another account', slot;
    exception when sqlstate '23503' then null;
    end;
  end loop;
  begin
    insert into public.coach_proposals (user_id, task_ids, ten_second_action, realism, created_at, updated_at)
    values (auth.uid(), array[own_tasks[1], own_tasks[1]], 'Own action', good_realism, 1, 1);
    raise exception 'A proposal accepted a duplicate task';
  exception when sqlstate '23514' then null;
  end;
  begin
    insert into public.coach_proposals (user_id, task_ids, ten_second_action, realism, created_at, updated_at)
    values (auth.uid(), own_tasks, 'Own action', '{"ok":true}', 1, 1);
    raise exception 'A proposal accepted an incomplete realism record';
  exception when sqlstate '23514' then null;
  end;

  insert into public.coach_proposals (id, user_id, task_ids, ten_second_action, realism, created_at, updated_at)
  values (proposal_id, auth.uid(), own_tasks, 'Own action', good_realism, 1, 1);
  if (select array_agg(id) from public.coach_proposals) is distinct from array[proposal_id]
    or not exists (select 1 from public.coach_proposals where id = proposal_id and status = 'pending') then
    raise exception 'Owner did not read just the pending proposal';
  end if;
  begin
    insert into public.coach_proposals (user_id, task_ids, ten_second_action, realism, created_at, updated_at)
    values (auth.uid(), own_tasks, 'Another action', good_realism, 1, 1);
    raise exception 'The owner created two live proposals';
  exception when sqlstate '23505' then null;
  end;
  begin
    update public.coach_proposals set status = 'accepted', decided_at = 2 where id = proposal_id;
    raise exception 'The owner decided without the trusted operation';
  exception when sqlstate '42501' then null;
  end;
  update public.coach_proposals set deleted_at = 2, updated_at = 2 where id = proposal_id;
  if not found or not exists (select 1 from public.coach_proposals where id = proposal_id and deleted_at = 2) then
    raise exception 'The owner cannot soft-delete the proposal';
  end if;
  begin
    delete from public.coach_proposals where id = proposal_id;
    raise exception 'The owner hard-deleted the proposal';
  exception when sqlstate '42501' then null;
  end;
  if (select array_agg(pattern) from realtime.channels) is distinct from array['coach_proposals:%'] then
    raise exception 'The owner cannot subscribe to their proposal channel';
  end if;
end
$$;

select set_config('request.jwt.claims', jsonb_build_object('sub', :'other_id', 'role', 'authenticated')::text, true);
do $$
declare
  owner_id constant uuid := current_setting('tempo_test.owner_id')::uuid;
begin
  if exists (select 1 from public.coach_proposals where user_id = owner_id)
    or exists (select 1 from realtime.channels) then
    raise exception 'Another account can read the owner proposal or channel';
  end if;
  update public.coach_proposals set deleted_at = 3 where user_id = owner_id;
  if found then raise exception 'Another account can update the owner proposal'; end if;
  begin
    insert into public.coach_proposals (user_id, task_ids, ten_second_action, realism, created_at, updated_at)
    values (owner_id, array['25000000-0000-4000-8000-000000000011'::uuid],
      'Denied', '{"ok":true,"totalMinutes":5,"availableMinutes":30,"note":""}', 1, 1);
    raise exception 'Another account inserted a proposal for the owner';
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
  foreach relation in array array['chat_requests', 'coach_proposals'] loop
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
  owner_channel text := 'coach_proposals:' || current_setting('tempo_test.owner_id');
  proposal_id constant uuid := '25000000-0000-4000-8000-000000000031';
  operation text;
begin
  foreach operation in array array['INSERT', 'UPDATE'] loop
    if (select count(*) from realtime.messages where channel_name = owner_channel and sender_type = 'system'
        and event_name = operation
        and payload = jsonb_build_object('table', 'coach_proposals', 'op', operation, 'id', proposal_id)) <> 1 then
      raise exception 'Proposal did not emit the expected ID-only % event', operation;
    end if;
  end loop;
  if exists (select 1 from realtime.channels where pattern = 'chat_requests:%')
    or exists (select 1 from realtime.messages where channel_name like 'chat_requests:%') then
    raise exception 'Private chat requests registered a channel or emitted an event';
  end if;
end
$$;

rollback;

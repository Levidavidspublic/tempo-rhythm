begin;

update public.account_gate set approval_status = 'approved'
where user_id in (:'owner_id', :'other_id');

select set_config('tempo_test.owner_id', :'owner_id', true);

insert into public.notes (id, user_id, title, body, created_at, updated_at)
values
  ('26000000-0000-4000-8000-000000000001', :'owner_id', 'Owner page', '', 1, 1),
  ('26000000-0000-4000-8000-000000000002', :'other_id', 'Other page', '', 1, 1);

insert into public.conversations (id, user_id, created_at, updated_at)
values
  ('26000000-0000-4000-8000-000000000011', :'owner_id', 1, 1),
  ('26000000-0000-4000-8000-000000000012', :'other_id', 1, 1);

insert into public.page_operations (
  id, user_id, note_id, request_id, request_digest, kind, source, result, affects_body,
  base_revision, result_revision, base_body_digest, result_body_digest, delta,
  applied_at_ms, undo_until_ms, metadata_expires_at_ms, created_at, updated_at
)
select operation_id, owner_id::uuid, note_id, 'req_01JQ8Z3K4M5N6P7Q8R9S0T1V2W', repeat('a', 64),
  'add_task', 'coach', 'applied', true, 0, 1, repeat('b', 64), repeat('c', 64),
  '[{"startUtf16":0,"removedLengthUtf16":0,"insertedLengthUtf16":1}]'::jsonb,
  1000, 301000, 172801000, 1000, 1000
from (values
  ('26000000-0000-4000-8000-000000000021'::uuid, :'owner_id', '26000000-0000-4000-8000-000000000001'::uuid),
  ('26000000-0000-4000-8000-000000000022'::uuid, :'other_id', '26000000-0000-4000-8000-000000000002'::uuid)
) as fixture(operation_id, owner_id, note_id);

set local role project_admin;
insert into public.page_proposals (
  id, user_id, kind, schema_version, note_id, local_date, conversation_id, source_request_key,
  proposal_revision, expected_page_revision, block_id, status, proposal_expires_at_ms, cleanup_due_at_ms,
  metadata_expires_at_ms, payload, created_at, updated_at
) values (
  '26000000-0000-4000-8000-000000000031', :'owner_id', 'add_task_to_today', 1,
  '26000000-0000-4000-8000-000000000001', date '2026-11-27',
  '26000000-0000-4000-8000-000000000011', 'request_1', 0, 0, 'blk_01JQ8Z3K4M5N6P7Q8R9S0T1V2W',
  'pending', 86400001, 86400002, 172800001, '{"state":"available","task":{"title":"Draft task","durationMin":15}}',
  1, 1
);

do $$
declare
  proposal_id constant uuid := '26000000-0000-4000-8000-000000000031';
begin
  if not exists (select 1 from public.page_proposals where id = proposal_id and payload->>'state' = 'available') then
    raise exception 'The service cannot read its proposal';
  end if;

  begin
    update public.page_proposals set note_id = '26000000-0000-4000-8000-000000000002' where id = proposal_id;
    raise exception 'A foreign page was accepted';
  exception when sqlstate '23503' then null;
  end;
  begin
    update public.page_proposals set conversation_id = '26000000-0000-4000-8000-000000000012' where id = proposal_id;
    raise exception 'A foreign conversation was accepted';
  exception when sqlstate '23503' then null;
  end;
  begin
    update public.page_proposals
    set status = 'confirmed', decided_at_ms = 1000, confirm_digest = repeat('a', 64),
      confirmed_operation_id = '26000000-0000-4000-8000-000000000022'
    where id = proposal_id;
    raise exception 'A foreign confirmation operation was accepted';
  exception when sqlstate '23503' then null;
  end;
  begin
    update public.page_proposals set status = 'confirmed' where id = proposal_id;
    raise exception 'A confirmation without a decision and operation was accepted';
  exception when sqlstate '23514' then null;
  end;
  begin
    update public.page_proposals set payload = '{"state":"available","task":{"title":"Draft","durationMin":"15"}}'
    where id = proposal_id;
    raise exception 'A nonnumeric duration was accepted';
  exception when sqlstate '23514' then null;
  end;

  update public.page_proposals
  set status = 'confirmed', decided_at_ms = 1000, confirm_digest = repeat('a', 64),
    confirmed_operation_id = '26000000-0000-4000-8000-000000000021',
    payload = '{"state":"expired","expiredAtMs":1000}', deleted_at = 1000, updated_at = 1000
  where id = proposal_id;
  if not found or not exists (select 1 from public.page_proposals
      where id = proposal_id and deleted_at = 1000 and payload = '{"state":"expired","expiredAtMs":1000}'::jsonb) then
    raise exception 'The service could not update and soft-delete the proposal';
  end if;
  begin
    delete from public.page_proposals where id = proposal_id;
    raise exception 'The service hard-deleted the proposal';
  exception when sqlstate '42501' then null;
  end;
end
$$;

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);
select set_config('realtime.channel_name', 'nags:' || :'owner_id', true);

do $$
declare
  nag_id constant uuid := '26000000-0000-4000-8000-000000000041';
  bad_phrases jsonb;
begin
  insert into public.nags (id, user_id, label, created_at, updated_at)
  values (nag_id, auth.uid(), 'Owner reminder', 1, 1);
  if not exists (select 1 from public.nags where id = nag_id and not enabled and phrases = '[]') then
    raise exception 'Owner cannot read their new nag';
  end if;

  foreach bad_phrases in array array[
    '{"id":"phrase1"}', '[{"id":"phrase1","text":"Begin","source":"other","status":"accepted"}]',
    '[{"id":"phrase1","text":"Begin","source":"derived","status":"other"}]',
    '[{"id":"phrase1","text":"Begin","source":"derived"}]',
    '[{"id":"phrase1","text":"Begin","source":["user"],"status":"accepted"}]'
  ]::jsonb[] loop
    begin
      update public.nags set phrases = bad_phrases where id = nag_id;
      raise exception 'A malformed phrase was accepted: %', bad_phrases;
    exception when sqlstate '23514' then null;
    end;
  end loop;
  begin
    update public.nags set enabled = true where id = nag_id;
    raise exception 'A nag without an accepted phrase was enabled';
  exception when sqlstate '23514' then null;
  end;

  update public.nags set enabled = true, updated_at = 2,
    phrases = '[{"id":"phrase1","text":"Begin","source":"user","status":"accepted"}]'
  where id = nag_id;
  if not found or not exists (select 1 from public.nags where id = nag_id and enabled) then
    raise exception 'Owner cannot update their nag';
  end if;
  update public.nags set enabled = false, deleted_at = 3, updated_at = 3 where id = nag_id;
  if not found or not exists (select 1 from public.nags where id = nag_id and deleted_at = 3) then
    raise exception 'Owner cannot soft-delete their nag';
  end if;
  begin
    delete from public.nags where id = nag_id;
    raise exception 'The owner hard-deleted the nag';
  exception when sqlstate '42501' then null;
  end;
  if (select array_agg(pattern) from realtime.channels) is distinct from array['nags:%'] then
    raise exception 'Owner cannot subscribe to their nag channel';
  end if;

  begin
    perform 1 from public.page_proposals;
    raise exception 'An authenticated owner could read private proposals';
  exception when sqlstate '42501' then null;
  end;
  begin
    update public.page_proposals set updated_at = 1001;
    raise exception 'An authenticated owner could write private proposals';
  exception when sqlstate '42501' then null;
  end;
end
$$;

select set_config('request.jwt.claims', jsonb_build_object('sub', :'other_id', 'role', 'authenticated')::text, true);
do $$
begin
  if exists (select 1 from public.nags) or exists (select 1 from realtime.channels) then
    raise exception 'A different account can see the owner nag or channel';
  end if;
  update public.nags set label = 'Denied';
  if found then raise exception 'A different account modified the owner nag'; end if;
  begin
    insert into public.nags (user_id, label, created_at, updated_at)
    values (current_setting('tempo_test.owner_id')::uuid, 'Denied', 1, 1);
    raise exception 'A different account inserted a nag for the owner';
  exception when sqlstate '42501' then null;
  end;
end
$$;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform 1 from public.nags;
    raise exception 'Anonymous accounts can read nags';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform 1 from public.page_proposals;
    raise exception 'Anonymous accounts can read private proposals';
  exception when sqlstate '42501' then null;
  end;
end
$$;

reset role;
do $$
declare
  owner_channel text := 'nags:' || current_setting('tempo_test.owner_id');
  nag_id constant uuid := '26000000-0000-4000-8000-000000000041';
begin
  if (select count(*) from realtime.messages where channel_name = owner_channel and sender_type = 'system'
        and event_name = 'INSERT' and payload = jsonb_build_object('table', 'nags', 'op', 'INSERT', 'id', nag_id)) <> 1
    or (select count(*) from realtime.messages where channel_name = owner_channel and sender_type = 'system'
        and event_name = 'UPDATE' and payload = jsonb_build_object('table', 'nags', 'op', 'UPDATE', 'id', nag_id)) <> 2
  then
    raise exception 'Nag insert and updates did not emit the expected id-only events';
  end if;
  if exists (select 1 from realtime.channels where pattern = 'page_proposals:%')
    or exists (select 1 from realtime.messages where channel_name like 'page_proposals:%') then
    raise exception 'A private proposal registered a channel or emitted an event';
  end if;
end
$$;

rollback;

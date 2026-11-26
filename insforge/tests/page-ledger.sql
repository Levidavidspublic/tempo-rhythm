begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000001938', 'q36-owner@example.invalid'),
  ('00000000-0000-4000-8000-000000001939', 'q36-neighbor@example.invalid');

insert into public.notes (id, user_id, title, body, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000002938', '00000000-0000-4000-8000-000000001938', 'Owner', '', 1, 1),
  ('00000000-0000-4000-8000-000000002939', '00000000-0000-4000-8000-000000001939', 'Neighbor', '', 1, 1);

insert into public.page_operations (
  id, user_id, note_id, request_id, request_digest, kind, source, result, affects_body,
  base_revision, result_revision, base_body_digest, result_body_digest, delta,
  applied_at_ms, undo_until_ms, metadata_expires_at_ms, created_at, updated_at
) values
  ('00000000-0000-4000-8000-000000003938', '00000000-0000-4000-8000-000000001938',
    '00000000-0000-4000-8000-000000002938', 'req_01JQ8Z3K4M5N6P7Q8R9S0T1V2W', repeat('a', 64),
    'save', 'ui', 'applied', true, 0, 1, repeat('b', 64), repeat('c', 64),
    '[{"startUtf16":0,"removedLengthUtf16":0,"insertedLengthUtf16":1}]', 1000, 301000, 172801000, 1000, 1000),
  ('00000000-0000-4000-8000-000000003939', '00000000-0000-4000-8000-000000001939',
    '00000000-0000-4000-8000-000000002939', 'req_01JQ8Z3K4M5N6P7Q8R9S0T1V2W', repeat('a', 64),
    'save', 'ui', 'noop', false, 0, 0, repeat('b', 64), repeat('b', 64),
    '[]', 1000, null, 172801000, 1000, 1000);

insert into public.page_operation_payloads (
  id, user_id, note_id, operation_id, undo_until_ms, cleanup_due_at_ms, payload, created_at, updated_at
) values (
  '00000000-0000-4000-8000-000000004938', '00000000-0000-4000-8000-000000001938',
  '00000000-0000-4000-8000-000000002938', '00000000-0000-4000-8000-000000003938', 301000, 601000,
  '{"state":"available","splices":[{"startUtf16":0,"removedText":"","insertedText":"x"}]}', 1000, 1000
);

do $$
declare
  owner_receipt constant uuid := '00000000-0000-4000-8000-000000003938';
  neighbor_receipt constant uuid := '00000000-0000-4000-8000-000000003939';
  owner_payload constant uuid := '00000000-0000-4000-8000-000000004938';
  candidate public.page_operations%rowtype;
  fragments public.page_operation_payloads%rowtype;
begin
  select * into strict candidate from public.page_operations where id = owner_receipt;
  candidate.id := pg_catalog.gen_random_uuid();
  begin
    insert into public.page_operations select (candidate).*;
    raise exception 'Duplicate owner request was accepted';
  exception when unique_violation then null;
  end;

  candidate.request_id := 'req_01JQ8Z3K4M5N6P7Q8R9S0T1V2X';
  candidate.note_id := '00000000-0000-4000-8000-000000002939';
  begin
    insert into public.page_operations select (candidate).*;
    raise exception 'Operation accepted a foreign note';
  exception when foreign_key_violation then null;
  end;

  begin
    update public.page_operations set request_digest = repeat('A', 64) where id = owner_receipt;
    raise exception 'Operation accepted a noncanonical digest';
  exception when check_violation then null;
  end;
  begin
    update public.page_operations set request_id = 'req_81JQ8Z3K4M5N6P7Q8R9S0T1V2W'
    where id = owner_receipt;
    raise exception 'Operation accepted a noncanonical request ID';
  exception when check_violation then null;
  end;
  begin
    update public.page_operations set delta =
      '[{"startUtf16":0,"removedLengthUtf16":0,"insertedLengthUtf16":1,"insertedText":"x"}]'
    where id = owner_receipt;
    raise exception 'Operation delta accepted content';
  exception when check_violation then null;
  end;
  begin
    update public.page_operations set undo_until_ms = null where id = owner_receipt;
    raise exception 'Applied operation accepted no Undo deadline';
  exception when check_violation then null;
  end;
  begin
    update public.page_operations set metadata_expires_at_ms = 172800000 where id = owner_receipt;
    raise exception 'Operation accepted the wrong receipt expiry';
  exception when check_violation then null;
  end;
  begin
    update public.page_operations set result_revision = 1 where id = neighbor_receipt;
    raise exception 'Noop could change page revision';
  exception when check_violation then null;
  end;
  begin
    update public.page_operations set kind = 'undo', undo_until_ms = null where id = owner_receipt;
    raise exception 'Undo receipt accepted no target';
  exception when check_violation then null;
  end;

  select * into strict fragments from public.page_operation_payloads where id = owner_payload;
  fragments.id := pg_catalog.gen_random_uuid();
  begin
    insert into public.page_operation_payloads select (fragments).*;
    raise exception 'Operation accepted multiple payloads';
  exception when unique_violation then null;
  end;
  begin
    update public.page_operation_payloads set cleanup_due_at_ms = 601001 where id = owner_payload;
    raise exception 'Payload accepted the wrong cleanup deadline';
  exception when check_violation then null;
  end;
  begin
    update public.page_operation_payloads set undo_until_ms = 301001, cleanup_due_at_ms = 601001
    where id = owner_payload;
    raise exception 'Payload could disagree with its receipt deadline';
  exception when foreign_key_violation then null;
  end;
  begin
    update public.page_operation_payloads set note_id = candidate.note_id where id = owner_payload;
    raise exception 'Payload could reference a different note than the receipt';
  exception when foreign_key_violation then null;
  end;
  begin
    update public.page_operation_payloads set
      user_id = '00000000-0000-4000-8000-000000001939',
      note_id = '00000000-0000-4000-8000-000000002939',
      operation_id = neighbor_receipt
    where id = owner_payload;
    raise exception 'Noop operation accepted a payload';
  exception when foreign_key_violation then null;
  end;
  begin
    update public.page_operation_payloads set payload = payload ||
      '{"state":"expired","expiredAtMs":601000}'::jsonb
    where id = owner_payload;
    raise exception 'Expired payload could retain fragments';
  exception when check_violation then null;
  end;
  update public.page_operation_payloads set
    payload = '{"state":"expired","expiredAtMs":601000}', updated_at = 601000
  where id = owner_payload;
end;
$$;

set local role authenticated;
set local "request.jwt.claims" = '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000001938"}';

do $$
declare
  write_privilege text;
begin
  if (select array_agg(id) from public.page_operations)
      is distinct from array['00000000-0000-4000-8000-000000003938'::uuid] then
    raise exception 'Active owner could not read exactly their own receipt';
  end if;
  foreach write_privilege in array array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
    if pg_catalog.has_table_privilege('public.page_operations', write_privilege)
      or pg_catalog.has_table_privilege('public.page_operation_payloads', write_privilege) then
      raise exception 'Owner had direct ledger write privileges: %', write_privilege;
    end if;
  end loop;
  begin
    perform payload from public.page_operation_payloads;
    raise exception 'Owner could select private payloads';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
update public.page_operations set deleted_at = 2000 where id = '00000000-0000-4000-8000-000000003938';
set local role authenticated;
do $$ begin
  if exists (select 1 from public.page_operations) then raise exception 'Deleted receipt was visible'; end if;
end; $$;

reset role;
update public.page_operations set deleted_at = null where id = '00000000-0000-4000-8000-000000003938';
update public.notes set deleted_at = 2000 where id = '00000000-0000-4000-8000-000000002938';
set local role authenticated;
do $$ begin
  if exists (select 1 from public.page_operations) then raise exception 'Receipt on deleted note was visible'; end if;
end; $$;

reset role;
update public.notes set deleted_at = null where id = '00000000-0000-4000-8000-000000002938';
set local role authenticated;
do $$ begin
  if not exists (select 1 from public.page_operations where id = '00000000-0000-4000-8000-000000003938') then
    raise exception 'Restored receipt and note did not restore visibility';
  end if;
end; $$;

reset role;
update public.account_gate set is_active = false where user_id = '00000000-0000-4000-8000-000000001938';
set local role authenticated;
do $$ begin
  if exists (select 1 from public.page_operations) then raise exception 'Inactive owner could read receipt'; end if;
end; $$;

set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';
do $$ begin
  begin
    perform id from public.page_operations;
    raise exception 'Anonymous user could select receipts';
  exception when insufficient_privilege then null;
  end;
  begin
    perform payload from public.page_operation_payloads;
    raise exception 'Anonymous user could select private payloads';
  exception when insufficient_privilege then null;
  end;
end; $$;

rollback;

begin;

update public.account_gate set approval_status = 'approved'
where user_id in (:'owner_id', :'other_id');

select set_config('tempo_test.owner_id', :'owner_id', true);

set local role project_admin;
insert into public.conversations (id, user_id, title, created_at, updated_at)
values ('30000000-0000-4000-8000-000000000002', :'other_id', 'Other thread', 1, 1);
insert into public.messages (id, user_id, conversation_id, role, content, created_at, updated_at)
values ('40000000-0000-4000-8000-000000000002', :'other_id',
  '30000000-0000-4000-8000-000000000002', 'assistant', 'Other reply', 1, 1);

do $$
declare
  fk_name text;
begin
  begin
    insert into public.messages (user_id, conversation_id, role, created_at, updated_at)
    values (current_setting('tempo_test.owner_id')::uuid,
      '30000000-0000-4000-8000-000000000002', 'assistant', 1, 1);
    raise exception 'The composite FK accepted a different owner';
  exception when sqlstate '23503' then
    get stacked diagnostics fk_name = constraint_name;
    if fk_name is distinct from 'messages_owner_conversation_fk' then
      raise exception 'Unexpected FK violation: %', fk_name;
    end if;
  end;
end
$$;

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);

do $$
declare
  owner_id uuid := auth.uid();
  thread_id constant uuid := '30000000-0000-4000-8000-000000000001';
  message_id constant uuid := '40000000-0000-4000-8000-000000000001';
  table_name text;
begin
  insert into public.conversations (id, user_id, created_at, updated_at)
  values (thread_id, owner_id, 1, 1);
  insert into public.messages (id, user_id, conversation_id, role, created_at, updated_at)
  values (message_id, owner_id, thread_id, 'user', 1, 1);

  if (select array_agg(id) from public.conversations) is distinct from array[thread_id]
     or (select array_agg(id) from public.messages) is distinct from array[message_id]
     or not exists (select 1 from public.messages where id = message_id and content is null) then
    raise exception 'The owner must be able to read their own thread and metadata only';
  end if;

  begin
    insert into public.messages (user_id, conversation_id, role, created_at, updated_at)
    values (owner_id, thread_id, 'tool', 1, 1);
    raise exception 'Unsupported message role was accepted';
  exception when sqlstate '23514' then null;
  end;

  begin
    insert into public.messages (user_id, conversation_id, role, content, created_at, updated_at)
    values (owner_id, thread_id, 'user', 'blocked fixture text', 1, 1);
    raise exception 'Client inserted content without server approval';
  exception when sqlstate '42501' then null;
  end;

  begin
    update public.messages set content = 'blocked fixture text' where id = message_id;
    raise exception 'Client updated content without server approval';
  exception when sqlstate '42501' then null;
  end;

  update public.conversations set title = 'Private title', updated_at = 2 where id = thread_id;
  if not found then
    raise exception 'Owner cannot update their conversation';
  end if;
  update public.messages set deleted_at = 2, updated_at = 2 where id = message_id;
  if not found or not exists (select 1 from public.messages where id = message_id and deleted_at = 2) then
    raise exception 'Owner cannot soft-delete their message';
  end if;
  update public.messages set deleted_at = null, updated_at = 3 where id = message_id;
  if not found then
    raise exception 'Owner cannot restore their message';
  end if;
  update public.conversations set deleted_at = 3, updated_at = 3 where id = thread_id;
  if not found or exists (select 1 from public.messages where id = message_id) then
    raise exception 'Owner soft-delete did not hide the thread messages';
  end if;
  update public.messages set updated_at = 3;
  if found then
    raise exception 'Owner updated messages in a deleted conversation';
  end if;
  begin
    insert into public.messages (user_id, conversation_id, role, created_at, updated_at)
    values (owner_id, thread_id, 'user', 3, 3);
    raise exception 'Owner inserted a message into a deleted conversation';
  exception when sqlstate '42501' then null;
  end;
  update public.conversations set deleted_at = null, updated_at = 4 where id = thread_id;
  if not found or not exists (select 1 from public.messages where id = message_id and deleted_at is null) then
    raise exception 'Owner restore did not recover the thread messages';
  end if;

  begin
    delete from public.messages where id = message_id;
    raise exception 'Owner hard-deleted their message';
  exception when sqlstate '42501' then null;
  end;
  begin
    delete from public.conversations where id = thread_id;
    raise exception 'Owner hard-deleted their conversation';
  exception when sqlstate '42501' then null;
  end;

  foreach table_name in array array['conversations', 'messages'] loop
    perform set_config('realtime.channel_name', table_name || ':' || owner_id::text, true);
    if (select array_agg(pattern) from realtime.channels) is distinct from array[table_name || ':%'] then
      raise exception 'Owner cannot subscribe to their % channel', table_name;
    end if;
  end loop;
end
$$;

set local role project_admin;
insert into public.messages (user_id, conversation_id, role, content, model_used, created_at, updated_at)
values (:'owner_id', '30000000-0000-4000-8000-000000000001',
  'assistant', 'Approved display text', 'fixture', 4, 4);

set local role authenticated;
do $$
begin
  if not exists (select 1 from public.messages where role = 'assistant' and content = 'Approved display text') then
    raise exception 'Owner cannot read permitted display text written by the service';
  end if;
end
$$;

select set_config('request.jwt.claims', jsonb_build_object('sub', :'other_id', 'role', 'authenticated')::text, true);
do $$
declare
  owner_id uuid := current_setting('tempo_test.owner_id')::uuid;
  thread_id constant uuid := '30000000-0000-4000-8000-000000000001';
begin
  if exists (select 1 from public.conversations where user_id = owner_id)
     or exists (select 1 from public.messages where user_id = owner_id) then
    raise exception 'Another account can read the owner rows';
  end if;
  update public.conversations set title = 'Foreign edit' where id = thread_id;
  if found then raise exception 'Another account updated the owner conversation'; end if;
  update public.messages set deleted_at = 2 where conversation_id = thread_id;
  if found then raise exception 'Another account updated the owner messages'; end if;

  begin
    insert into public.conversations (user_id, created_at, updated_at) values (owner_id, 1, 1);
    raise exception 'Another account can insert the owner conversation';
  exception when sqlstate '42501' then null;
  end;
  begin
    insert into public.messages (user_id, conversation_id, role, created_at, updated_at)
    values (owner_id, thread_id, 'user', 1, 1);
    raise exception 'Another account can insert owner messages';
  exception when sqlstate '42501' then null;
  end;
  if exists (select 1 from realtime.channels) then
    raise exception 'Another account can subscribe to the owner channel';
  end if;
end
$$;

reset role;
update public.account_gate set is_active = false where user_id = :'other_id';
set local role authenticated;
do $$
begin
  if exists (select 1 from public.conversations) or exists (select 1 from public.messages) then
    raise exception 'Inactive accounts can read coach rows';
  end if;
end
$$;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    if exists (select 1 from public.conversations) then
      raise exception 'Anonymous accounts can read conversations';
    end if;
  exception when sqlstate '42501' then null;
  end;
  begin
    if exists (select 1 from public.messages) then
      raise exception 'Anonymous accounts can read messages';
    end if;
  exception when sqlstate '42501' then null;
  end;
end
$$;

reset role;
do $$
declare
  owner_id text := current_setting('tempo_test.owner_id');
  expected record;
begin
  for expected in
    select * from (values
      ('conversations', 'INSERT', '30000000-0000-4000-8000-000000000001'::uuid, 1),
      ('conversations', 'UPDATE', '30000000-0000-4000-8000-000000000001'::uuid, 3),
      ('messages', 'INSERT', '40000000-0000-4000-8000-000000000001'::uuid, 1),
      ('messages', 'UPDATE', '40000000-0000-4000-8000-000000000001'::uuid, 2)
    ) as events(table_name, op, row_id, event_count)
  loop
    if (select count(*) from realtime.messages
        where channel_name = expected.table_name || ':' || owner_id
          and event_name = expected.op and sender_type = 'system'
          and payload = jsonb_build_object('table', expected.table_name, 'op', expected.op,
            'id', expected.row_id)) <> expected.event_count then
      raise exception 'Incorrect channel, operation, or id-only payload for %.%',
        expected.table_name, expected.op;
    end if;
  end loop;
end
$$;

rollback;

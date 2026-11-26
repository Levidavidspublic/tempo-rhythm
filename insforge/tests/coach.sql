begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000001922', 'q78-coach-owner@example.invalid'),
  ('00000000-0000-4000-8000-000000001923', 'q78-coach-other@example.invalid');

set local role project_admin;

insert into public.conversations (id, user_id, title, created_at, updated_at, deleted_at, legacy_convex_id)
values
  ('10000000-0000-4000-8000-000000001922', '00000000-0000-4000-8000-000000001922', 'Owner thread', 1, 1, null, 'q78-thread'),
  ('10000000-0000-4000-8000-000000001923', '00000000-0000-4000-8000-000000001923', 'Other thread', 1, 1, null, 'q78-other-thread'),
  ('10000000-0000-4000-8000-000000001924', '00000000-0000-4000-8000-000000001922', 'Hidden thread', 1, 3, 3, 'q78-hidden-thread');

insert into public.messages (
  user_id, conversation_id, role, content, model_used, created_at, updated_at, deleted_at, legacy_convex_id
) values
  ('00000000-0000-4000-8000-000000001922', '10000000-0000-4000-8000-000000001922', 'user', null, null, 1, 1, null, 'q78-metadata'),
  ('00000000-0000-4000-8000-000000001922', '10000000-0000-4000-8000-000000001922', 'assistant', 'Final reply', 'fixture', 2, 2, null, 'q78-reply'),
  ('00000000-0000-4000-8000-000000001922', '10000000-0000-4000-8000-000000001922', 'assistant', 'Hidden message', null, 3, 4, 4, 'q78-hidden-message'),
  ('00000000-0000-4000-8000-000000001922', '10000000-0000-4000-8000-000000001924', 'assistant', 'Hidden by parent', null, 2, 2, null, 'q78-hidden-by-parent'),
  ('00000000-0000-4000-8000-000000001923', '10000000-0000-4000-8000-000000001923', 'assistant', 'Other reply', null, 2, 2, null, 'q78-other-reply');

do $$
begin
  if (select count(*) from public.messages where legacy_convex_id like 'q78-%') <> 5 then
    raise exception 'Service role must see all seeded message rows';
  end if;

  update public.conversations set deleted_at = null, updated_at = 4 where legacy_convex_id = 'q78-hidden-thread';
  if not found then raise exception 'Service role must be able to restore a thread'; end if;
  update public.conversations set deleted_at = 5, updated_at = 5 where legacy_convex_id = 'q78-hidden-thread';

  begin
    insert into public.messages (user_id, conversation_id, role, created_at, updated_at)
    values ('00000000-0000-4000-8000-000000001922', '10000000-0000-4000-8000-000000001923', 'assistant', 1, 1);
    raise exception 'Service role linked a message to a different owner';
  exception when foreign_key_violation then null;
  end;

  begin
    insert into public.messages (user_id, conversation_id, role, created_at, updated_at)
    values ('00000000-0000-4000-8000-000000001922', '10000000-0000-4000-8000-000000001922', 'tool', 1, 1);
    raise exception 'Service role inserted an unsupported message role';
  exception when check_violation then null;
  end;
end;
$$;

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000001922"}';

do $$
declare
  claimed_table text;
begin
  if (select array_agg(legacy_convex_id order by id) from public.conversations)
    is distinct from array['q78-thread'] then
    raise exception 'Owner must see only their live conversations';
  end if;

  if (select array_agg(legacy_convex_id order by created_at, id) from public.messages)
    is distinct from array['q78-metadata', 'q78-reply'] then
    raise exception 'Owner must see only live messages on their live thread';
  end if;

  if not exists (select 1 from public.messages where role = 'user' and content is null)
     or not exists (select 1 from public.messages where role = 'assistant' and content = 'Final reply') then
    raise exception 'Owner cannot read metadata-only and final display rows';
  end if;

  begin
    insert into public.messages (user_id, conversation_id, role, content, created_at, updated_at)
    values (auth.uid(), '10000000-0000-4000-8000-000000001922', 'user', 'Client write', 1, 1);
    raise exception 'Authenticated client bypassed the service write path';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.conversations set title = 'Foreign edit' where legacy_convex_id = 'q78-other-thread';
    raise exception 'Authenticated client has direct conversation update access';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.messages where legacy_convex_id = 'q78-reply';
    raise exception 'Authenticated client has hard-delete access';
  exception when insufficient_privilege then null;
  end;

  foreach claimed_table in array array['conversations', 'messages'] loop
    perform pg_catalog.set_config('realtime.channel_name', claimed_table || ':' || auth.uid()::text, true);
    if not exists (select 1 from realtime.channels where pattern = claimed_table || ':%') then
      raise exception 'Owner cannot subscribe to their % channel', claimed_table;
    end if;

    perform pg_catalog.set_config('realtime.channel_name', claimed_table || ':00000000-0000-4000-8000-000000001923', true);
    if exists (select 1 from realtime.channels where pattern = claimed_table || ':%') then
      raise exception 'Owner can subscribe to another account''s % channel', claimed_table;
    end if;
  end loop;
end;
$$;

reset role;
update public.account_gate set is_active = false where user_id = '00000000-0000-4000-8000-000000001922';
set local role authenticated;
set local realtime.channel_name = 'messages:00000000-0000-4000-8000-000000001922';

do $$
begin
  if exists (select 1 from public.conversations) or exists (select 1 from public.messages) then
    raise exception 'Inactive account can read its coach rows';
  end if;
  if exists (select 1 from realtime.channels where pattern = 'messages:%') then
    raise exception 'Inactive account can subscribe to its message channel';
  end if;
end;
$$;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

do $$
begin
  begin
    perform 1 from public.conversations;
    raise exception 'Anonymous client can read conversations';
  exception when insufficient_privilege then null;
  end;

  begin
    perform 1 from public.messages;
    raise exception 'Anonymous client can read messages';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;

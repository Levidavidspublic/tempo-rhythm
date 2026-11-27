begin;

update public.account_gate set approval_status = 'approved'
where user_id in (:'owner_id', :'other_id');
select set_config('tempo_test.owner_id', :'owner_id', true);
select set_config('tempo_test.other_id', :'other_id', true);

insert into public.memories (id, user_id, content, sector, salience, decay_rate, last_accessed,
  access_count, created_at, updated_at)
values ('00000000-0000-4000-8000-000000003931', :'other_id', 'Another memory',
  'general', 0.5, 0.01, 1000, 0, 1000, 1000);

do $$
begin
  begin
    insert into public.memories (user_id, content, sector, salience, decay_rate, last_accessed,
      access_count, created_at, updated_at)
    values ('00000000-0000-4000-8000-000000009931', 'Missing owner', 'general', 0.5, 0.01, 1, 0, 1, 1);
    raise exception 'A memory could reference a nonexistent account';
  exception when sqlstate '23503' then null;
  end;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims',
  jsonb_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);

do $$
declare
  owner_row constant uuid := '00000000-0000-4000-8000-000000003930';
  other_id constant uuid := current_setting('tempo_test.other_id')::uuid;
begin
  insert into public.memories (id, user_id, content, sector, salience, decay_rate, last_accessed,
    access_count, source, imported_at, created_at, updated_at)
  values (owner_row, auth.uid(), 'Reviewed memory', 'semantic', 0.5, 0.01, 1000, 0,
    'claude', 1000, 1000, 1000);

  if (select count(*) from public.memories) <> 1 or not exists (
    select from public.memories where id = owner_row and source = 'claude'
      and imported_at = 1000 and visibility = 'private'
  ) then
    raise exception 'Owner could not read just their own memory and provenance';
  end if;

  update public.memories set content = 'Updated memory', updated_at = 1001 where id = owner_row;
  if not found or (select content from public.memories where id = owner_row) <> 'Updated memory' then
    raise exception 'Owner could not update a memory';
  end if;

  begin
    update public.memories set user_id = other_id where id = owner_row;
    raise exception 'Owner could transfer a memory to another account';
  exception when sqlstate '42501' then null;
  end;
  begin
    update public.memories set visibility = 'public' where id = owner_row;
    raise exception 'Owner could make a memory public';
  exception when sqlstate '23514' then null;
  end;
  begin
    update public.memories set source = 'unrecognized' where id = owner_row;
    raise exception 'Owner could store an invalid source';
  exception when sqlstate '23514' then null;
  end;
  begin
    delete from public.memories where id = owner_row;
    if found then raise exception 'Owner could hard-delete a memory'; end if;
  exception when sqlstate '42501' then null;
  end;

  update public.memories set deleted_at = 2000, updated_at = 2000 where id = owner_row;
  if not found or exists (select from public.memories where id = owner_row and deleted_at is null) then
    raise exception 'Owner could not soft-delete a memory';
  end if;
  update public.memories set deleted_at = null, updated_at = 2001 where id = owner_row and deleted_at = 2000;
  if not found then raise exception 'Owner could not restore their memory'; end if;

  perform set_config('realtime.channel_name', 'memories:' || auth.uid()::text, true);
  if (select array_agg(pattern) from realtime.channels) is distinct from array['memories:%'] then
    raise exception 'Owner could not subscribe to their memory channel';
  end if;
end;
$$;

select set_config('request.jwt.claims',
  jsonb_build_object('sub', :'other_id', 'role', 'authenticated')::text, true);
do $$
declare
  owner_id constant uuid := current_setting('tempo_test.owner_id')::uuid;
begin
  if exists (select from public.memories where user_id = owner_id) or exists (select from realtime.channels) then
    raise exception 'Other user could read or subscribe to owner memories';
  end if;
  update public.memories set content = 'Wrong edit' where user_id = owner_id;
  if found then raise exception 'Other user could update an owner memory'; end if;
  begin
    insert into public.memories (user_id, content, sector, salience, decay_rate, last_accessed,
      access_count, created_at, updated_at)
    values (owner_id, 'Wrong owner', 'general', 0.5, 0.01, 1000, 0, 1000, 1000);
    raise exception 'Other user could insert an owner memory';
  exception when sqlstate '42501' then null;
  end;
end;
$$;

reset role;
do $$
declare
  channel constant text := 'memories:' || current_setting('tempo_test.owner_id');
  owner_row constant uuid := '00000000-0000-4000-8000-000000003930';
begin
  if (select count(*) from realtime.messages where channel_name = channel) <> 4
    or (select count(*) from realtime.messages where channel_name = channel and sender_type = 'system'
      and event_name = 'INSERT' and payload = jsonb_build_object('table', 'memories', 'op', 'INSERT', 'id', owner_row)) <> 1
    or (select count(*) from realtime.messages where channel_name = channel and sender_type = 'system'
      and event_name = 'UPDATE' and payload = jsonb_build_object('table', 'memories', 'op', 'UPDATE', 'id', owner_row)) <> 3 then
    raise exception 'Expected one ID-only insert event and three update events';
  end if;
end;
$$;

update public.account_gate set is_active = false where user_id = :'owner_id';
set local role authenticated;
select set_config('request.jwt.claims',
  jsonb_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);
do $$
begin
  if exists (select from public.memories) then raise exception 'Inactive account could see memories'; end if;
end;
$$;

reset role;
grant select on public.memories to anon;
set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';
do $$
begin
  if exists (select from public.memories) then raise exception 'Anonymous role could see memories'; end if;
end;
$$;

rollback;

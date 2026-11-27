begin;

update public.account_gate set approval_status = 'approved'
where user_id in (:'owner_id', :'other_id');
select set_config('tempo_test.owner_id', :'owner_id', true);
select set_config('tempo_test.other_id', :'other_id', true);

set local role authenticated;
select set_config('request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'sub', :'other_id')::text, true);

insert into public.notes (id, user_id, title, body, page_type, date, created_at, updated_at)
values ('00000000-0000-4000-8000-000000002921', auth.uid(), 'Neighbor', 'Private', 'daily', '2026-11-26', 1, 1);
insert into public.note_blocks (user_id, note_id, type, position, error_code, created_at, updated_at)
values (auth.uid(), '00000000-0000-4000-8000-000000002921', 'broken', 1, 'malformed_json', 1, 1);

select set_config('request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'sub', :'owner_id')::text, true);

insert into public.notes (id, user_id, title, body, page_type, date, pinned, created_at, updated_at, legacy_convex_id)
values ('00000000-0000-4000-8000-000000002920', auth.uid(), 'Owner', 'Private body', 'daily', '2026-11-26', true, 1, 1, 'q35-note');

insert into public.note_blocks (id, user_id, note_id, type, block_id, v, data, position, error_code, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000003920', auth.uid(), '00000000-0000-4000-8000-000000002920', 'task',
   'blk_01JQ8Z3K4M5N6P7Q8R9S0T1V2W', 1, '{"title":"Private task","durationMin":15,"status":"now","order":0,"inelastic":false}', 3, null, 1, 1),
  ('00000000-0000-4000-8000-000000003921', auth.uid(), '00000000-0000-4000-8000-000000002920', 'page-meta',
   'blk_01JQ8Z3K4M5N6P7Q8R9S0T1V2X', 1, '{"pageType":"daily","date":"2026-11-26","tags":[]}', 1, null, 1, 1),
  ('00000000-0000-4000-8000-000000003922', auth.uid(), '00000000-0000-4000-8000-000000002920', 'broken',
   'blk_01JQ8Z3K4M5N6P7Q8R9S0T1V2W', null, null, 4, 'duplicate_id', 1, 1),
  ('00000000-0000-4000-8000-000000003923', auth.uid(), '00000000-0000-4000-8000-000000002920', 'template',
   'blk_01JQ8Z3K4M5N6P7Q8R9S0T1V2Y', 1, '{"name":"Start","forPageType":"daily","isDefault":false,"tokens":[],"origin":"user","status":"live","enabled":true}', 2, null, 1, 1);

do $$
declare
  owner_note constant uuid := '00000000-0000-4000-8000-000000002920';
  foreign_note constant uuid := '00000000-0000-4000-8000-000000002921';
  owner_block constant uuid := '00000000-0000-4000-8000-000000003920';
  foreign_user constant uuid := current_setting('tempo_test.other_id')::uuid;
  channel_table text;
begin
  if (select array_agg(title) from public.notes where date = '2026-11-26')
      is distinct from array['Owner'] then
    raise exception 'Owner could not read just their own dated note';
  end if;
  if (select array_agg(type order by position, id) from public.note_blocks where deleted_at is null)
      is distinct from array['page-meta', 'template', 'task', 'broken'] then
    raise exception 'Ordered live block read lost owner blocks or showed foreign blocks';
  end if;

  foreach channel_table in array array['notes', 'note_blocks'] loop
    perform pg_catalog.set_config('realtime.channel_name', channel_table || ':' || auth.uid()::text, true);
    if not exists (select 1 from realtime.channels where pattern = channel_table || ':%') then
      raise exception 'Owner could not subscribe to their % channel', channel_table;
    end if;
    perform pg_catalog.set_config('realtime.channel_name', channel_table || ':' || foreign_user::text, true);
    if exists (select 1 from realtime.channels where pattern = channel_table || ':%') then
      raise exception 'Owner could subscribe to a foreign % channel', channel_table;
    end if;
    perform pg_catalog.set_config('realtime.channel_name', channel_table || ':' || auth.uid()::text || ':extra', true);
    if exists (select 1 from realtime.channels where pattern = channel_table || ':%') then
      raise exception 'A non-exact % channel matched', channel_table;
    end if;
  end loop;

  update public.notes set title = 'Foreign edit' where id = foreign_note;
  if found then raise exception 'Owner could update a foreign note'; end if;
  update public.note_blocks set position = 99 where note_id = foreign_note;
  if found then raise exception 'Owner could update a foreign block'; end if;
  begin
    update public.notes set user_id = foreign_user where id = owner_note;
    raise exception 'Owner could transfer note ownership';
  exception when sqlstate '42501' then null;
  end;
  begin
    update public.note_blocks set note_id = foreign_note where id = owner_block;
    raise exception 'Owner could relink a block to a foreign note';
  exception when sqlstate '42501' then null;
  end;

  begin
    insert into public.notes (user_id, title, body, page_type, date, created_at, updated_at)
    values (auth.uid(), 'Duplicate', '', 'daily', '2026-11-26', 1, 1);
    raise exception 'Two live daily notes used the same owner and date';
  exception when sqlstate '23505' then null;
  end;
  begin
    update public.note_blocks set v = null where id = owner_block;
    raise exception 'A valid block lost its required version';
  exception when sqlstate '23514' then null;
  end;
  begin
    update public.note_blocks set data = '[]'::jsonb where id = owner_block;
    raise exception 'A valid block accepted a non-object payload';
  exception when sqlstate '23514' then null;
  end;
  begin
    update public.note_blocks set error_code = null where note_id = owner_note and type = 'broken';
    raise exception 'A broken block lost its required error code';
  exception when sqlstate '23514' then null;
  end;
  begin
    update public.note_blocks set position = -1 where id = owner_block;
    raise exception 'A negative block position was accepted';
  exception when sqlstate '23514' then null;
  end;

  update public.note_blocks set deleted_at = 2, updated_at = 2 where id = owner_block;
  if not found or exists (select 1 from public.note_blocks where id = owner_block and deleted_at is null) then
    raise exception 'Block soft deletion failed';
  end if;
  update public.notes set deleted_at = 2, updated_at = 2 where id = owner_note;
  if not found or exists (select 1 from public.note_blocks where note_id = owner_note) then
    raise exception 'Soft-deleted parent did not hide its blocks';
  end if;
  begin
    insert into public.note_blocks (user_id, note_id, type, position, error_code, created_at, updated_at)
    values (auth.uid(), owner_note, 'broken', 5, 'malformed_json', 2, 2);
    raise exception 'Owner could add a block to a soft-deleted note';
  exception when sqlstate '42501' then null;
  end;
  update public.notes set deleted_at = null, updated_at = 3 where id = owner_note;
  update public.note_blocks set deleted_at = null, updated_at = 3 where id = owner_block;
  if not found or not exists (select 1 from public.note_blocks where id = owner_block and deleted_at is null) then
    raise exception 'Note and block restore failed';
  end if;

  begin
    delete from public.note_blocks where id = owner_block;
    if found then raise exception 'Owner could hard-delete a block'; end if;
  exception when sqlstate '42501' then null;
  end;
  begin
    delete from public.notes where id = owner_note;
    if found then raise exception 'Owner could hard-delete a note'; end if;
  exception when sqlstate '42501' then null;
  end;
end;
$$;

select set_config('request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'sub', :'other_id')::text, true);
do $$
declare
  owner_note constant uuid := '00000000-0000-4000-8000-000000002920';
  owner_id constant uuid := current_setting('tempo_test.owner_id')::uuid;
begin
  if exists (select from public.notes where id = owner_note)
    or exists (select from public.note_blocks where note_id = owner_note) then
    raise exception 'The other user could read owner notes or blocks';
  end if;
  update public.notes set title = 'Foreign edit' where id = owner_note;
  if found then raise exception 'The other user could update the owner note'; end if;
  update public.note_blocks set position = 99 where note_id = owner_note;
  if found then raise exception 'The other user could update an owner block'; end if;
  begin
    insert into public.notes (user_id, title, body, created_at, updated_at)
    values (owner_id, 'Foreign insert', '', 1, 1);
    raise exception 'The other user could insert a note as the owner';
  exception when sqlstate '42501' then null;
  end;
  begin
    insert into public.note_blocks (user_id, note_id, type, position, error_code, created_at, updated_at)
    values (auth.uid(), owner_note, 'broken', 1, 'malformed_json', 1, 1);
    raise exception 'The other user could insert a block on an owner note';
  exception when sqlstate '42501' then null;
  end;
end;
$$;

reset role;
do $$
begin
  begin
    insert into public.note_blocks (user_id, note_id, type, position, error_code, created_at, updated_at)
    values (current_setting('tempo_test.owner_id')::uuid, '00000000-0000-4000-8000-000000002921',
      'broken', 1, 'malformed_json', 1, 1);
    raise exception 'An owner-qualified foreign key accepted a foreign note';
  exception when sqlstate '23503' then null;
  end;

  if not exists (
    select 1 from realtime.messages
    where channel_name = 'notes:' || current_setting('tempo_test.owner_id') and event_name = 'UPDATE'
      and payload = '{"table":"notes","op":"UPDATE","id":"00000000-0000-4000-8000-000000002920"}'::jsonb
  ) or not exists (
    select 1 from realtime.messages
    where channel_name = 'note_blocks:' || current_setting('tempo_test.owner_id') and event_name = 'INSERT'
      and payload = '{"table":"note_blocks","op":"INSERT","id":"00000000-0000-4000-8000-000000003920"}'::jsonb
  ) then
    raise exception 'Expected ID-only note and block events were not published';
  end if;
end;
$$;

set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';
do $$
begin
  begin
    if exists (select 1 from public.notes) then raise exception 'Anonymous notes were visible'; end if;
  exception when sqlstate '42501' then null;
  end;
  begin
    if exists (select 1 from public.note_blocks) then raise exception 'Anonymous blocks were visible'; end if;
  exception when sqlstate '42501' then null;
  end;
end;
$$;

reset role;
update public.account_gate set is_active = false where user_id = :'owner_id';
set local role authenticated;
select set_config('request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'sub', :'owner_id')::text, true);
do $$
begin
  if exists (select 1 from public.notes) or exists (select 1 from public.note_blocks) then
    raise exception 'An inactive owner could read notes or blocks';
  end if;
  begin
    insert into public.notes (user_id, title, body, created_at, updated_at)
    values (auth.uid(), 'Inactive write', '', 1, 1);
    raise exception 'An inactive owner could insert a note';
  exception when sqlstate '42501' then null;
  end;
end;
$$;

rollback;

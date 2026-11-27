begin;

update public.account_gate set approval_status = 'approved'
where user_id in (:'owner_id', :'other_id');

set local role authenticated;
select set_config('request.jwt.claims',
  jsonb_build_object('sub', :'other_id', 'role', 'authenticated')::text, true);

insert into public.templates (id, user_id, name, period_type, body, created_at, updated_at)
values ('00000000-0000-4000-8000-000000002940', auth.uid(), 'Neighbor', 'daily', 'Private', 1, 9);

select set_config('request.jwt.claims',
  jsonb_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);
select set_config('tempo_test.other_id', :'other_id', true);
select set_config('realtime.channel_name', 'templates:' || :'owner_id', true);

insert into public.templates (id, user_id, name, period_type, body, created_at, updated_at, legacy_convex_id)
values
  ('00000000-0000-4000-8000-000000002939', auth.uid(), 'First', 'daily', 'Private body', 1, 1, 'q38-imported'),
  ('00000000-0000-4000-8000-000000003939', auth.uid(), 'Second', 'none', '', 2, 2, null);

do $$
declare
  own_template constant uuid := '00000000-0000-4000-8000-000000002939';
  foreign_template constant uuid := '00000000-0000-4000-8000-000000002940';
  foreign_user constant uuid := current_setting('tempo_test.other_id')::uuid;
begin
  if (select array_agg(name order by updated_at desc, id) from public.templates where deleted_at is null)
      is distinct from array['Second', 'First'] then
    raise exception 'Newest-first live list did not isolate owner templates';
  end if;
  if not exists (select 1 from public.templates where id = own_template and body = 'Private body')
      or exists (select 1 from public.templates where id = foreign_template) then
    raise exception 'Lookup by ID did not isolate owner templates';
  end if;

  update public.templates set name = 'Edited', updated_at = 3 where id = own_template;
  if not found or not exists (select 1 from public.templates where id = own_template and name = 'Edited') then
    raise exception 'Active owner could not edit their template';
  end if;
  update public.templates set name = 'Foreign edit' where id = foreign_template;
  if found then raise exception 'Owner could update a foreign template'; end if;

  begin
    insert into public.templates (user_id, name, period_type, body, created_at, updated_at)
    values (foreign_user, 'Foreign insert', 'none', '', 3, 3);
    raise exception 'Owner could create a template for another user';
  exception when sqlstate '42501' then null;
  end;
  begin
    update public.templates set user_id = foreign_user where id = own_template;
    raise exception 'Owner could transfer template ownership';
  exception when sqlstate '42501' then null;
  end;

  begin
    update public.templates set period_type = 'yearly' where id = own_template;
    raise exception 'Unsupported period accepted';
  exception when sqlstate '23514' then null;
  end;
  begin
    update public.templates set name = E' \t\n' where id = own_template;
    raise exception 'Blank template name accepted';
  exception when sqlstate '23514' then null;
  end;
  begin
    update public.templates set legacy_convex_id = 'starter:daily-page' where id = own_template;
    raise exception 'User row accepted a reserved starter ID';
  exception when sqlstate '23514' then null;
  end;
  begin
    insert into public.templates (user_id, name, period_type, body, created_at, updated_at, legacy_convex_id)
    values (auth.uid(), 'Duplicate', 'none', '', 3, 3, 'q38-imported');
    raise exception 'Duplicate legacy template ID accepted';
  exception when sqlstate '23505' then null;
  end;

  update public.templates set deleted_at = 4, updated_at = 4 where id = own_template;
  if not found or (select deleted_at from public.templates where id = own_template) is distinct from 4::bigint then
    raise exception 'Owner could not soft-delete their template';
  end if;
  update public.templates set deleted_at = null, updated_at = 5 where id = own_template;
  if not found or not exists (select 1 from public.templates where id = own_template and deleted_at is null) then
    raise exception 'Active owner could not restore their template';
  end if;
  begin
    delete from public.templates where id = own_template;
    raise exception 'Owner had a hard-delete privilege';
  exception when sqlstate '42501' then null;
  end;

  if (select array_agg(pattern) from realtime.channels) is distinct from array['templates:%'] then
    raise exception 'Owner could not subscribe to their template channel';
  end if;
end;
$$;

select set_config('request.jwt.claims',
  jsonb_build_object('sub', :'other_id', 'role', 'authenticated')::text, true);
do $$
begin
  if exists (select 1 from public.templates where id = '00000000-0000-4000-8000-000000002939') then
    raise exception 'Other user could read the owner template';
  end if;
  update public.templates set name = 'Foreign edit' where id = '00000000-0000-4000-8000-000000002939';
  if found then raise exception 'Other user could edit the owner template'; end if;
  if exists (select 1 from realtime.channels) then
    raise exception 'Other user could subscribe to the owner template channel';
  end if;
end;
$$;

reset role;
select set_config('tempo_test.owner_id', :'owner_id', true);
do $$
declare
  template_id constant uuid := '00000000-0000-4000-8000-000000002939';
  channel constant text := 'templates:' || current_setting('tempo_test.owner_id');
  events record;
begin
  select count(*) as total,
    count(*) filter (where event_name = 'INSERT' and sender_type = 'system' and
      payload = jsonb_build_object('table', 'templates', 'op', 'INSERT', 'id', template_id)) as inserts,
    count(*) filter (where event_name = 'UPDATE' and sender_type = 'system' and
      payload = jsonb_build_object('table', 'templates', 'op', 'UPDATE', 'id', template_id)) as updates
    into events from realtime.messages
    where channel_name = channel and payload->>'id' = template_id::text;
  if (events.total, events.inserts, events.updates) is distinct from (4, 1, 3) then
    raise exception 'Expected one insert and three updates with only template metadata';
  end if;

  begin
    insert into public.templates (user_id, name, period_type, body, created_at, updated_at)
    values ('00000000-0000-4000-8000-000000009939', 'Missing owner', 'none', '', 1, 1);
    raise exception 'Template referenced a nonexistent auth user';
  exception when sqlstate '23503' then null;
  end;
end;
$$;

set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';
do $$
begin
  begin
    if exists (select 1 from public.templates) then raise exception 'Anonymous templates were visible'; end if;
  exception when sqlstate '42501' then null;
  end;
  begin
    insert into public.templates (user_id, name, period_type, body, created_at, updated_at)
    values (current_setting('tempo_test.owner_id')::uuid, 'Anonymous write', 'none', '', 1, 1);
    raise exception 'Anonymous user could create a template';
  exception when sqlstate '42501' then null;
  end;
end;
$$;

reset role;
update public.account_gate set is_active = false where user_id = :'owner_id';
set local role authenticated;
select set_config('request.jwt.claims',
  jsonb_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);
do $$
begin
  if exists (select 1 from public.templates) then raise exception 'Inactive owner could read templates'; end if;
  update public.templates set name = 'Inactive edit' where user_id = auth.uid();
  if found then raise exception 'Inactive owner could edit templates'; end if;
  begin
    insert into public.templates (user_id, name, period_type, body, created_at, updated_at)
    values (auth.uid(), 'Inactive write', 'none', '', 1, 1);
    raise exception 'Inactive owner could create a template';
  exception when sqlstate '42501' then null;
  end;
end;
$$;

rollback;

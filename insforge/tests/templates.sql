begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000001939', 'q38-owner@example.invalid'),
  ('00000000-0000-4000-8000-000000001940', 'q38-neighbor@example.invalid');

set local role authenticated;
set local "request.jwt.claims" = '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000001940"}';

insert into public.templates (id, user_id, name, period_type, body, created_at, updated_at)
values ('00000000-0000-4000-8000-000000002940', auth.uid(), 'Neighbor', 'daily', 'Private', 1, 9);

set local "request.jwt.claims" = '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000001939"}';

insert into public.templates (id, user_id, name, period_type, body, created_at, updated_at, legacy_convex_id)
values
  ('00000000-0000-4000-8000-000000002939', auth.uid(), 'First', 'daily', 'Private body', 1, 1, 'q38-imported'),
  ('00000000-0000-4000-8000-000000003939', auth.uid(), 'Second', 'none', '', 2, 2, null);

do $$
declare
  own_template constant uuid := '00000000-0000-4000-8000-000000002939';
  foreign_template constant uuid := '00000000-0000-4000-8000-000000002940';
  foreign_user constant uuid := '00000000-0000-4000-8000-000000001940';
begin
  if (select array_agg(name order by updated_at desc, id) from public.templates where deleted_at is null)
      is distinct from array['Second', 'First'] then
    raise exception 'Newest-first live list did not isolate owner templates';
  end if;
  if not exists (select 1 from public.templates where id = own_template and deleted_at is null)
      or exists (select 1 from public.templates where id = foreign_template) then
    raise exception 'Lookup by ID did not isolate owner templates';
  end if;

  update public.templates set name = 'Edited', updated_at = 3 where id = own_template;
  if not found then raise exception 'Active owner could not edit their template'; end if;
  update public.templates set name = 'Foreign edit' where id = foreign_template;
  if found then raise exception 'Owner could update a foreign template'; end if;

  begin
    insert into public.templates (user_id, name, period_type, body, created_at, updated_at)
    values (foreign_user, 'Foreign insert', 'none', '', 3, 3);
    raise exception 'Owner could create a template for another user';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.templates set user_id = foreign_user where id = own_template;
    raise exception 'Owner could transfer template ownership';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.templates set period_type = 'yearly' where id = own_template;
    raise exception 'Unsupported period accepted';
  exception when check_violation then null;
  end;
  begin
    update public.templates set name = E' \t\n' where id = own_template;
    raise exception 'Blank template name accepted';
  exception when check_violation then null;
  end;
  begin
    update public.templates set legacy_convex_id = 'starter:daily-page' where id = own_template;
    raise exception 'User row accepted a reserved starter ID';
  exception when check_violation then null;
  end;
  begin
    insert into public.templates (user_id, name, period_type, body, created_at, updated_at, legacy_convex_id)
    values (auth.uid(), 'Duplicate', 'none', '', 3, 3, 'q38-imported');
    raise exception 'Duplicate legacy template ID accepted';
  exception when unique_violation then null;
  end;

  update public.templates set deleted_at = 4, updated_at = 4 where id = own_template;
  if not found or exists (select 1 from public.templates where id = own_template and deleted_at is null) then
    raise exception 'Soft-deleted template remained in the live selector';
  end if;
  update public.templates set deleted_at = null, updated_at = 5 where id = own_template;
  if not found or not exists (select 1 from public.templates where id = own_template and deleted_at is null) then
    raise exception 'Active owner could not restore their template';
  end if;
  begin
    delete from public.templates where id = own_template;
    raise exception 'Owner had a hard-delete privilege';
  exception when insufficient_privilege then null;
  end;

  perform pg_catalog.set_config('realtime.channel_name', 'templates:' || auth.uid()::text, true);
  if not exists (select 1 from realtime.channels where pattern = 'templates:%') then
    raise exception 'Owner could not subscribe to their template channel';
  end if;
  perform pg_catalog.set_config('realtime.channel_name', 'templates:' || foreign_user::text, true);
  if exists (select 1 from realtime.channels where pattern = 'templates:%') then
    raise exception 'Owner could subscribe to a foreign template channel';
  end if;
  perform pg_catalog.set_config('realtime.channel_name', 'templates:' || auth.uid()::text || ':extra', true);
  if exists (select 1 from realtime.channels where pattern = 'templates:%') then
    raise exception 'A non-exact template channel matched';
  end if;
end;
$$;

reset role;
do $$
begin
  if (select array_agg(distinct event_name::text order by event_name::text) from realtime.messages
      where channel_name = 'templates:00000000-0000-4000-8000-000000001939'
        and payload = '{"id":"00000000-0000-4000-8000-000000002939"}'::jsonb)
      is distinct from array['INSERT', 'UPDATE'] then
    raise exception 'Expected ID-only template events were not published';
  end if;
end;
$$;

set local role anon;
set local "request.jwt.claims" = '{"role":"anon"}';
do $$
begin
  begin
    if exists (select 1 from public.templates) then raise exception 'Anonymous templates were visible'; end if;
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.templates (user_id, name, period_type, body, created_at, updated_at)
    values ('00000000-0000-4000-8000-000000001939', 'Anonymous write', 'none', '', 1, 1);
    raise exception 'Anonymous user could create a template';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
update public.account_gate set is_active = false where user_id = '00000000-0000-4000-8000-000000001939';
set local role authenticated;
set local "request.jwt.claims" = '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000001939"}';
set local realtime.channel_name = 'templates:00000000-0000-4000-8000-000000001939';
do $$
begin
  if exists (select 1 from public.templates) then raise exception 'Inactive owner could read templates'; end if;
  if exists (select 1 from realtime.channels where pattern = 'templates:%') then
    raise exception 'Inactive owner could subscribe to templates';
  end if;
  update public.templates set name = 'Inactive edit' where user_id = auth.uid();
  if found then raise exception 'Inactive owner could edit templates'; end if;
  begin
    insert into public.templates (user_id, name, period_type, body, created_at, updated_at)
    values (auth.uid(), 'Inactive write', 'none', '', 1, 1);
    raise exception 'Inactive owner could create a template';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;

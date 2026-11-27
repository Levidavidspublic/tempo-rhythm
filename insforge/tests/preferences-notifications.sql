begin;

update public.account_gate set approval_status = 'approved'
where user_id in (:'owner_id', :'other_id');
select set_config('tempo_test.owner_id', :'owner_id', true);
select set_config('tempo_test.other_id', :'other_id', true);

set local role project_admin;

insert into public.user_preferences (user_id, theme, created_at, updated_at, deleted_at, legacy_convex_id)
values
  (:'owner_id', 'dark', 1, 1, null, 'preferences-deleted'),
  (:'other_id', 'light', 1, 1, null, 'preferences-other');

insert into public.notifications (id, user_id, title, body, kind, created_at, updated_at, deleted_at)
values
  ('10000000-0000-4000-8000-000000000001', :'owner_id',
   'Older', 'System notice', 'system', 10, 10, null),
  ('10000000-0000-4000-8000-000000000002', :'owner_id',
   'Newer', 'Reminder notice', 'reminder', 20, 20, null),
  ('10000000-0000-4000-8000-000000000003', :'other_id',
   'Other', 'Billing notice', 'billing', 30, 30, null),
  ('10000000-0000-4000-8000-000000000004', :'owner_id',
   'Deleted', 'Hidden notice', 'system', 40, 40, null);

update public.user_preferences set deleted_at = 2, updated_at = 2
where legacy_convex_id = 'preferences-deleted';
update public.notifications set deleted_at = 41, updated_at = 41
where id = '10000000-0000-4000-8000-000000000004';

do $$
declare
  missing_owner constant uuid := '00000000-0000-4000-8000-000000009934';
begin
  begin
    insert into public.user_preferences (user_id) values (missing_owner);
    raise exception 'Preferences could reference a nonexistent account';
  exception when sqlstate '23503' then null;
  end;
  begin
    insert into public.notifications (user_id, title, body, kind, created_at, updated_at)
    values (missing_owner, 'Notice', 'Notice body', 'system', 1, 1);
    raise exception 'A notification could reference a nonexistent account';
  exception when sqlstate '23503' then null;
  end;
  begin
    update public.notifications set kind = 'invalid' where id = '10000000-0000-4000-8000-000000000001';
    raise exception 'An invalid notification kind was accepted';
  exception when sqlstate '23514' then null;
  end;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'sub', :'other_id')::text, true);

do $$
declare
  owner_id constant uuid := current_setting('tempo_test.owner_id')::uuid;
begin
  if exists (select from public.user_preferences where user_id = owner_id)
    or exists (select from public.notifications where user_id = owner_id) then
    raise exception 'The other user could read owner preferences or notifications';
  end if;
  update public.user_preferences set theme = 'dark' where user_id = owner_id;
  if found then raise exception 'The other user could update owner preferences'; end if;
  if public.mark_notification_read('10000000-0000-4000-8000-000000000002') is distinct from 0 then
    raise exception 'The other account could mark an owner notification';
  end if;
  if public.mark_all_notifications_read() is distinct from 1 then
    raise exception 'Bulk mark affected something other than the caller’s single unread notification';
  end if;
  if public.mark_all_notifications_read() is distinct from 0 then
    raise exception 'Repeating bulk mark was not a no-op';
  end if;
end;
$$;

reset role;
set local role project_admin;
update public.notifications set read_at = null, updated_at = 30
where id = '10000000-0000-4000-8000-000000000003';

reset role;
create temp table preference_notice_before (id uuid primary key) on commit drop;
insert into preference_notice_before (id)
select id from realtime.messages
where channel_name in (
  'user_preferences:' || current_setting('tempo_test.owner_id'),
  'notifications:' || current_setting('tempo_test.owner_id')
);
grant all on preference_notice_before to authenticated, project_admin;

set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims', jsonb_build_object('role', 'authenticated', 'sub', :'owner_id')::text, true
);

do $$
declare
  other_id constant uuid := current_setting('tempo_test.other_id')::uuid;
  newer_id constant uuid := '10000000-0000-4000-8000-000000000002';
  inaccessible_id uuid;
  notice_kind text;
  notice_titles text[];
  marked_at bigint;
  row_data public.user_preferences%rowtype;
begin
  if exists (select 1 from public.user_preferences) then
    raise exception 'Other-owner and deleted preference rows must be hidden';
  end if;

  insert into public.user_preferences (theme) values ('system') returning * into strict row_data;
  if row_data.user_id is distinct from auth.uid() or row_data.theme <> 'system'
    or row_data.locale <> 'en' or row_data.week_starts_on <> 1 or row_data.time_zone <> 'UTC'
    or not row_data.email_reminders or not row_data.in_app_notifications or row_data.coach_web_search then
    raise exception 'A new live preference row must have the owner and the legacy defaults';
  end if;

  set local role project_admin;
  update public.user_preferences set updated_at = 1 where id = row_data.id;
  insert into preference_notice_before (id)
  select seen.id from realtime.messages as seen
  where seen.channel_name = 'user_preferences:' || current_setting('tempo_test.owner_id')
    and seen.event_name = 'UPDATE'
    and seen.id not in (select id from preference_notice_before);
  set local role authenticated;
  with stamped as (
    update public.user_preferences set theme = 'dark', coach_web_search = true
    returning *
  )
  select * into strict row_data from stamped;
  if row_data.theme <> 'dark' or not row_data.coach_web_search or row_data.locale <> 'en'
    or row_data.updated_at is distinct from trunc(extract(epoch from statement_timestamp()) * 1000)::bigint
    or row_data.updated_at = 1 then
    raise exception 'An owner partial update must retain omitted preferences and stamp the update';
  end if;
  perform set_config('tempo_test.preference_id', row_data.id::text, true);

  begin
    insert into public.user_preferences (theme) values ('light');
    raise exception 'A second live preference row must be denied';
  exception when sqlstate '23505' then null;
  end;

  begin
    update public.user_preferences set time_zone = E' \t\n';
    raise exception 'A blank time zone must be denied';
  exception when sqlstate '23514' then null;
  end;

  begin
    update public.user_preferences set time_zone = 'Other/Nowhere';
    raise exception 'A non-IANA time zone must be denied';
  exception when sqlstate '23514' then null;
  end;

  begin
    insert into public.user_preferences (user_id, theme) values (other_id, 'system');
    raise exception 'An owner cannot create another account preference row';
  exception when sqlstate '42501' then null;
  end;

  update public.user_preferences set theme = 'system' where user_id = other_id;
  if found then raise exception 'An owner cannot edit another account preference row'; end if;

  begin
    update public.user_preferences set deleted_at = 42;
    raise exception 'Client preference updates must not change lifecycle metadata';
  exception when sqlstate '42501' then null;
  end;
  begin
    delete from public.user_preferences where id = row_data.id;
    if found then raise exception 'Client preference hard deletes must be denied'; end if;
  exception when sqlstate '42501' then null;
  end;

  select array_agg(title order by created_at desc, id) into notice_titles
  from public.notifications where read_at is null;
  if notice_titles is distinct from array['Newer', 'Older'] then
    raise exception 'The unread inbox must show only live owner notices, newest first';
  end if;

  foreach notice_kind in array array['system', 'billing', 'reminder'] loop
    begin
      insert into public.notifications (user_id, title, body, kind, created_at, updated_at)
      values (auth.uid(), 'Forged', 'Not allowed', notice_kind, 50, 50);
      raise exception 'Client notice creation must be denied for %', notice_kind;
    exception when sqlstate '42501' then null;
    end;
  end loop;

  begin
    update public.notifications set title = 'Forged' where id = newer_id;
    raise exception 'Client notice content edits must be denied';
  exception when sqlstate '42501' then null;
  end;

  begin
    update public.notifications set read_at = 1 where id = newer_id;
    raise exception 'Direct client read timestamp edits must be denied';
  exception when sqlstate '42501' then null;
  end;

  begin
    delete from public.notifications where id = newer_id;
    raise exception 'Client notice hard deletes must be denied';
  exception when sqlstate '42501' then null;
  end;

  if public.mark_notification_read(newer_id) is distinct from 1 then
    raise exception 'An unread owner notice must be markable';
  end if;
  select read_at into strict marked_at from public.notifications where id = newer_id;
  if marked_at is null or marked_at <= 20 or public.mark_notification_read(newer_id) is distinct from 0 then
    raise exception 'A repeat mark must be a no-op and the first mark must use server time';
  end if;

  foreach inaccessible_id in array array[
    '10000000-0000-4000-8000-000000000003'::uuid,
    '10000000-0000-4000-8000-000000000004'::uuid,
    '10000000-0000-4000-8000-000000000005'::uuid,
    null::uuid
  ] loop
    if public.mark_notification_read(inaccessible_id) is distinct from 0 then
      raise exception 'Foreign, deleted, missing and null ids must not mark any notices';
    end if;
  end loop;

  if public.mark_all_notifications_read() is distinct from 1 then
    raise exception 'Bulk mark must count only this owner''s remaining live unread notices';
  end if;
  if public.mark_all_notifications_read() is distinct from 0 or exists (
    select 1 from public.notifications
    where read_at is null or updated_at is distinct from read_at
      or (id = newer_id and read_at is distinct from marked_at)
  ) then
    raise exception 'Bulk marks must stamp reads and leave existing marks unchanged';
  end if;

  perform pg_catalog.set_config('realtime.channel_name', 'notifications:' || auth.uid()::text, true);
  if not exists (select 1 from realtime.channels where pattern = 'notifications:%') then
    raise exception 'An active owner must be able to subscribe to their inbox channel';
  end if;
  perform pg_catalog.set_config('realtime.channel_name', 'notifications:' || other_id::text, true);
  if exists (select 1 from realtime.channels where pattern = 'notifications:%') then
    raise exception 'A client must not subscribe to another owner''s inbox channel';
  end if;
end;
$$;

select set_config('request.jwt.claims',
  jsonb_build_object('role', 'authenticated', 'sub', :'other_id')::text, true);
do $$
declare
  owner_preference constant uuid := current_setting('tempo_test.preference_id')::uuid;
begin
  if exists (select from public.user_preferences where id = owner_preference) then
    raise exception 'The other user could read a live owner preference';
  end if;
  update public.user_preferences set theme = 'light' where id = owner_preference;
  if found then raise exception 'The other user could update a live owner preference'; end if;
end;
$$;

reset role;
do $$
declare
  owner_id constant text := current_setting('tempo_test.owner_id');
  preference_id constant uuid := current_setting('tempo_test.preference_id')::uuid;
  expected record;
begin
  if (select count(*) from realtime.channels
    where pattern in ('user_preferences:%', 'notifications:%') and enabled) <> 2 then
    raise exception 'Both preferences-domain channel patterns must be enabled';
  end if;
  if exists (
    select from realtime.messages as seen
    where seen.channel_name in (
        'user_preferences:' || owner_id, 'notifications:' || owner_id
      )
      and seen.id not in (select id from preference_notice_before)
      and (
        seen.sender_type is distinct from 'system'
        or (seen.channel_name, seen.event_name, seen.payload) not in (
          select wanted.table_name || ':' || owner_id, wanted.op,
            jsonb_build_object('table', wanted.table_name, 'op', wanted.op, 'id', wanted.row_id)
          from (values
            ('user_preferences', 'INSERT', preference_id),
            ('user_preferences', 'UPDATE', preference_id),
            ('notifications', 'UPDATE', '10000000-0000-4000-8000-000000000001'::uuid),
            ('notifications', 'UPDATE', '10000000-0000-4000-8000-000000000002'::uuid)
          ) as wanted(table_name, op, row_id)
        )
      )
  ) or (
    select count(*) from realtime.messages as seen
    where seen.channel_name in (
        'user_preferences:' || owner_id, 'notifications:' || owner_id
      )
      and seen.id not in (select id from preference_notice_before)
  ) is distinct from 4 then
    raise exception 'Owner-channel events after setup must be exactly the tested ID-only writes';
  end if;
  for expected in select * from (values
    ('user_preferences', 'INSERT', preference_id),
    ('user_preferences', 'UPDATE', preference_id),
    ('notifications', 'UPDATE', '10000000-0000-4000-8000-000000000001'::uuid),
    ('notifications', 'UPDATE', '10000000-0000-4000-8000-000000000002'::uuid)
  ) as events(table_name, op, row_id) loop
    if (select count(*) from realtime.messages
      where id not in (select id from preference_notice_before)
        and channel_name = expected.table_name || ':' || owner_id
        and event_name = expected.op and sender_type = 'system'
        and payload = jsonb_build_object('table', expected.table_name, 'op', expected.op, 'id', expected.row_id)) is distinct from 1 then
      raise exception 'Expected one ID-only %.% event', expected.table_name, expected.op;
    end if;
  end loop;
end;
$$;

set local role project_admin;

do $$
begin
  if (
    select count(*) from public.notifications
    where read_at is null and (title = 'Other' or title = 'Deleted')
  ) <> 2 then
    raise exception 'Foreign and deleted notices must remain unmarked after owner requests';
  end if;
end;
$$;

reset role;
update public.account_gate set is_active = false
where user_id = :'other_id';
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims', jsonb_build_object('role', 'authenticated', 'sub', :'other_id')::text, true
);

do $$
begin
  if exists (select 1 from public.user_preferences) or exists (select 1 from public.notifications)
    or public.mark_all_notifications_read() <> 0
    or public.mark_notification_read('10000000-0000-4000-8000-000000000003') <> 0 then
    raise exception 'An inactive owner must not read preferences or read and mark notices';
  end if;
end;
$$;

select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
do $$
begin
  if public.mark_notification_read('10000000-0000-4000-8000-000000000003') <> 0
    or public.mark_all_notifications_read() <> 0 then
    raise exception 'An authenticated session without an owner must not mark notices';
  end if;
end;
$$;

reset role;
set local role anon;
select pg_catalog.set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  begin
    if exists (select from public.notifications) then raise exception 'Anonymous inbox reads must be denied'; end if;
  exception when sqlstate '42501' then null;
  end;
  begin
    if exists (select from public.user_preferences) then raise exception 'Anonymous preference reads must be denied'; end if;
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.mark_notification_read('10000000-0000-4000-8000-000000000003');
    raise exception 'Anonymous single mark requests must be denied';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform public.mark_all_notifications_read();
    raise exception 'Anonymous mark requests must be denied';
  exception when sqlstate '42501' then null;
  end;
end;
$$;

rollback;

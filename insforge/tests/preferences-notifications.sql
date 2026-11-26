begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'preferences-owner@example.test'),
  ('00000000-0000-4000-8000-000000000002', 'preferences-other@example.test');

set local role project_admin;

insert into public.user_preferences (user_id, theme, created_at, updated_at, deleted_at, legacy_convex_id)
values
  ('00000000-0000-4000-8000-000000000001', 'dark', 1, 2, 2, 'preferences-deleted'),
  ('00000000-0000-4000-8000-000000000002', 'light', 1, 1, null, 'preferences-other');

insert into public.notifications (id, user_id, title, body, kind, created_at, updated_at, deleted_at)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
   'Older', 'System notice', 'system', 10, 10, null),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001',
   'Newer', 'Reminder notice', 'reminder', 20, 20, null),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002',
   'Other', 'Billing notice', 'billing', 30, 30, null),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001',
   'Deleted', 'Hidden notice', 'system', 40, 41, 41);

reset role;
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000001"}', true
);

do $$
declare
  other_id constant uuid := '00000000-0000-4000-8000-000000000002';
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

  update public.user_preferences set theme = 'dark', coach_web_search = true
  returning * into strict row_data;
  if row_data.theme <> 'dark' or not row_data.coach_web_search or row_data.locale <> 'en'
    or row_data.updated_at < row_data.created_at then
    raise exception 'An owner partial update must retain omitted preferences and stamp the update';
  end if;

  begin
    insert into public.user_preferences (theme) values ('light');
    raise exception 'A second live preference row must be denied';
  exception when unique_violation then null;
  end;

  begin
    update public.user_preferences set time_zone = E' \t\n';
    raise exception 'A blank time zone must be denied';
  exception when check_violation then null;
  end;

  begin
    insert into public.user_preferences (user_id, theme) values (other_id, 'system');
    raise exception 'An owner cannot create another account preference row';
  exception when insufficient_privilege then null;
  end;

  update public.user_preferences set theme = 'system' where user_id = other_id;
  if found then raise exception 'An owner cannot edit another account preference row'; end if;

  begin
    update public.user_preferences set deleted_at = 42;
    raise exception 'Client preference updates must not change lifecycle metadata';
  exception when insufficient_privilege then null;
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
    exception when insufficient_privilege then null;
    end;
  end loop;

  begin
    update public.notifications set title = 'Forged' where id = newer_id;
    raise exception 'Client notice content edits must be denied';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.notifications set read_at = 1 where id = newer_id;
    raise exception 'Direct client read timestamp edits must be denied';
  exception when insufficient_privilege then null;
  end;

  begin
    delete from public.notifications where id = newer_id;
    raise exception 'Client notice hard deletes must be denied';
  exception when insufficient_privilege then null;
  end;

  if public.mark_notification_read(newer_id) <> 1 then
    raise exception 'An unread owner notice must be markable';
  end if;
  select read_at into strict marked_at from public.notifications where id = newer_id;
  if marked_at is null or marked_at <= 20 or public.mark_notification_read(newer_id) <> 0 then
    raise exception 'A repeat mark must be a no-op and the first mark must use server time';
  end if;

  foreach inaccessible_id in array array[
    '10000000-0000-4000-8000-000000000003'::uuid,
    '10000000-0000-4000-8000-000000000004'::uuid,
    '10000000-0000-4000-8000-000000000005'::uuid,
    null::uuid
  ] loop
    if public.mark_notification_read(inaccessible_id) <> 0 then
      raise exception 'Foreign, deleted, missing and null ids must not mark any notices';
    end if;
  end loop;

  if public.mark_all_notifications_read() <> 1 then
    raise exception 'Bulk mark must count only this owner''s remaining live unread notices';
  end if;
  if public.mark_all_notifications_read() <> 0 or exists (
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

reset role;
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
where user_id = '00000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_catalog.set_config(
  'request.jwt.claims', '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000000002"}', true
);

do $$
begin
  if exists (select 1 from public.user_preferences) or exists (select 1 from public.notifications)
    or public.mark_all_notifications_read() <> 0 then
    raise exception 'An inactive owner must not read preferences or read and mark notices';
  end if;
end;
$$;

reset role;
set local role anon;
select pg_catalog.set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  begin
    perform 1 from public.notifications;
    raise exception 'Anonymous inbox reads must be denied';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.mark_all_notifications_read();
    raise exception 'Anonymous mark requests must be denied';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;

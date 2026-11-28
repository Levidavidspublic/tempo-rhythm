begin;

update public.account_gate set approval_status = 'approved'
where user_id in (:'owner_id', :'other_id');

select set_config('tempo_test.owner_id', :'owner_id', true);

set local role project_admin;
insert into public.coach_settings (user_id, created_at, updated_at)
values (:'other_id', 1, 1);
insert into public.coach_web_searches (id, user_id, utc_date_key, created_at, updated_at)
values
  ('27000000-0000-4000-8000-000000000011', :'owner_id', date '2026-11-27', 1, 1),
  ('27000000-0000-4000-8000-000000000012', :'owner_id', date '2026-11-27', 1, 1),
  ('27000000-0000-4000-8000-000000000013', :'other_id', date '2026-11-27', 1, 1);

do $$
declare
  owner_id constant uuid := current_setting('tempo_test.owner_id')::uuid;
  search_id constant uuid := '27000000-0000-4000-8000-000000000011';
  missing_user constant uuid := '27000000-0000-4000-8000-000000000099';
begin
  if (select count(*) from public.coach_web_searches
      where user_id = owner_id and utc_date_key = date '2026-11-27') <> 2 then
    raise exception 'The service cannot count multiple searches on the same UTC day';
  end if;
  update public.coach_web_searches set deleted_at = 2, updated_at = 2 where id = search_id;
  if not found or not exists (select 1 from public.coach_web_searches where id = search_id and deleted_at = 2)
    or (select count(*) from public.coach_web_searches
        where user_id = owner_id and utc_date_key = date '2026-11-27') <> 2 then
    raise exception 'Tombstoning a search should not erase it from the quota count';
  end if;

  begin
    delete from public.coach_web_searches where id = search_id;
    raise exception 'The service hard-deleted a search';
  exception when sqlstate '42501' then null;
  end;
  begin
    update public.coach_web_searches set utc_date_key = 'infinity' where id = search_id;
    raise exception 'The service stored a nonfinite UTC date';
  exception when sqlstate '23514' then null;
  end;
  begin
    insert into public.coach_web_searches (user_id, utc_date_key, created_at, updated_at)
    values (missing_user, date '2026-11-27', 1, 1);
    raise exception 'An orphan search was accepted';
  exception when sqlstate '23503' then null;
  end;
  begin
    insert into public.coach_settings (user_id, created_at, updated_at) values (missing_user, 1, 1);
    raise exception 'An orphan settings row was accepted';
  exception when sqlstate '23503' then null;
  end;
  begin
    update public.coach_settings set task_load = 5;
    raise exception 'The service stored an unsupported task load';
  exception when sqlstate '23514' then null;
  end;
  begin
    update public.coach_settings set accepted_streak = -1;
    raise exception 'The service stored a negative streak';
  exception when sqlstate '23514' then null;
  end;
end
$$;

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', :'owner_id', 'role', 'authenticated')::text, true);
select set_config('realtime.channel_name', 'coach_settings:' || :'owner_id', true);

do $$
declare
  settings_id constant uuid := '27000000-0000-4000-8000-000000000001';
begin
  insert into public.coach_settings (id, user_id, created_at, updated_at)
  values (settings_id, auth.uid(), 1, 1);
  if (select count(*) from public.coach_settings) <> 1
    or not exists (select 1 from public.coach_settings
       where id = settings_id and dial = 5 and task_load = 2 and accepted_streak = 0 and panic_until is null) then
    raise exception 'The owner cannot read their default settings or can see another account';
  end if;
  begin
    insert into public.coach_settings (user_id, created_at, updated_at) values (auth.uid(), 1, 1);
    raise exception 'The owner created two live settings rows';
  exception when sqlstate '23505' then null;
  end;
  begin
    update public.coach_settings set dial = 11 where id = settings_id;
    raise exception 'Invalid coach dial was accepted';
  exception when sqlstate '23514' then null;
  end;
  begin
    update public.coach_settings set accepted_streak = 1 where id = settings_id;
    raise exception 'The owner directly wrote server-managed streak state';
  exception when sqlstate '42501' then null;
  end;

  update public.coach_settings set dial = 10, panic_until = 1000, updated_at = 2 where id = settings_id;
  if not found or not exists (select 1 from public.coach_settings
      where id = settings_id and dial = 10 and panic_until = 1000) then
    raise exception 'The owner could not update their coach dial and panic state';
  end if;
  update public.coach_settings set deleted_at = 3, updated_at = 3 where id = settings_id;
  if not found or not exists (select 1 from public.coach_settings where id = settings_id and deleted_at = 3) then
    raise exception 'The owner could not soft-delete their settings';
  end if;
  begin
    delete from public.coach_settings where id = settings_id;
    raise exception 'The owner hard-deleted their settings';
  exception when sqlstate '42501' then null;
  end;
  if (select array_agg(pattern) from realtime.channels) is distinct from array['coach_settings:%'] then
    raise exception 'The owner cannot subscribe to their settings channel';
  end if;

  begin
    perform 1 from public.coach_web_searches;
    raise exception 'Authenticated owners can directly read private search rows';
  exception when sqlstate '42501' then null;
  end;
  begin
    insert into public.coach_web_searches (user_id, utc_date_key, created_at, updated_at)
    values (auth.uid(), date '2026-11-27', 1, 1);
    raise exception 'Authenticated owners can directly write private search rows';
  exception when sqlstate '42501' then null;
  end;
end
$$;

select set_config('request.jwt.claims', jsonb_build_object('sub', :'other_id', 'role', 'authenticated')::text, true);
do $$
declare
  owner_id constant uuid := current_setting('tempo_test.owner_id')::uuid;
begin
  if exists (select 1 from public.coach_settings where user_id = owner_id)
    or exists (select 1 from realtime.channels) then
    raise exception 'Another account can read owner settings or subscribe to their channel';
  end if;
  update public.coach_settings set dial = 0 where user_id = owner_id;
  if found then raise exception 'Another account can update owner settings'; end if;
  begin
    insert into public.coach_settings (user_id, created_at, updated_at) values (owner_id, 1, 1);
    raise exception 'Another account can create settings for the owner';
  exception when sqlstate '42501' then null;
  end;
end
$$;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  begin
    perform 1 from public.coach_settings;
    raise exception 'Anonymous accounts can read coach settings';
  exception when sqlstate '42501' then null;
  end;
  begin
    perform 1 from public.coach_web_searches;
    raise exception 'Anonymous accounts can read private search rows';
  exception when sqlstate '42501' then null;
  end;
end
$$;

reset role;
do $$
declare
  owner_channel text := 'coach_settings:' || current_setting('tempo_test.owner_id');
  settings_id constant uuid := '27000000-0000-4000-8000-000000000001';
begin
  if (select count(*) from realtime.messages where channel_name = owner_channel and sender_type = 'system'
      and event_name = 'INSERT' and payload = jsonb_build_object('table', 'coach_settings', 'op', 'INSERT', 'id', settings_id)) <> 1
    or (select count(*) from realtime.messages where channel_name = owner_channel and sender_type = 'system'
        and event_name = 'UPDATE' and payload = jsonb_build_object('table', 'coach_settings', 'op', 'UPDATE', 'id', settings_id)) <> 2
  then
    raise exception 'Settings changes did not emit the expected id-only events';
  end if;
  if exists (select 1 from realtime.channels where pattern = 'coach_web_searches:%')
    or exists (select 1 from realtime.messages where channel_name like 'coach_web_searches:%') then
    raise exception 'Private search rows registered a channel or emitted an event';
  end if;
end
$$;

rollback;

-- Use an isolated test database with two pre-provisioned fixture users and a session
-- allowed to assume project_admin, authenticated and anon. Everything here rolls back.
begin;

set local role project_admin;
do $$
declare
  owner_id uuid;
  other_id uuid;
  lease_id uuid;
  other_lease_id uuid;
  started_ms constant bigint := 1767225600000;
  expiry_ms bigint;
  failed_constraint text;
begin
  select user_id into strict owner_id from public.account_gate
  where email = 'q85-owner@example.test' and deleted_at is null and is_active;
  select user_id into strict other_id from public.account_gate
  where email = 'q85-other@example.test' and deleted_at is null and is_active;
  perform pg_catalog.set_config('q85.owner_id', owner_id::text, true);
  perform pg_catalog.set_config('q85.other_id', other_id::text, true);

  insert into public.voice_leases (
    user_id, conversation_id, client_key, language, started_at, last_renewal_at,
    date_key, utc_date_key, created_at, updated_at
  )
  values (
    owner_id, pg_catalog.gen_random_uuid(), 'fixture-owner', 'en', started_ms, started_ms,
    date '2026-01-01', date '2026-01-01', started_ms, started_ms
  )
  returning id into lease_id;

  select expires_at into strict expiry_ms from public.voice_leases where id = lease_id;
  if expiry_ms <> started_ms + 45000 then
    raise exception 'Q85: initial expiry must allow 45 seconds without a heartbeat';
  end if;

  begin
    insert into public.voice_leases (
      user_id, conversation_id, client_key, language, started_at, last_renewal_at,
      date_key, utc_date_key, created_at, updated_at
    )
    values (
      owner_id, pg_catalog.gen_random_uuid(), 'fixture-duplicate', 'en', started_ms, started_ms,
      date '2026-01-01', date '2026-01-01', started_ms, started_ms
    );
    raise exception 'Q85: a second active lease for the same owner was accepted';
  exception when unique_violation then
    get stacked diagnostics failed_constraint = constraint_name;
    if failed_constraint <> 'voice_leases_one_active_per_owner' then raise; end if;
  end;

  insert into public.voice_leases (
    user_id, conversation_id, client_key, language, started_at, last_renewal_at,
    date_key, utc_date_key, created_at, updated_at
  )
  values (
    other_id, pg_catalog.gen_random_uuid(), 'fixture-other', 'he', started_ms, started_ms,
    date '2026-01-01', date '2026-01-01', started_ms, started_ms
  )
  returning id into other_lease_id;

  begin
    update public.voice_leases set last_renewal_at = started_ms - 1 where id = lease_id;
    raise exception 'Q85: a heartbeat before the start was accepted';
  exception when check_violation then
    get stacked diagnostics failed_constraint = constraint_name;
    if failed_constraint <> 'voice_leases_heartbeat_bounds' then raise; end if;
  end;

  begin
    update public.voice_leases
    set last_renewal_at = started_ms + 900001, updated_at = started_ms + 900001
    where id = lease_id;
    raise exception 'Q85: a heartbeat after the session cap was accepted';
  exception when check_violation then
    get stacked diagnostics failed_constraint = constraint_name;
    if failed_constraint <> 'voice_leases_heartbeat_bounds' then raise; end if;
  end;

  for heartbeat in 1..59 loop
    update public.voice_leases
    set last_renewal_at = started_ms + heartbeat * 15000,
        updated_at = started_ms + heartbeat * 15000
    where id = lease_id returning expires_at into strict expiry_ms;
  end loop;
  if expiry_ms <> started_ms + 900000 then
    raise exception 'Q85: a late heartbeat extended expiry past the session cap';
  end if;

  begin
    update public.voice_leases set status = 'ended' where id = lease_id;
    raise exception 'Q85: an ended lease without accounting fields was accepted';
  exception when check_violation then
    get stacked diagnostics failed_constraint = constraint_name;
    if failed_constraint <> 'voice_leases_end_state' then raise; end if;
  end;

  update public.voice_leases
  set status = 'ended', end_reason = 'stopped', ended_at = started_ms + 890000,
      duration_ms = 890000, updated_at = started_ms + 890000
  where id = lease_id;

  update public.voice_leases set deleted_at = started_ms + 890000 where id = other_lease_id;

  insert into public.voice_leases (
    user_id, conversation_id, client_key, language, started_at, last_renewal_at,
    date_key, utc_date_key, created_at, updated_at
  )
  select fixture_user, pg_catalog.gen_random_uuid(), 'fixture-replacement', 'en',
         started_ms + 890000, started_ms + 890000, date '2026-01-01', date '2026-01-01',
         started_ms + 890000, started_ms + 890000
  from (values (owner_id), (other_id)) as fixture(fixture_user);
end;
$$;
reset role;

set local role authenticated;
do $$
declare
  actor_id uuid;
  statement text;
begin
  foreach actor_id in array array[
    pg_catalog.current_setting('q85.owner_id')::uuid,
    pg_catalog.current_setting('q85.other_id')::uuid
  ] loop
    perform pg_catalog.set_config(
      'request.jwt.claims', pg_catalog.jsonb_build_object('sub', actor_id, 'role', 'authenticated')::text,
      true
    );
    if auth.uid() is distinct from actor_id then
      raise exception 'Q85: authenticated fixture identity did not resolve';
    end if;

    foreach statement in array array[
      'select id from public.voice_leases',
      'insert into public.voice_leases default values',
      'update public.voice_leases set grants = 1',
      'delete from public.voice_leases'
    ] loop
      begin
        execute statement;
        raise exception 'Q85: authenticated access was not denied: %', statement;
      exception when insufficient_privilege then null;
      end;
    end loop;
  end loop;
end;
$$;
reset role;

set local role anon;
do $$
begin
  perform pg_catalog.set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin
    perform id from public.voice_leases;
    raise exception 'Q85: anonymous read was not denied';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

rollback;

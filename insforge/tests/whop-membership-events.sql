-- Use only an isolated database after #1857 and this migration, with two active
-- fixture accounts and a session allowed to assume project_admin, authenticated and anon.
begin;

set local role project_admin;
do $$
declare
  owner_id uuid;
  other_id uuid;
  event_ms constant bigint := 1767225600000;
  latest_status text;
begin
  select user_id into strict owner_id from public.account_gate
  where email = 'q92-owner@example.test' and deleted_at is null and is_active;
  select user_id into strict other_id from public.account_gate
  where email = 'q92-other@example.test' and deleted_at is null and is_active;
  perform pg_catalog.set_config('q92.owner_id', owner_id::text, true);
  perform pg_catalog.set_config('q92.other_id', other_id::text, true);

  insert into public.whop_membership_events (
    event_id, membership_id, event_type, status, whop_user_id, cancel_at_period_end, event_timestamp
  )
  values
    ('q92-newer', 'q92-membership', 'membership.activated', 'active', owner_id::text, false, event_ms),
    ('q92-older', 'q92-membership', 'membership.updated', 'trialing', owner_id::text, false, event_ms - 1);

  insert into public.whop_membership_events (
    event_id, membership_id, event_type, status, cancel_at_period_end, event_timestamp
  )
  values ('q92-newer', 'q92-other-membership', 'membership.deactivated', 'canceled', true, event_ms + 1)
  on conflict (event_id) do nothing;
  if found then
    raise exception 'Q92: a repeated event ID was inserted under a different membership';
  end if;

  select status into strict latest_status from public.whop_membership_events
  where membership_id = 'q92-membership' and whop_user_id = owner_id::text
  order by event_timestamp desc limit 1;
  if latest_status <> 'active' then
    raise exception 'Q92: the late event or retry displaced the newest event';
  end if;

  begin
    insert into public.whop_membership_events (
      event_id, membership_id, event_type, status, cancel_at_period_end, event_timestamp
    )
    values ('q92-invalid', 'q92-membership', 'membership.updated', 'invalid', false, event_ms);
    raise exception 'Q92: an invalid membership status was accepted';
  exception when check_violation then null;
  end;
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
    pg_catalog.current_setting('q92.owner_id')::uuid,
    pg_catalog.current_setting('q92.other_id')::uuid
  ] loop
    perform pg_catalog.set_config(
      'request.jwt.claims', pg_catalog.jsonb_build_object('sub', actor_id, 'role', 'authenticated')::text,
      true
    );
    if auth.uid() is distinct from actor_id then
      raise exception 'Q92: authenticated fixture identity did not resolve';
    end if;

    foreach statement in array array[
      'select event_id from public.whop_membership_events',
      'insert into public.whop_membership_events default values',
      'update public.whop_membership_events set status = ''canceled''',
      'delete from public.whop_membership_events'
    ] loop
      begin
        execute statement;
        raise exception 'Q92: authenticated access was not denied: %', statement;
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
    perform event_id from public.whop_membership_events;
    raise exception 'Q92: anonymous read was not denied';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

rollback;

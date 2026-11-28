begin;

update public.account_gate set approval_status = 'approved'
where user_id in (:'owner_id', :'other_id');
select set_config('tempo_test.owner_id', :'owner_id', true);
select set_config('tempo_test.other_id', :'other_id', true);

set local role project_admin;
do $$
declare
  event_ms constant bigint := 1767225600000;
  newest_id uuid;
  latest_status text;
begin
  if (select relrowsecurity from pg_catalog.pg_class where oid = 'public.whop_membership_events'::regclass)
      is distinct from true then
    raise exception 'RLS is not enabled for membership events';
  end if;

  insert into public.whop_membership_events (
    event_id, membership_id, event_type, status, whop_user_id, cancel_at_period_end, event_timestamp
  ) values (
    'fixture-newer', 'fixture-membership', 'membership.activated', 'active',
    'fixture-provider-user', false, event_ms
  ) returning id into newest_id;

  insert into public.whop_membership_events (
    event_id, membership_id, event_type, status, whop_user_id, cancel_at_period_end, event_timestamp
  ) values (
    'fixture-older', 'fixture-membership', 'membership.updated', 'trialing',
    'fixture-provider-user', false, event_ms - 1
  );

  insert into public.whop_membership_events (
    event_id, membership_id, event_type, status, cancel_at_period_end, event_timestamp
  ) values ('fixture-newer', 'fixture-other-membership', 'membership.deactivated', 'canceled', true, event_ms + 1)
  on conflict (event_id) do nothing;
  if found then raise exception 'A repeated provider event ID was inserted under a different membership'; end if;

  select status into strict latest_status from public.whop_membership_events
  where membership_id = 'fixture-membership' and deleted_at is null
  order by event_timestamp desc limit 1;
  if latest_status is distinct from 'active' or not exists (
    select from public.whop_membership_events where id = newest_id and received_at > 0
      and whop_user_id = 'fixture-provider-user'
  ) then
    raise exception 'Admin could not read the newest event and its receipt metadata';
  end if;

  begin
    update public.whop_membership_events set event_id = 'fixture-older' where id = newest_id;
    raise exception 'Duplicate event ID was accepted';
  exception when sqlstate '23505' then null;
  end;
  begin
    update public.whop_membership_events set event_id = 'invalid id' where id = newest_id;
    raise exception 'Invalid event ID was accepted';
  exception when sqlstate '23514' then null;
  end;
  begin
    update public.whop_membership_events set membership_id = '' where id = newest_id;
    raise exception 'Empty membership ID was accepted';
  exception when sqlstate '23514' then null;
  end;
  begin
    update public.whop_membership_events set event_type = 'invalid' where id = newest_id;
    raise exception 'Invalid event type was accepted';
  exception when sqlstate '23514' then null;
  end;
  begin
    update public.whop_membership_events set status = 'invalid' where id = newest_id;
    raise exception 'Invalid membership status was accepted';
  exception when sqlstate '23514' then null;
  end;
  begin
    delete from public.whop_membership_events where id = newest_id;
    raise exception 'Admin could hard-delete an event';
  exception when sqlstate '42501' then null;
  end;

  update public.whop_membership_events set deleted_at = event_ms + 2 where id = newest_id;
  if not found or not exists (
    select from public.whop_membership_events where id = newest_id and deleted_at = event_ms + 2
  ) then
    raise exception 'Admin could not soft-delete the event';
  end if;
end;
$$;

reset role;
do $$
declare
  actor record;
  statement text;
begin
  for actor in select * from (values
    ('authenticated', current_setting('tempo_test.owner_id')),
    ('authenticated', current_setting('tempo_test.other_id')),
    ('anon', null)
  ) as actors(role_name, subject)
  loop
    perform set_config('request.jwt.claims', jsonb_strip_nulls(jsonb_build_object(
      'sub', actor.subject, 'role', actor.role_name))::text, true);
    execute format('set local role %I', actor.role_name);
    if auth.uid() is distinct from actor.subject::uuid then
      raise exception 'Fixture identity did not resolve';
    end if;
    foreach statement in array array[
      'select event_id from public.whop_membership_events',
      'insert into public.whop_membership_events default values',
      'update public.whop_membership_events set status = ''canceled''',
      'delete from public.whop_membership_events'
    ] loop
      begin
        execute statement;
        raise exception 'Private event table did not deny %: %', actor.role_name, statement;
      exception when sqlstate '42501' then null;
      end;
    end loop;
    reset role;
  end loop;
end;
$$;

rollback;

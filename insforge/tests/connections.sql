begin;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000001926', 'q87-owner@example.invalid'),
  ('00000000-0000-4000-8000-000000001927', 'q87-other@example.invalid');

update public.account_gate set approval_status = 'approved'
where user_id in ('00000000-0000-4000-8000-000000001926', '00000000-0000-4000-8000-000000001927');

set local role project_admin;

insert into public.oauth_clients (
  id, issuer, redirect_uri, client_id, client_secret_cipher, key_version,
  token_endpoint_auth_method, authorization_endpoint, token_endpoint, code_challenge_s256,
  created_at, updated_at
) values (
  '10000000-0000-4000-8000-000000001926', 'https://executor.example.invalid',
  'https://tempo.example.invalid/callback', 'q87-client', 'fixture-ciphertext', 1,
  'client_secret_basic', 'https://executor.example.invalid/authorize',
  'https://executor.example.invalid/token', true, 1, 1
);

insert into public.connections (
  id, user_id, provider, status, mcp_url, issuer, client_row_id,
  connected_at, created_at, updated_at, deleted_at
)
select fixture.id::uuid, fixture.user_id::uuid, 'executor', fixture.status,
  'https://executor.example.invalid/mcp', client.issuer, client.id, 1, 1, 2, fixture.deleted_at
from public.oauth_clients as client
cross join (values
  ('20000000-0000-4000-8000-000000001926', '00000000-0000-4000-8000-000000001926', 'connected', null::bigint),
  ('20000000-0000-4000-8000-000000001927', '00000000-0000-4000-8000-000000001927', 'needs_reauth', null),
  ('20000000-0000-4000-8000-000000001928', '00000000-0000-4000-8000-000000001926', 'disconnected', 2)
) as fixture (id, user_id, status, deleted_at)
where client.id = '10000000-0000-4000-8000-000000001926';

insert into public.connection_secrets (
  user_id, connection_id, access_token_cipher, refresh_token_cipher, key_version, created_at, updated_at
) values (
  '00000000-0000-4000-8000-000000001926', '20000000-0000-4000-8000-000000001926',
  'fixture-ciphertext', 'fixture-ciphertext', 1, 1, 1
);

insert into public.connection_limits (user_id, call_window_start_ms, call_window_count, created_at, updated_at)
values ('00000000-0000-4000-8000-000000001926', 1, 1, 1, 1);

insert into public.connection_calls (user_id, connection_id, kind, tool, decision, outcome, input_digest, created_at, updated_at)
values (
  '00000000-0000-4000-8000-000000001926', '20000000-0000-4000-8000-000000001926',
  'tool_call', 'search', 'auto', 'ok', repeat('0', 64), 1, 1
);

insert into public.oauth_pending (
  user_id, provider, state_hash, code_verifier_cipher, key_version, issuer, resource,
  redirect_uri, client_row_id, return_to, expires_at, created_at, updated_at
) values (
  '00000000-0000-4000-8000-000000001926', 'executor', repeat('1', 64), 'fixture-ciphertext', 1,
  'https://executor.example.invalid', 'https://executor.example.invalid/mcp',
  'https://tempo.example.invalid/callback', '10000000-0000-4000-8000-000000001926',
  'settings', 600001, 1, 1
);

do $$
begin
  if (select count(*) from public.connections where id in (
      '20000000-0000-4000-8000-000000001926', '20000000-0000-4000-8000-000000001927',
      '20000000-0000-4000-8000-000000001928'
    )) <> 3
    or not exists (select 1 from public.oauth_clients where client_id = 'q87-client')
    or not exists (select 1 from public.oauth_pending where state_hash = repeat('1', 64))
    or not exists (select 1 from public.connection_limits where call_window_start_ms = 1
      and user_id = '00000000-0000-4000-8000-000000001926')
    or not exists (select 1 from public.connection_calls where connection_id = '20000000-0000-4000-8000-000000001926')
    or not exists (select 1 from public.connection_secrets where connection_id = '20000000-0000-4000-8000-000000001926')
  then
    raise exception 'Service role must see all seeded connection data, including tombstones';
  end if;

  update public.connection_secrets
  set access_token_cipher = null, refresh_token_cipher = null, deleted_at = 3, updated_at = 3
  where connection_id = '20000000-0000-4000-8000-000000001926';
  if not found then raise exception 'Service role must be able to scrub credentials'; end if;

  begin
    insert into public.connection_calls (user_id, connection_id, kind, outcome, created_at, updated_at)
    values (
      '00000000-0000-4000-8000-000000001926', '20000000-0000-4000-8000-000000001927',
      'tool_call', 'ok', 1, 1
    );
    raise exception 'Service role inserted a call with a different connection owner';
  exception when foreign_key_violation then null;
  end;

  begin
    update public.connections set status = 'connected', deleted_at = null
    where id = '20000000-0000-4000-8000-000000001928';
    raise exception 'Service role made two connections usable for the same owner and provider';
  exception when unique_violation then null;
  end;
end;
$$;

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000001926"}';

do $$
declare
  private_column text;
  private_table text;
begin
  if (select array_agg(status order by id) from public.connections) is distinct from array['connected']
  then
    raise exception 'Owner must see only their non-deleted connection status';
  end if;

  begin
    perform * from public.connections;
    raise exception 'Authenticated owner read the full connection row';
  exception when insufficient_privilege then null;
  end;

  foreach private_column in array array['mcp_url', 'client_row_id', 'refresh_lease_token', 'confirm_nonce_hash']
  loop
    begin
      execute format('select %I from public.connections', private_column);
      raise exception 'Authenticated owner read protected connection field %', private_column;
    exception when insufficient_privilege then null;
    end;
  end loop;

  foreach private_table in array array[
    'connection_secrets', 'connection_limits', 'connection_calls', 'oauth_clients', 'oauth_pending'
  ] loop
    begin
      execute format('select * from public.%I', private_table);
      raise exception 'Authenticated owner read private table %', private_table;
    exception when insufficient_privilege then null;
    end;
  end loop;

  begin
    update public.connections set status = 'disconnected' where user_id = auth.uid();
    raise exception 'Authenticated owner bypassed the service write path';
  exception when insufficient_privilege then null;
  end;
end;
$$;

set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000001927"}';

do $$
begin
  if (select array_agg(status order by id) from public.connections) is distinct from array['needs_reauth']
  then
    raise exception 'Other account must not see the first account connection';
  end if;
end;
$$;

reset role;
update public.account_gate set is_active = false where user_id = '00000000-0000-4000-8000-000000001926';
update public.account_gate set approval_status = 'pending' where user_id = '00000000-0000-4000-8000-000000001927';
set local role authenticated;

do $$
begin
  if exists (select status from public.connections) then
    raise exception 'Pending account must not see connection status';
  end if;
end;
$$;

set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-4000-8000-000000001926"}';

do $$
begin
  if exists (select status from public.connections) then
    raise exception 'Inactive account must not see connection status';
  end if;
end;
$$;

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

do $$
begin
  begin
    perform status from public.connections;
    raise exception 'Anonymous role read connection status';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;

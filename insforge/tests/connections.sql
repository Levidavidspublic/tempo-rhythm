begin;

update public.account_gate set approval_status = 'approved'
where user_id in (:'owner_id', :'other_id');
select set_config('tempo_test.owner_id', :'owner_id', true);
select set_config('tempo_test.other_id', :'other_id', true);
select set_config('tempo_test.connection_tables',
  'connections,connection_secrets,connection_limits,connection_calls,oauth_clients,oauth_pending', true);

set local role project_admin;
do $$
declare
  owner_id constant uuid := current_setting('tempo_test.owner_id')::uuid;
  other_id constant uuid := current_setting('tempo_test.other_id')::uuid;
  client_row uuid;
  owner_connection uuid;
  other_connection uuid;
  table_name text;
  intact boolean;
begin
  foreach table_name in array string_to_array(current_setting('tempo_test.connection_tables'), ',') loop
    if (select relrowsecurity from pg_catalog.pg_class where oid = format('public.%I', table_name)::regclass)
        is distinct from true then
      raise exception 'RLS is not enabled for %', table_name;
    end if;
  end loop;

  insert into public.oauth_clients (issuer, redirect_uri, client_id, key_version,
    token_endpoint_auth_method, authorization_endpoint, token_endpoint, code_challenge_s256, created_at, updated_at)
  values ('https://executor.example.invalid', 'https://tempo.example.invalid/callback', 'fixture-client', 1,
    'none', 'https://executor.example.invalid/authorize', 'https://executor.example.invalid/token', true, 1, 1)
  returning id into client_row;

  insert into public.connections (user_id, provider, status, mcp_url, issuer, client_row_id,
    connected_at, created_at, updated_at)
  values (owner_id, 'executor', 'connected', 'https://executor.example.invalid/mcp',
    'https://executor.example.invalid', client_row, 1, 1, 1) returning id into owner_connection;
  insert into public.connections (user_id, provider, status, mcp_url, issuer, client_row_id,
    connected_at, created_at, updated_at)
  values (other_id, 'executor', 'needs_reauth', 'https://executor.example.invalid/mcp',
    'https://executor.example.invalid', client_row, 1, 1, 1) returning id into other_connection;

  insert into public.connection_secrets (user_id, connection_id, access_token_cipher, key_version,
    created_at, updated_at)
  values (owner_id, owner_connection, 'fixture-ciphertext', 1, 1, 1);
  insert into public.connection_limits (user_id, call_window_start_ms, call_window_count, created_at, updated_at)
  values (owner_id, 1, 1, 1, 1);
  insert into public.connection_calls (user_id, connection_id, kind, outcome, created_at, updated_at)
  values (owner_id, owner_connection, 'tool_call', 'ok', 1, 1);
  insert into public.oauth_pending (user_id, provider, state_hash, code_verifier_cipher, key_version,
    issuer, resource, redirect_uri, client_row_id, return_to, expires_at, created_at, updated_at)
  values (owner_id, 'executor', repeat('a', 64), 'fixture-ciphertext', 1, 'https://executor.example.invalid',
    'https://executor.example.invalid/mcp', 'https://tempo.example.invalid/callback', client_row, 'settings', 10, 1, 1);

  begin
    insert into public.connection_secrets (user_id, connection_id, key_version, created_at, updated_at)
    values (owner_id, other_connection, 1, 1, 1);
    raise exception 'Secret accepted a connection belonging to the other user';
  exception when sqlstate '23503' then null;
  end;
  begin
    insert into public.connection_calls (user_id, connection_id, kind, outcome, created_at, updated_at)
    values (owner_id, other_connection, 'tool_call', 'ok', 1, 1);
    raise exception 'Call accepted a connection belonging to the other user';
  exception when sqlstate '23503' then null;
  end;
  begin
    update public.connections set client_row_id = '00000000-0000-4000-8000-000000009936'
    where id = owner_connection;
    raise exception 'Connection accepted a nonexistent OAuth client';
  exception when sqlstate '23503' then null;
  end;
  begin
    update public.oauth_pending set client_row_id = '00000000-0000-4000-8000-000000009936';
    raise exception 'Pending state accepted a nonexistent OAuth client';
  exception when sqlstate '23503' then null;
  end;
  begin
    insert into public.connection_limits (user_id, created_at, updated_at)
    values ('00000000-0000-4000-8000-000000009936', 1, 1);
    raise exception 'Limit row accepted a nonexistent user';
  exception when sqlstate '23503' then null;
  end;
  begin
    insert into public.connections (user_id, provider, status, mcp_url, issuer, client_row_id,
      connected_at, created_at, updated_at)
    values (owner_id, 'executor', 'unavailable', 'https://executor.example.invalid/mcp',
      'https://executor.example.invalid', client_row, 2, 2, 2);
    raise exception 'Two usable connections for one owner and provider were accepted';
  exception when sqlstate '23505' then null;
  end;
  begin
    update public.connections set status = 'invalid' where id = owner_connection;
    raise exception 'Invalid connection status was accepted';
  exception when sqlstate '23514' then null;
  end;
  begin
    update public.connection_calls set outcome = 'invalid';
    raise exception 'Invalid call outcome was accepted';
  exception when sqlstate '23514' then null;
  end;
  begin
    update public.connection_limits set call_window_count = -1;
    raise exception 'Negative call count was accepted';
  exception when sqlstate '23514' then null;
  end;
  begin
    update public.oauth_clients set code_challenge_s256 = false;
    raise exception 'Client without S256 was accepted';
  exception when sqlstate '23514' then null;
  end;
  begin
    update public.oauth_pending set state_hash = 'invalid';
    raise exception 'Invalid state digest was accepted';
  exception when sqlstate '23514' then null;
  end;

  update public.connection_secrets set access_token_cipher = null;
  update public.oauth_pending set code_verifier_cipher = null;
  foreach table_name in array string_to_array(current_setting('tempo_test.connection_tables'), ',') loop
    begin
      execute format('delete from public.%I', table_name);
      raise exception 'Admin could hard-delete from %', table_name;
    exception when sqlstate '42501' then null;
    end;
    execute format('update public.%I set deleted_at = 3, updated_at = 3', table_name);
    execute format('select count(*) > 0 and bool_and(deleted_at is not distinct from 3 and updated_at = 3)
                    from public.%I', table_name) into intact;
    if not intact then raise exception 'Admin could not read and soft-delete %', table_name; end if;
  end loop;
  if exists (select from public.connection_secrets where access_token_cipher is not null)
      or exists (select from public.oauth_pending where code_verifier_cipher is not null)
      or (select count(*) from public.connections where id in (owner_connection, other_connection)) <> 2 then
    raise exception 'Scrub or soft deletion did not preserve the intended private rows';
  end if;
end;
$$;

reset role;
do $$
declare
  actor record;
  table_name text;
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
    foreach table_name in array string_to_array(current_setting('tempo_test.connection_tables'), ',') loop
      foreach statement in array array[
        'select id from public.%I',
        'insert into public.%I default values',
        'update public.%I set updated_at = 0',
        'delete from public.%I'
      ] loop
        begin
          execute format(statement, table_name);
          raise exception 'Private connection table % did not deny %: %', table_name, actor.role_name, statement;
        exception when sqlstate '42501' then null;
        end;
      end loop;
    end loop;
    begin
      perform status from public.connections;
      raise exception 'Connection status was exposed directly to %', actor.role_name;
    exception when sqlstate '42501' then null;
    end;
    reset role;
  end loop;
end;
$$;

rollback;

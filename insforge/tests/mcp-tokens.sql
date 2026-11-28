begin;

update public.account_gate set approval_status = 'approved'
where user_id in (:'owner_id', :'other_id');
select set_config('tempo_test.owner_id', :'owner_id', true);
select set_config('tempo_test.other_id', :'other_id', true);

set local role project_admin;
do $$
declare
  owner_id constant uuid := current_setting('tempo_test.owner_id')::uuid;
  other_id constant uuid := current_setting('tempo_test.other_id')::uuid;
  owner_row uuid;
  other_row uuid;
  now_ms constant bigint := 1767225600000;
begin
  if (select relrowsecurity from pg_catalog.pg_class where oid = 'public.mcp_tokens'::regclass)
      is distinct from true then
    raise exception 'RLS is not enabled for MCP tokens';
  end if;

  insert into public.mcp_tokens (user_id, name, token_hash, prefix, created_at, updated_at)
  values (owner_id, 'Owner fixture', repeat('a', 64), 'tmcp_aaa', now_ms, now_ms)
  returning id into owner_row;
  insert into public.mcp_tokens (user_id, name, token_hash, prefix, created_at, updated_at)
  values (other_id, 'Other fixture', repeat('b', 64), 'tmcp_bbb', now_ms, now_ms)
  returning id into other_row;

  begin
    insert into public.mcp_tokens (user_id, name, token_hash, prefix, created_at, updated_at)
    values ('00000000-0000-4000-8000-000000009935', 'Orphan fixture', repeat('c', 64),
      'tmcp_ccc', now_ms, now_ms);
    raise exception 'Missing token owner was accepted';
  exception when sqlstate '23503' then null;
  end;
  begin
    update public.mcp_tokens set token_hash = repeat('a', 64) where id = other_row;
    raise exception 'Duplicate digest was accepted';
  exception when sqlstate '23505' then null;
  end;
  begin
    update public.mcp_tokens set token_hash = 'invalid' where id = owner_row;
    raise exception 'Invalid digest was accepted';
  exception when sqlstate '23514' then null;
  end;
  begin
    update public.mcp_tokens set prefix = 'invalid' where id = owner_row;
    raise exception 'Invalid display prefix was accepted';
  exception when sqlstate '23514' then null;
  end;
  begin
    update public.mcp_tokens set name = '' where id = owner_row;
    raise exception 'Empty token name was accepted';
  exception when sqlstate '23514' then null;
  end;
  begin
    update public.mcp_tokens set window_start_ms = now_ms where id = owner_row;
    raise exception 'Incomplete rate window was accepted';
  exception when sqlstate '23514' then null;
  end;

  update public.mcp_tokens
  set window_start_ms = now_ms, window_count = 120, last_used_at = now_ms
  where user_id = owner_id and id = owner_row;
  if not found then raise exception 'Admin could not update the owner rate window'; end if;

  begin
    update public.mcp_tokens set window_count = 121 where id = owner_row;
    raise exception 'Rate count above the limit was accepted';
  exception when sqlstate '23514' then null;
  end;
  begin
    delete from public.mcp_tokens where id = owner_row;
    raise exception 'Admin could hard-delete a token';
  exception when sqlstate '42501' then null;
  end;

  update public.mcp_tokens
  set revoked_at = now_ms + 1, deleted_at = now_ms + 1, updated_at = now_ms + 1
  where user_id = owner_id and id = owner_row;
  if not found or not exists (
    select from public.mcp_tokens where id = owner_row and revoked_at = now_ms + 1
      and deleted_at = now_ms + 1 and last_used_at = now_ms
      and window_start_ms = now_ms and window_count = 120
  ) or not exists (
    select from public.mcp_tokens where id = other_row and deleted_at is null
      and revoked_at is null and window_count is null
  ) then
    raise exception 'Admin could not read and soft-delete exactly the intended row';
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
      'select id from public.mcp_tokens',
      'insert into public.mcp_tokens default values',
      'update public.mcp_tokens set revoked_at = 0',
      'delete from public.mcp_tokens'
    ] loop
      begin
        execute statement;
        raise exception 'Private token table did not deny %: %', actor.role_name, statement;
      exception when sqlstate '42501' then null;
      end;
    end loop;
    reset role;
  end loop;
end;
$$;

rollback;

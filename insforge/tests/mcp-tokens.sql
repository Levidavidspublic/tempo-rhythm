-- Run only in an isolated test database after #1857 and this migration. It needs two
-- pre-provisioned fixture accounts and a session allowed to assume all three roles.
begin;

set local role project_admin;
do $$
declare
  owner_id uuid;
  other_id uuid;
  owner_token_id uuid;
  other_token_id uuid;
  owner_digest constant text := repeat('a', 64);
  other_digest constant text := repeat('b', 64);
  now_ms constant bigint := 1767225600000;
begin
  select user_id into strict owner_id from public.account_gate
  where email = 'q90-owner@example.test' and deleted_at is null and is_active;
  select user_id into strict other_id from public.account_gate
  where email = 'q90-other@example.test' and deleted_at is null and is_active;
  perform pg_catalog.set_config('q90.owner_id', owner_id::text, true);
  perform pg_catalog.set_config('q90.other_id', other_id::text, true);

  insert into public.mcp_tokens (user_id, name, token_hash, prefix, created_at, updated_at)
  values (owner_id, 'Owner fixture', owner_digest, 'tmcp_aaa', now_ms, now_ms);
  insert into public.mcp_tokens (user_id, name, token_hash, prefix, created_at, updated_at)
  values (other_id, 'Other fixture', other_digest, 'tmcp_bbb', now_ms, now_ms)
  returning id into other_token_id;

  select id into strict owner_token_id from public.mcp_tokens
  where user_id = owner_id and token_hash = owner_digest and revoked_at is null;

  begin
    update public.mcp_tokens set token_hash = owner_digest where id = other_token_id;
    raise exception 'Q90: duplicate digest was accepted';
  exception when unique_violation then null;
  end;

  begin
    update public.mcp_tokens set token_hash = 'not-a-digest' where id = owner_token_id;
    raise exception 'Q90: non-digest value was accepted';
  exception when check_violation then null;
  end;

  begin
    update public.mcp_tokens set window_start_ms = now_ms where id = owner_token_id;
    raise exception 'Q90: incomplete rate window was accepted';
  exception when check_violation then null;
  end;

  update public.mcp_tokens
  set window_start_ms = now_ms, window_count = 120, last_used_at = now_ms
  where user_id = owner_id and id = owner_token_id;

  begin
    update public.mcp_tokens set window_count = 121 where id = owner_token_id;
    raise exception 'Q90: count over the rate limit was accepted';
  exception when check_violation then null;
  end;

  update public.mcp_tokens set revoked_at = now_ms + 1, updated_at = now_ms + 1
  where user_id = owner_id and id = owner_token_id;

  if not exists (
    select 1 from public.mcp_tokens
    where id = owner_token_id and revoked_at = now_ms + 1
      and last_used_at = now_ms and window_start_ms = now_ms and window_count = 120
  ) or not exists (
    select 1 from public.mcp_tokens
    where id = other_token_id and revoked_at is null and window_count is null
  ) then
    raise exception 'Q90: owner-scoped service updates did not preserve both token rows';
  end if;
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
    pg_catalog.current_setting('q90.owner_id')::uuid,
    pg_catalog.current_setting('q90.other_id')::uuid
  ] loop
    perform pg_catalog.set_config(
      'request.jwt.claims',
      pg_catalog.jsonb_build_object('sub', actor_id, 'role', 'authenticated')::text,
      true
    );
    if auth.uid() is distinct from actor_id then
      raise exception 'Q90: authenticated fixture identity did not resolve';
    end if;

    foreach statement in array array[
      'select token_hash from public.mcp_tokens',
      'insert into public.mcp_tokens default values',
      'update public.mcp_tokens set revoked_at = 0',
      'delete from public.mcp_tokens'
    ] loop
      begin
        execute statement;
        raise exception 'Q90: authenticated access was not denied: %', statement;
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
    perform id from public.mcp_tokens;
    raise exception 'Q90: anonymous read was not denied';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

rollback;

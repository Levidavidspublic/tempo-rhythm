-- Run with psql on a disposable InsForge database after #1857 and the memories migration.
-- Supply -v owner_id=<uuid> -v other_id=<uuid> for two distinct, active fixture users.
-- The runner must be able to switch to project_admin, authenticated, and anon.
\set ON_ERROR_STOP on
begin;

select pg_catalog.set_config('test.memory_owner', :'owner_id', true),
       pg_catalog.set_config('test.memory_other', :'other_id', true),
       pg_catalog.set_config('test.memory_owner_row', pg_catalog.gen_random_uuid()::text, true),
       pg_catalog.set_config('test.memory_other_row', pg_catalog.gen_random_uuid()::text, true);

set local role project_admin;
select pg_catalog.set_config('request.jwt.claims', '{"role":"project_admin"}', true);

do $$
begin
  if pg_catalog.current_setting('test.memory_owner')::uuid =
    pg_catalog.current_setting('test.memory_other')::uuid then
    raise exception 'Two distinct fixture users are required';
  end if;

  insert into public.memories (
    id, user_id, content, sector, salience, decay_rate, last_accessed, access_count, created_at, updated_at
  ) values (
    pg_catalog.current_setting('test.memory_other_row')::uuid,
    pg_catalog.current_setting('test.memory_other')::uuid,
    'Service-created fixture', 'general', 0.5, 0.01, 1000, 0, 1000, 1000
  );
end;
$$;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object(
  'role', 'authenticated', 'sub', pg_catalog.current_setting('test.memory_owner')
)::text, true);

do $$
declare
  owner_row uuid := pg_catalog.current_setting('test.memory_owner_row')::uuid;
  other_row uuid := pg_catalog.current_setting('test.memory_other_row')::uuid;
  other_id uuid := pg_catalog.current_setting('test.memory_other')::uuid;
begin
  insert into public.memories (
    id, user_id, content, sector, salience, decay_rate, last_accessed, access_count,
    source, imported_at, created_at, updated_at
  ) values (owner_row, auth.uid(), 'Reviewed memory', 'semantic', 0.5, 0.01, 1000, 0,
    'claude', 1000, 1000, 1000);

  if not exists (
    select 1 from public.memories where id = owner_row and source = 'claude'
      and imported_at = 1000 and visibility = 'private'
  ) then
    raise exception 'Owner cannot read their own private memory and provenance';
  end if;

  if exists (select 1 from public.memories where id = other_row) then
    raise exception 'Owner can read another account memory';
  end if;

  update public.memories set salience = 0.9 where id = other_row;
  if found then
    raise exception 'Owner can update another account memory';
  end if;

  begin
    insert into public.memories (
      user_id, content, sector, salience, decay_rate, last_accessed, access_count, created_at, updated_at
    ) values (other_id, 'Wrong owner', 'general', 0.5, 0.01, 1000, 0, 1000, 1000);
    raise exception 'Owner can insert another account memory';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.memories set user_id = other_id where id = owner_row;
    raise exception 'Owner can transfer a memory to another account';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.memories set visibility = 'public' where id = owner_row;
    raise exception 'Owner can make a memory public';
  exception when check_violation then
    null;
  end;

  begin
    update public.memories set source = 'unrecognized' where id = owner_row;
    raise exception 'Owner can store an invalid source';
  exception when check_violation then
    null;
  end;

  begin
    delete from public.memories where id = owner_row;
    raise exception 'Owner can hard-delete a memory';
  exception when insufficient_privilege then
    null;
  end;

  update public.memories set deleted_at = 2000, updated_at = 2000 where id = owner_row;
  if not found then
    raise exception 'Owner cannot soft-delete a memory';
  end if;

  update public.memories set deleted_at = null, updated_at = 2001
    where id = owner_row and deleted_at = 2000;
  if not found then
    raise exception 'Owner cannot restore a soft-deleted memory';
  end if;
end;
$$;

set local role anon;
select pg_catalog.set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  begin
    perform 1 from public.memories;
    raise exception 'Anonymous client can select from memories';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

set local role project_admin;
select pg_catalog.set_config('request.jwt.claims', '{"role":"project_admin"}', true);

do $$
begin
  if (select pg_catalog.count(*) from public.memories where id in (
    pg_catalog.current_setting('test.memory_owner_row')::uuid,
    pg_catalog.current_setting('test.memory_other_row')::uuid
  )) <> 2 then
    raise exception 'Service cannot read both fixture memories';
  end if;

  update public.account_gate set is_active = false
    where user_id = pg_catalog.current_setting('test.memory_owner')::uuid;
  if not found then
    raise exception 'Fixture owner is missing an account gate row';
  end if;
end;
$$;

set local role authenticated;
select pg_catalog.set_config('request.jwt.claims', pg_catalog.jsonb_build_object(
  'role', 'authenticated', 'sub', pg_catalog.current_setting('test.memory_owner')
)::text, true);

do $$
begin
  if exists (select 1 from public.memories where user_id = auth.uid()) then
    raise exception 'Inactive account can read memories';
  end if;
end;
$$;

rollback;

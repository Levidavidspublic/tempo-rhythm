create schema tempo_ledger_private;

create function tempo_ledger_private.page_operation_delta_is_valid(delta jsonb)
returns boolean
language plpgsql
immutable strict
set search_path = ''
as $$
declare
  entry jsonb;
  splice_start numeric;
  removed_length numeric;
  inserted_length numeric;
  previous_end numeric := -1;
  total_length numeric := 0;
begin
  if pg_catalog.jsonb_typeof(delta) <> 'array' then return false; end if;
  if pg_catalog.jsonb_array_length(delta) > 64 then return false; end if;

  for entry in select value from pg_catalog.jsonb_array_elements(delta) loop
    if pg_catalog.jsonb_typeof(entry) <> 'object' then return false; end if;
    if pg_catalog.jsonb_typeof(entry->'startUtf16') is distinct from 'number'
      or pg_catalog.jsonb_typeof(entry->'removedLengthUtf16') is distinct from 'number'
      or pg_catalog.jsonb_typeof(entry->'insertedLengthUtf16') is distinct from 'number'
      or entry - array['startUtf16', 'removedLengthUtf16', 'insertedLengthUtf16'] <> '{}'::jsonb
    then return false; end if;

    splice_start := (entry->>'startUtf16')::numeric;
    removed_length := (entry->>'removedLengthUtf16')::numeric;
    inserted_length := (entry->>'insertedLengthUtf16')::numeric;
    if splice_start <> pg_catalog.trunc(splice_start)
      or removed_length <> pg_catalog.trunc(removed_length)
      or inserted_length <> pg_catalog.trunc(inserted_length)
      or splice_start <= previous_end or splice_start > 1048576
      or removed_length < 0 or removed_length > 262144
      or inserted_length < 0 or inserted_length > 262144
      or splice_start + removed_length > 1048576
      or removed_length + inserted_length = 0
    then return false; end if;

    previous_end := splice_start + removed_length;
    total_length := total_length + removed_length + inserted_length;
    if total_length > 262144 then return false; end if;
  end loop;
  return true;
end;
$$;

create function tempo_ledger_private.page_operation_payload_is_valid(payload jsonb)
returns boolean
language plpgsql
immutable strict
set search_path = ''
as $$
declare
  splice jsonb;
  splice_start numeric;
  expires numeric;
  fragment_bytes integer := 0;
begin
  if pg_catalog.jsonb_typeof(payload) <> 'object' then return false; end if;
  if payload->>'state' = 'expired' then
    if pg_catalog.jsonb_typeof(payload->'expiredAtMs') is distinct from 'number'
      or payload - array['state', 'expiredAtMs'] <> '{}'::jsonb
    then return false; end if;
    expires := (payload->>'expiredAtMs')::numeric;
    return expires = pg_catalog.trunc(expires) and expires between 0 and 9007199254740991;
  end if;
  if (payload->>'state') is distinct from 'available'
    or pg_catalog.jsonb_typeof(payload->'splices') is distinct from 'array'
    or payload - array['state', 'splices'] <> '{}'::jsonb
  then return false; end if;
  if pg_catalog.jsonb_array_length(payload->'splices') not between 1 and 64 then
    return false;
  end if;

  for splice in select value from pg_catalog.jsonb_array_elements(payload->'splices') loop
    if pg_catalog.jsonb_typeof(splice) <> 'object' then return false; end if;
    if pg_catalog.jsonb_typeof(splice->'startUtf16') is distinct from 'number'
      or pg_catalog.jsonb_typeof(splice->'removedText') is distinct from 'string'
      or pg_catalog.jsonb_typeof(splice->'insertedText') is distinct from 'string'
      or splice - array['startUtf16', 'removedText', 'insertedText'] <> '{}'::jsonb
      or (splice->>'removedText') collate "C" = (splice->>'insertedText') collate "C"
    then return false; end if;

    splice_start := (splice->>'startUtf16')::numeric;
    if splice_start <> pg_catalog.trunc(splice_start)
      or splice_start not between 0 and 1048576
    then return false; end if;
    fragment_bytes := fragment_bytes
      + pg_catalog.octet_length(splice->>'removedText')
      + pg_catalog.octet_length(splice->>'insertedText');
    if fragment_bytes > 262144 then return false; end if;
  end loop;
  return true;
end;
$$;

revoke execute on function tempo_ledger_private.page_operation_delta_is_valid(jsonb) from public, anon, authenticated;
revoke execute on function tempo_ledger_private.page_operation_payload_is_valid(jsonb) from public, anon, authenticated;

grant usage on schema tempo_ledger_private to authenticated;
grant execute on function tempo_ledger_private.page_operation_delta_is_valid(jsonb) to authenticated;

create table public.page_operations (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null,
  request_id text not null check (request_id collate "C" ~ '^req_[0-7][0-9A-HJKMNP-TV-Z]{25}$'),
  request_digest text not null check (request_digest collate "C" ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('save', 'patch_block', 'add_task', 'undo')),
  source text not null check (source in ('ui', 'coach', 'mcp', 'legacy')),
  result text not null constraint page_operations_result_value_check check (result in ('applied', 'noop')),
  affects_body boolean not null,
  base_revision bigint not null check (base_revision between 0 and 9007199254740990),
  result_revision bigint not null check (result_revision between 0 and 9007199254740990),
  base_body_digest text not null check (base_body_digest collate "C" ~ '^[0-9a-f]{64}$'),
  result_body_digest text not null check (result_body_digest collate "C" ~ '^[0-9a-f]{64}$'),
  delta jsonb not null check (tempo_ledger_private.page_operation_delta_is_valid(delta)),
  applied_at_ms bigint not null check (applied_at_ms between 0 and 9007199254740991),
  undo_until_ms bigint check (undo_until_ms between 0 and 9007199254740991),
  undone_at_ms bigint,
  undone_by_operation_id uuid,
  undo_of_operation_id uuid,
  proposal_id uuid,
  metadata_expires_at_ms bigint not null check (
    metadata_expires_at_ms between 0 and 9007199254740991
    and metadata_expires_at_ms = applied_at_ms + 172800000
  ),
  created_at bigint not null check (created_at between 0 and 9007199254740991),
  updated_at bigint not null check (updated_at between created_at and 9007199254740991),
  deleted_at bigint check (deleted_at between 0 and 9007199254740991),
  legacy_convex_id text unique,
  unique (user_id, request_id),
  unique (user_id, id, note_id),
  unique (user_id, id, note_id, undo_until_ms),
  foreign key (user_id, note_id) references public.notes (user_id, id),
  foreign key (user_id, undone_by_operation_id, note_id)
    references public.page_operations (user_id, id, note_id) deferrable initially deferred,
  foreign key (user_id, undo_of_operation_id, note_id)
    references public.page_operations (user_id, id, note_id) deferrable initially deferred,
  constraint page_operations_result_check check (
    case when result = 'noop' then
      not affects_body and result_revision = base_revision and result_body_digest = base_body_digest
      and delta = '[]'::jsonb and kind <> 'undo' and proposal_id is null
    else
      affects_body and result_revision = base_revision + 1 and result_body_digest <> base_body_digest
      and delta <> '[]'::jsonb and (proposal_id is null or kind = 'add_task')
    end
  ),
  constraint page_operations_undo_check check (
    (kind = 'undo') = (undo_of_operation_id is not null)
    and undo_of_operation_id is distinct from id and undone_by_operation_id is distinct from id
    and (undone_at_ms is null) = (undone_by_operation_id is null)
    and case when result = 'applied' and kind <> 'undo' then
      undo_until_ms is not null and undo_until_ms = applied_at_ms + 300000
      and (undone_at_ms is null or (undone_at_ms >= applied_at_ms and undone_at_ms < undo_until_ms))
    else
      undo_until_ms is null and undone_at_ms is null
    end
  )
);

create index page_operations_user_deleted_idx on public.page_operations (user_id, deleted_at);
create index page_operations_revision_idx
  on public.page_operations (user_id, note_id, affects_body, result_revision);
create index page_operations_metadata_expiry_idx
  on public.page_operations (metadata_expires_at_ms, id);

alter table public.page_operations enable row level security;
revoke all on table public.page_operations from public, anon, authenticated;
grant select, insert, update on table public.page_operations to authenticated;

create policy page_operations_select_own on public.page_operations
  for select to authenticated
  using (
    user_id = (select auth.uid()) and public.account_is_active()
    and deleted_at is null
    and exists (
      select 1 from public.notes
      where notes.user_id = page_operations.user_id and notes.id = page_operations.note_id
        and notes.deleted_at is null
    )
  );

create policy page_operations_insert_own on public.page_operations
  for insert to authenticated
  with check (
    user_id = (select auth.uid()) and public.account_is_active()
    and deleted_at is null
    and exists (
      select 1 from public.notes
      where notes.user_id = page_operations.user_id and notes.id = page_operations.note_id
        and notes.deleted_at is null
    )
  );

create policy page_operations_update_own on public.page_operations
  for update to authenticated
  using (
    user_id = (select auth.uid()) and public.account_is_active()
    and deleted_at is null
    and exists (
      select 1 from public.notes
      where notes.user_id = page_operations.user_id and notes.id = page_operations.note_id
        and notes.deleted_at is null
    )
  )
  with check (
    user_id = (select auth.uid()) and public.account_is_active()
    and deleted_at is null
    and exists (
      select 1 from public.notes
      where notes.user_id = page_operations.user_id and notes.id = page_operations.note_id
        and notes.deleted_at is null
    )
  );

create table public.page_operation_payloads (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null,
  operation_id uuid not null,
  undo_until_ms bigint not null,
  cleanup_due_at_ms bigint not null check (
    cleanup_due_at_ms between 0 and 9007199254740991
    and cleanup_due_at_ms = undo_until_ms + 300000
  ),
  payload jsonb not null check (tempo_ledger_private.page_operation_payload_is_valid(payload)),
  created_at bigint not null check (created_at between 0 and 9007199254740991),
  updated_at bigint not null check (updated_at between created_at and 9007199254740991),
  deleted_at bigint check (deleted_at between 0 and 9007199254740991),
  legacy_convex_id text unique,
  unique (user_id, operation_id),
  foreign key (user_id, operation_id, note_id, undo_until_ms)
    references public.page_operations (user_id, id, note_id, undo_until_ms)
);

create index page_operation_payloads_user_deleted_idx
  on public.page_operation_payloads (user_id, deleted_at);
create index page_operation_payloads_note_deleted_idx
  on public.page_operation_payloads (user_id, note_id, deleted_at);
create index page_operation_payloads_cleanup_due_idx
  on public.page_operation_payloads (cleanup_due_at_ms, id);

alter table public.page_operation_payloads enable row level security;
revoke all on table public.page_operation_payloads from public, anon, authenticated;

do $$
begin
  if exists (select from pg_catalog.pg_roles where rolname = 'project_admin') then
    grant usage on schema tempo_ledger_private to project_admin;
    grant execute on function tempo_ledger_private.page_operation_delta_is_valid(jsonb) to project_admin;
    grant execute on function tempo_ledger_private.page_operation_payload_is_valid(jsonb) to project_admin;
    grant select, insert, update on public.page_operations, public.page_operation_payloads to project_admin;
  end if;
end;
$$;

insert into realtime.channels (pattern, description, enabled)
values ('page_operations:%', 'Per-owner page receipt changes (id only)', true)
on conflict (pattern) do update
set description = excluded.description, enabled = excluded.enabled;

create trigger page_operations_publish_owner_change
  after insert or update on public.page_operations
  for each row execute function public.publish_owner_change();

create table public.page_proposals (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind = 'add_task_to_today'),
  schema_version smallint not null check (schema_version = 1),
  note_id uuid not null,
  local_date date not null,
  conversation_id uuid not null,
  source_request_key text not null check (source_request_key collate "C" ~ '^[A-Za-z0-9_-]{1,128}$'),
  source_agent_prompt_id text check (pg_catalog.char_length(source_agent_prompt_id) between 1 and 256),
  proposal_revision bigint not null check (proposal_revision between 0 and 9007199254740990),
  expected_page_revision bigint not null check (expected_page_revision between 0 and 9007199254740990),
  block_id text not null check (block_id collate "C" ~ '^blk_[0-7][0-9A-HJKMNP-TV-Z]{25}$'),
  status text not null check (status in ('pending', 'confirmed', 'rejected', 'cancelled', 'expired')),
  proposal_expires_at_ms bigint not null check (proposal_expires_at_ms between 0 and 9007199254740991),
  cleanup_due_at_ms bigint not null check (
    cleanup_due_at_ms <= 9007199254740991
    and cleanup_due_at_ms between proposal_expires_at_ms and proposal_expires_at_ms::numeric + 300000
  ),
  metadata_expires_at_ms bigint not null check (
    metadata_expires_at_ms <= 9007199254740991
    and metadata_expires_at_ms >= created_at::numeric + 172800000
  ),
  payload jsonb not null,
  decided_at_ms bigint check (decided_at_ms between created_at and 9007199254740991),
  confirmed_operation_id uuid,
  confirm_digest text check (confirm_digest collate "C" ~ '^[0-9a-f]{64}$'),
  created_at bigint not null check (created_at between 0 and 9007199254740991),
  updated_at bigint not null check (updated_at between created_at and 9007199254740991),
  deleted_at bigint check (deleted_at between 0 and 9007199254740991),
  legacy_convex_id text unique,
  constraint page_proposals_owner_note_fk
    foreign key (user_id, note_id) references public.notes (user_id, id),
  constraint page_proposals_owner_conversation_fk
    foreign key (user_id, conversation_id) references public.conversations (user_id, id),
  constraint page_proposals_owner_operation_fk
    foreign key (user_id, confirmed_operation_id, note_id) references public.page_operations (user_id, id, note_id),
  constraint page_proposals_decision_check check (
    case status
      when 'pending' then decided_at_ms is null and confirmed_operation_id is null
        and confirm_digest is null and proposal_expires_at_ms = created_at::numeric + 86400000
      when 'confirmed' then decided_at_ms is not null and confirmed_operation_id is not null and confirm_digest is not null
      when 'expired' then confirmed_operation_id is null and confirm_digest is null
      else decided_at_ms is not null and confirmed_operation_id is null and confirm_digest is null
        and proposal_expires_at_ms = decided_at_ms
    end
  ),
  constraint page_proposals_payload_check check (
    case
      when pg_catalog.jsonb_typeof(payload) <> 'object' then false
      when payload->>'state' = 'available' then
        case when pg_catalog.jsonb_typeof(payload->'task') = 'object'
          and pg_catalog.jsonb_typeof(payload #> '{task,title}') = 'string'
          and pg_catalog.jsonb_typeof(payload #> '{task,durationMin}') = 'number'
        then payload - array['state', 'task'] = '{}'::jsonb
          and (payload->'task') - array['title', 'durationMin'] = '{}'::jsonb
          and pg_catalog.char_length(payload #>> '{task,title}') <= 500
          and (payload #>> '{task,title}') ~ '[^[:space:]]'
          and (payload #>> '{task,durationMin}')::numeric between 1 and 1440
          and (payload #>> '{task,durationMin}')::numeric = pg_catalog.trunc((payload #>> '{task,durationMin}')::numeric)
        else false end
      when payload->>'state' = 'expired' then
        case when pg_catalog.jsonb_typeof(payload->'expiredAtMs') = 'number'
        then payload - array['state', 'expiredAtMs'] = '{}'::jsonb
          and (payload->>'expiredAtMs')::numeric between 0 and 9007199254740991
          and (payload->>'expiredAtMs')::numeric = pg_catalog.trunc((payload->>'expiredAtMs')::numeric)
        else false end
      else false
    end
  )
);

create index page_proposals_owner_note_deleted_idx on public.page_proposals (user_id, note_id, deleted_at);
create index page_proposals_source_request_idx on public.page_proposals (user_id, conversation_id, source_request_key);
create index page_proposals_cleanup_due_idx on public.page_proposals (cleanup_due_at_ms);
create index page_proposals_metadata_expiry_idx on public.page_proposals (metadata_expires_at_ms);

alter table public.page_proposals enable row level security;
revoke all on public.page_proposals from public, anon, authenticated, project_admin;
grant select, insert, update on public.page_proposals to project_admin;

create table public.nags (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null check (pg_catalog.char_length(label) <= 60 and label ~ '[^[:space:]]'),
  enabled boolean not null default false,
  phrases jsonb not null default '[]'::jsonb,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique,
  constraint nags_phrase_shape_check check (
    pg_catalog.jsonb_typeof(phrases) = 'array'
    and not pg_catalog.jsonb_path_exists(phrases, '$[*] ? (
      @.type() != "object" || !exists(@.id) || @.id.type() != "string" ||
      !exists(@.text) || @.text.type() != "string" ||
      !exists(@.source) || @.source.type() != "string" || (@.source != "user" && @.source != "derived") ||
      !exists(@.status) || @.status.type() != "string" ||
      (@.status != "proposed" && @.status != "accepted" && @.status != "rejected")
    )')
  ),
  constraint nags_enabled_phrase_check check (
    not enabled or (deleted_at is null and phrases @? '$[*] ? (@.status == "accepted")')
  )
);

create index nags_owner_deleted_created_idx on public.nags (user_id, deleted_at, created_at desc);

alter table public.nags enable row level security;
revoke all on public.nags from public, anon, authenticated, project_admin;
grant select, insert, update on public.nags to authenticated, project_admin;

create policy nags_select_own on public.nags
  for select to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active());
create policy nags_insert_own on public.nags
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.account_is_active());
create policy nags_update_own on public.nags
  for update to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active())
  with check (user_id = (select auth.uid()) and public.account_is_active());

insert into realtime.channels (pattern, description, enabled)
values ('nags:%', 'Per-owner nag changes', true)
on conflict (pattern) do update
set description = excluded.description, enabled = excluded.enabled;

create trigger nags_publish_owner_change
  after insert or update on public.nags
  for each row execute function public.publish_owner_change();

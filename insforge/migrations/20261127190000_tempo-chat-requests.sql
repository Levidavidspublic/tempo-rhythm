create table public.chat_requests (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null,
  request_key text not null check (request_key collate "C" ~ '^[A-Za-z0-9_-]{1,128}$'),
  payload_digest text not null check (payload_digest collate "C" ~ '^[0-9a-f]{64}$'),
  sequence bigint not null check (sequence between 0 and 9007199254740991),
  status text not null check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  agent_prompt_message_id text not null check (agent_prompt_message_id ~ '[^[:space:]]'),
  generation_epoch bigint not null check (generation_epoch between 0 and 9007199254740991),
  created_at bigint not null check (created_at between 0 and 9007199254740991),
  updated_at bigint not null check (updated_at between created_at and 9007199254740991),
  agent_result_message_id text,
  generation_lease_expires_at_ms bigint check (generation_lease_expires_at_ms between 0 and 9007199254740991),
  deleted_at bigint check (deleted_at between 0 and 9007199254740991),
  legacy_convex_id text unique,
  unique (user_id, conversation_id, request_key),
  foreign key (user_id, conversation_id) references public.conversations (user_id, id)
);

create index chat_requests_owner_deleted_idx on public.chat_requests (user_id, deleted_at);
create index chat_requests_owner_thread_sequence_idx
  on public.chat_requests (user_id, conversation_id, deleted_at, sequence);
create index chat_requests_owner_thread_status_sequence_idx
  on public.chat_requests (user_id, conversation_id, deleted_at, status, sequence);

alter table public.chat_requests enable row level security;
revoke all on public.chat_requests from public, anon, authenticated;
revoke delete, truncate on public.chat_requests from project_admin;
grant select, insert, update on public.chat_requests to project_admin;

create table public.coach_proposals (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  task_ids uuid[] not null,
  task_1_id uuid generated always as (task_ids[1]) stored,
  task_2_id uuid generated always as (task_ids[2]) stored,
  task_3_id uuid generated always as (task_ids[3]) stored,
  task_4_id uuid generated always as (task_ids[4]) stored,
  ten_second_action text not null check (ten_second_action ~ '[^[:space:]]'),
  realism jsonb not null,
  created_at bigint not null,
  updated_at bigint not null,
  decided_at bigint,
  deleted_at bigint,
  legacy_convex_id text unique,
  constraint coach_proposals_task_ids_check check (
    case when pg_catalog.array_ndims(task_ids) = 1 and pg_catalog.array_lower(task_ids, 1) = 1 then
      pg_catalog.cardinality(task_ids) between 1 and 4
      and pg_catalog.array_position(task_ids, null) is null
      and pg_catalog.array_position(task_ids, task_ids[2]) is not distinct from
        case when pg_catalog.cardinality(task_ids) >= 2 then 2 end
      and pg_catalog.array_position(task_ids, task_ids[3]) is not distinct from
        case when pg_catalog.cardinality(task_ids) >= 3 then 3 end
      and pg_catalog.array_position(task_ids, task_ids[4]) is not distinct from
        case when pg_catalog.cardinality(task_ids) >= 4 then 4 end
    else false end
  ),
  constraint coach_proposals_realism_check check (
    case when pg_catalog.jsonb_typeof(realism) = 'object'
        and pg_catalog.jsonb_typeof(realism->'ok') = 'boolean'
        and pg_catalog.jsonb_typeof(realism->'totalMinutes') = 'number'
        and pg_catalog.jsonb_typeof(realism->'availableMinutes') = 'number'
        and pg_catalog.jsonb_typeof(realism->'note') = 'string'
      then realism - array['ok', 'totalMinutes', 'availableMinutes', 'note'] = '{}'::jsonb
        and (realism->>'totalMinutes')::numeric >= 0 and (realism->>'availableMinutes')::numeric >= 0
      else false
    end
  ),
  constraint coach_proposals_decision_check check ((status = 'pending') = (decided_at is null)),
  foreign key (user_id, task_1_id) references public.tasks (user_id, id),
  foreign key (user_id, task_2_id) references public.tasks (user_id, id),
  foreign key (user_id, task_3_id) references public.tasks (user_id, id),
  foreign key (user_id, task_4_id) references public.tasks (user_id, id)
);

create unique index coach_proposals_live_pending_owner_key on public.coach_proposals (user_id)
  where deleted_at is null and status = 'pending';
create index coach_proposals_owner_deleted_status_idx on public.coach_proposals (user_id, deleted_at, status);

alter table public.coach_proposals enable row level security;
revoke all on public.coach_proposals from public, anon, authenticated;
revoke delete, truncate on public.coach_proposals from project_admin;
grant select on public.coach_proposals to authenticated;
grant insert (id, user_id, task_ids, ten_second_action, realism, created_at, updated_at)
  on public.coach_proposals to authenticated;
grant update (updated_at, deleted_at) on public.coach_proposals to authenticated;
grant select, insert, update on public.coach_proposals to project_admin;

create policy coach_proposals_select_own on public.coach_proposals
  for select to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active());
create policy coach_proposals_insert_own on public.coach_proposals
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.account_is_active());
create policy coach_proposals_update_own on public.coach_proposals
  for update to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active())
  with check (user_id = (select auth.uid()) and public.account_is_active());

insert into realtime.channels (pattern, description, enabled)
values ('coach_proposals:%', 'Per-owner coach proposal changes', true)
on conflict (pattern) do update
set description = excluded.description, enabled = excluded.enabled;

create trigger coach_proposals_publish_owner_change
  after insert or update on public.coach_proposals
  for each row execute function public.publish_owner_change();

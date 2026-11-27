create table public.conversations (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New Conversation',
  technique text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique,
  constraint conversations_user_id_id_key unique (user_id, id)
);

create index conversations_user_live_updated_idx
  on public.conversations (user_id, updated_at desc, id) where deleted_at is null;

create table public.messages (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text,
  model_used text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique,
  constraint messages_owner_conversation_fk
    foreign key (user_id, conversation_id) references public.conversations (user_id, id)
);

comment on column public.messages.content is
  'Final display text for permitted coach history only. Raw scanner input, crisis-check input, transient reply input, and provider payloads stay in memory.';

create index messages_user_conversation_created_idx
  on public.messages (user_id, conversation_id, deleted_at, created_at, id);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

revoke all on public.conversations, public.messages from public, anon, authenticated, project_admin;
grant select on public.conversations, public.messages to authenticated;
grant insert (id, user_id, title, technique, created_at, updated_at) on public.conversations to authenticated;
grant update (title, technique, updated_at, deleted_at) on public.conversations to authenticated;
grant insert (id, user_id, conversation_id, role, created_at, updated_at) on public.messages to authenticated;
grant update (updated_at, deleted_at) on public.messages to authenticated;
grant select, insert, update on public.conversations, public.messages to project_admin;

create policy conversations_select_own on public.conversations
  for select to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active());

create policy conversations_insert_own on public.conversations
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.account_is_active());

create policy conversations_update_own on public.conversations
  for update to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active())
  with check (user_id = (select auth.uid()) and public.account_is_active());

create policy messages_select_own on public.messages
  for select to authenticated
  using (
    user_id = (select auth.uid()) and public.account_is_active()
    and exists (
      select 1 from public.conversations as conversation
      where conversation.user_id = messages.user_id
        and conversation.id = messages.conversation_id
        and conversation.deleted_at is null
    )
  );

create policy messages_insert_own on public.messages
  for insert to authenticated
  with check (
    user_id = (select auth.uid()) and public.account_is_active()
    and exists (
      select 1 from public.conversations as conversation
      where conversation.user_id = messages.user_id
        and conversation.id = messages.conversation_id
        and conversation.deleted_at is null
    )
  );

create policy messages_update_own on public.messages
  for update to authenticated
  using (
    user_id = (select auth.uid()) and public.account_is_active()
    and exists (
      select 1 from public.conversations as conversation
      where conversation.user_id = messages.user_id
        and conversation.id = messages.conversation_id
        and conversation.deleted_at is null
    )
  );

insert into realtime.channels (pattern, description, enabled)
values
  ('conversations:%', 'Per-owner coach conversation changes (id only)', true),
  ('messages:%', 'Per-owner coach message changes (id only)', true)
on conflict (pattern) do update
set description = excluded.description, enabled = excluded.enabled;

create trigger conversations_publish_owner_change
  after insert or update on public.conversations
  for each row execute function public.publish_owner_change();

create trigger messages_publish_owner_change
  after insert or update on public.messages
  for each row execute function public.publish_owner_change();

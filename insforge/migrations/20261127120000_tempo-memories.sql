-- Vector indexing is deferred: the embedding dimension is UNKNOWN and pgvector is not available in the local harness.

create table public.memories (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (
    content ~ '[^[:space:]]'
    and pg_catalog.length(pg_catalog.btrim(content)) between 1 and 2000
  ),
  sector text not null check (sector in ('semantic', 'episodic', 'procedural', 'emotional', 'general')),
  salience double precision not null check (salience >= 0 and salience < 'Infinity'::double precision),
  decay_rate double precision not null check (decay_rate >= 0 and decay_rate < 'Infinity'::double precision),
  last_accessed bigint not null,
  access_count bigint not null check (access_count >= 0),
  source text check (source in ('chatgpt', 'claude', 'grok', 'other')),
  imported_at bigint,
  visibility text not null default 'private' check (visibility = 'private'),
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique
);

create index memories_user_deleted_salience_idx
  on public.memories (user_id, deleted_at, salience desc, updated_at desc);

alter table public.memories enable row level security;

revoke all on public.memories from public, anon, authenticated;
grant select on public.memories to authenticated;
grant insert (
  id, user_id, content, sector, salience, decay_rate, last_accessed, access_count,
  source, imported_at, visibility, created_at, updated_at, deleted_at
) on public.memories to authenticated;
grant update (
  content, sector, salience, decay_rate, last_accessed, access_count,
  source, imported_at, visibility, updated_at, deleted_at
) on public.memories to authenticated;

create policy memories_select_own on public.memories
  for select to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active());

create policy memories_insert_own on public.memories
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.account_is_active());

create policy memories_update_own on public.memories
  for update to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active())
  with check (user_id = (select auth.uid()) and public.account_is_active());

insert into realtime.channels (pattern, description, enabled)
values ('memories:%', 'Per-owner memory changes (id only)', true)
on conflict (pattern) do update
set description = excluded.description, enabled = excluded.enabled;

create trigger memories_publish_owner_change
  after insert or update on public.memories
  for each row execute function public.publish_owner_change();

create table public.notes (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  pinned boolean not null default false,
  period_type text not null default 'none' check (period_type in ('daily', 'weekly', 'monthly', 'none')),
  page_type text check (page_type in ('daily', 'weekly', 'project', 'plain', 'template')),
  date date,
  ai_generated boolean,
  revision bigint check (revision between 0 and 9007199254740990),
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique,
  constraint notes_user_id_id_key unique (user_id, id)
);

create index notes_user_deleted_updated_idx
  on public.notes (user_id, deleted_at, updated_at desc, id);
create index notes_live_pinned_updated_idx
  on public.notes (user_id, updated_at desc, id)
  where deleted_at is null and pinned;
create unique index notes_live_period_date_idx
  on public.notes (user_id, page_type, date)
  where deleted_at is null and page_type in ('daily', 'weekly') and date is not null;

alter table public.notes enable row level security;

create policy notes_select_own on public.notes
  for select to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active());

create policy notes_insert_own on public.notes
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.account_is_active());

create policy notes_update_own on public.notes
  for update to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active())
  with check (user_id = (select auth.uid()) and public.account_is_active());

create table public.note_blocks (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid not null,
  type text not null check (type in ('page-meta', 'task', 'template', 'broken')),
  block_id text,
  v integer,
  data jsonb,
  position integer not null check (position >= 0),
  error_code text check (error_code in (
    'body_too_large', 'too_many_blocks', 'block_too_large', 'unclosed_fence',
    'malformed_json', 'invalid_envelope', 'unsupported_type', 'unsupported_version',
    'invalid_data', 'duplicate_id', 'duplicate_page_meta', 'nesting_too_deep'
  )),
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique,
  constraint note_blocks_user_note_fkey
    foreign key (user_id, note_id) references public.notes (user_id, id),
  constraint note_blocks_envelope_check check (
    case when type = 'broken'
      then v is null and data is null and error_code is not null
      else block_id is not null and (v = 1) is true
        and data is not null and pg_catalog.jsonb_typeof(data) = 'object'
        and error_code is null
    end
  )
);

create index note_blocks_user_deleted_idx on public.note_blocks (user_id, deleted_at);
create index note_blocks_note_deleted_position_idx
  on public.note_blocks (user_id, note_id, deleted_at, position, id);
create index note_blocks_note_block_id_idx on public.note_blocks (user_id, note_id, block_id);

alter table public.note_blocks enable row level security;

create policy note_blocks_select_own on public.note_blocks
  for select to authenticated
  using (
    user_id = (select auth.uid()) and public.account_is_active()
    and exists (
      select 1 from public.notes
      where notes.user_id = note_blocks.user_id and notes.id = note_blocks.note_id
        and notes.deleted_at is null
    )
  );

create policy note_blocks_insert_own on public.note_blocks
  for insert to authenticated
  with check (
    user_id = (select auth.uid()) and public.account_is_active()
    and exists (
      select 1 from public.notes
      where notes.user_id = note_blocks.user_id and notes.id = note_blocks.note_id
        and notes.deleted_at is null
    )
  );

create policy note_blocks_update_own on public.note_blocks
  for update to authenticated
  using (
    user_id = (select auth.uid()) and public.account_is_active()
    and exists (
      select 1 from public.notes
      where notes.user_id = note_blocks.user_id and notes.id = note_blocks.note_id
        and notes.deleted_at is null
    )
  )
  with check (
    user_id = (select auth.uid()) and public.account_is_active()
    and exists (
      select 1 from public.notes
      where notes.user_id = note_blocks.user_id and notes.id = note_blocks.note_id
        and notes.deleted_at is null
    )
  );

insert into realtime.channels (pattern, description, enabled)
values
  ('notes:%', 'Per-owner note changes (id only)', true),
  ('note_blocks:%', 'Per-owner note block changes (id only)', true)
on conflict (pattern) do update
set description = excluded.description, enabled = excluded.enabled;

create policy tempo_notes_owner_subscribe on realtime.channels
  for select to authenticated
  using (
    public.account_is_active()
    and (
      (pattern = 'notes:%' and realtime.channel_name() = 'notes:' || (select auth.uid())::text)
      or (pattern = 'note_blocks:%' and realtime.channel_name() = 'note_blocks:' || (select auth.uid())::text)
    )
  );

create trigger notes_publish_owner_change
  after insert or update on public.notes
  for each row execute function public.publish_owner_change();

create trigger note_blocks_publish_owner_change
  after insert or update on public.note_blocks
  for each row execute function public.publish_owner_change();

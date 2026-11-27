create table public.templates (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (name ~ '[^[:space:]]'),
  description text,
  period_type text not null check (period_type in ('daily', 'weekly', 'monthly', 'none')),
  body text not null,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique check (legacy_convex_id not like 'starter:%')
);

create index templates_user_deleted_updated_idx
  on public.templates (user_id, deleted_at, updated_at desc, id);

alter table public.templates enable row level security;
revoke all on public.templates from public, anon, authenticated;
grant select, insert, update on public.templates to authenticated;

create policy templates_select_own on public.templates
  for select to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active());

create policy templates_insert_own on public.templates
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.account_is_active());

create policy templates_update_own on public.templates
  for update to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active())
  with check (user_id = (select auth.uid()) and public.account_is_active());

insert into realtime.channels (pattern, description, enabled)
values ('templates:%', 'Per-owner template changes', true)
on conflict (pattern) do update
set description = excluded.description, enabled = excluded.enabled;

create trigger templates_publish_owner_change
  after insert or update on public.templates
  for each row execute function public.publish_owner_change();

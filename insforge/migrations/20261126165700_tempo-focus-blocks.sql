create table public.focus_blocks (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at_ms bigint not null,
  duration_ms bigint not null check (duration_ms between 1 and 28800000),
  label text check (pg_catalog.char_length(label) between 1 and 120),
  task_id uuid references public.tasks(id),
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique
);

create index focus_blocks_user_deleted_started_idx
  on public.focus_blocks (user_id, deleted_at, started_at_ms desc);

alter table public.focus_blocks enable row level security;

revoke all on public.focus_blocks from public, anon, authenticated;
grant select, insert on public.focus_blocks to authenticated;
grant update (deleted_at) on public.focus_blocks to authenticated;

create policy focus_blocks_select_own on public.focus_blocks
  for select to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active());

create policy focus_blocks_insert_own on public.focus_blocks
  for insert to authenticated
  with check (
    user_id = (select auth.uid()) and public.account_is_active()
    and deleted_at is null
    and (
      task_id is null or exists (
        select 1 from public.tasks as task
        where task.id = focus_blocks.task_id
          and task.user_id = focus_blocks.user_id
          and task.deleted_at is null
      )
    )
  );

create policy focus_blocks_update_own on public.focus_blocks
  for update to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active())
  with check (user_id = (select auth.uid()) and public.account_is_active());

create function public.apply_focus_block_lifecycle()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  now_ms bigint := trunc(extract(epoch from statement_timestamp()) * 1000)::bigint;
begin
  if new.deleted_at is not null then
    if old.deleted_at is not null then
      raise check_violation using message = 'Focus block is already deleted';
    end if;
    new.deleted_at := now_ms;
  elsif old.deleted_at is null or old.deleted_at < now_ms - 2592000000 then
    raise check_violation using message = 'Focus block is not restorable';
  end if;

  new.updated_at := now_ms;
  return new;
end;
$$;

revoke execute on function public.apply_focus_block_lifecycle() from public, anon, authenticated;

create trigger focus_blocks_apply_lifecycle
  before update of deleted_at on public.focus_blocks
  for each row when (current_user = 'authenticated')
  execute function public.apply_focus_block_lifecycle();

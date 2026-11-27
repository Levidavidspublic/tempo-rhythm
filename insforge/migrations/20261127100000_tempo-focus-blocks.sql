create table public.focus_blocks (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at_ms bigint not null,
  duration_ms bigint not null check (duration_ms between 1 and 28800000),
  label text check (pg_catalog.char_length(label) between 1 and 120),
  task_id uuid,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique,
  constraint focus_blocks_owner_task_fk
    foreign key (user_id, task_id) references public.tasks (user_id, id)
);

create index focus_blocks_user_deleted_started_idx
  on public.focus_blocks (user_id, deleted_at, started_at_ms desc);

alter table public.focus_blocks enable row level security;

revoke all on public.focus_blocks from public, anon, authenticated;
grant select, insert on public.focus_blocks to authenticated;

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

create function public.apply_focus_block_lifecycle(p_block_id uuid, p_restore boolean)
returns public.focus_blocks
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  block public.focus_blocks;
  now_ms bigint := pg_catalog.trunc(extract(epoch from pg_catalog.statement_timestamp()) * 1000)::bigint;
begin
  if owner_id is null then
    raise insufficient_privilege using message = 'Sign-in is required';
  end if;
  if not public.account_is_active() then
    raise insufficient_privilege using message = 'An active account is required';
  end if;
  if p_restore is null then
    raise check_violation using message = 'Choose soft delete or restore';
  end if;

  select * into block from public.focus_blocks
  where id = p_block_id and user_id = owner_id
  for update;
  if not found then
    raise no_data_found using message = 'Focus block not found';
  end if;

  if p_restore then
    if block.deleted_at is null or block.deleted_at < now_ms - 2592000000 then
      raise check_violation using message = 'Focus block is not restorable';
    end if;
  elsif block.deleted_at is not null then
    raise check_violation using message = 'Focus block is already deleted';
  end if;

  update public.focus_blocks
  set deleted_at = case when p_restore then null else now_ms end, updated_at = now_ms
  where id = p_block_id and user_id = owner_id
  returning * into block;
  return block;
end;
$$;

revoke execute on function public.apply_focus_block_lifecycle(uuid, boolean) from public, anon;
grant execute on function public.apply_focus_block_lifecycle(uuid, boolean) to authenticated;

insert into realtime.channels (pattern, description, enabled)
values ('focus_blocks:%', 'Per-owner focus block changes', true)
on conflict (pattern) do update
set description = excluded.description, enabled = excluded.enabled;

create trigger focus_blocks_publish_owner_change
  after insert or update on public.focus_blocks
  for each row execute function public.publish_owner_change();

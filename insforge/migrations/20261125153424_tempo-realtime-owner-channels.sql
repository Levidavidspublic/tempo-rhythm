-- Publish only the changed row id to its owner's channel.
create or replace function public.publish_owner_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.publish(
    tg_table_name || ':' || new.user_id::text,
    tg_op,
    pg_catalog.jsonb_build_object('id', new.id)
  );
  return new;
end;
$$;

insert into realtime.channels (pattern, description, enabled)
values
  ('tasks:%', 'Per-owner task changes (id only)', true),
  ('task_repeat_cfgs:%', 'Per-owner repeat config changes (id only)', true)
on conflict (pattern) do update
set description = excluded.description, enabled = excluded.enabled;

alter table realtime.channels enable row level security;

drop policy if exists tempo_owner_subscribe on realtime.channels;
create policy tempo_owner_subscribe on realtime.channels
  for select to authenticated
  using (
    pattern in ('tasks:%', 'task_repeat_cfgs:%')
    and pg_catalog.split_part(realtime.channel_name(), ':', 1) || ':%' = pattern
    and pg_catalog.split_part(realtime.channel_name(), ':', 2) = (select auth.uid())::text
  );

drop trigger if exists tasks_publish_owner_change on public.tasks;
create trigger tasks_publish_owner_change
  after insert or update on public.tasks
  for each row execute function public.publish_owner_change();

drop trigger if exists task_repeat_cfgs_publish_owner_change on public.task_repeat_cfgs;
create trigger task_repeat_cfgs_publish_owner_change
  after insert or update on public.task_repeat_cfgs
  for each row execute function public.publish_owner_change();

revoke execute on function public.publish_owner_change() from public, anon, authenticated;

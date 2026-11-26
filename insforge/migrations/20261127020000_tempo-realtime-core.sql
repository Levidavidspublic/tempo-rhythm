-- Later domains register a <table>:% pattern and attach publish_owner_change().
-- They must not add another owner-channel policy.

create function public.publish_owner_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_id uuid;
begin
  if tg_table_name = 'profiles' then
    row_id := new.user_id;
  else
    row_id := new.id;
  end if;

  perform realtime.publish(
    tg_table_name || ':' || new.user_id::text,
    tg_op,
    pg_catalog.jsonb_build_object('table', tg_table_name, 'op', tg_op, 'id', row_id)
  );
  return new;
end;
$$;

revoke execute on function public.publish_owner_change() from public, anon, authenticated;

insert into realtime.channels (pattern, description, enabled)
values
  ('tasks:%', 'Per-owner task changes', true),
  ('task_repeat_cfgs:%', 'Per-owner repeat config changes', true),
  ('profiles:%', 'Per-owner profile changes', true)
on conflict (pattern) do update
set description = excluded.description, enabled = excluded.enabled;

alter table realtime.channels enable row level security;
-- The owner stream is server-published; clients have no message insert policy.
alter table realtime.messages enable row level security;

create policy tempo_owner_subscribe on realtime.channels
  for select to authenticated
  using (
    enabled
    and pattern ~ '^[a-z][a-z0-9_]*:%$'
    and (select realtime.channel_name()) =
      pg_catalog.split_part(pattern, ':', 1) || ':' || (select auth.uid())::text
  );

create trigger tasks_publish_owner_change
  after insert or update on public.tasks
  for each row execute function public.publish_owner_change();

create trigger task_repeat_cfgs_publish_owner_change
  after insert or update on public.task_repeat_cfgs
  for each row execute function public.publish_owner_change();

create trigger profiles_publish_owner_change
  after insert or update on public.profiles
  for each row execute function public.publish_owner_change();

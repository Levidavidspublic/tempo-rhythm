create table public.habits (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  cadence text not null check (cadence in ('daily', 'weekly')),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= current_streak),
  last_completed_at bigint,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique,
  unique (user_id, id)
);

create index habits_user_deleted_idx on public.habits (user_id, deleted_at);

alter table public.habits enable row level security;

create policy habits_select_own on public.habits
  for select to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active());

create policy habits_insert_own on public.habits
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.account_is_active());

create policy habits_update_own on public.habits
  for update to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active())
  with check (user_id = (select auth.uid()) and public.account_is_active());

create table public.habit_check_ins (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null,
  local_date date not null check (local_date between date '0001-01-01' and date '9999-12-31'),
  checked_at bigint not null,
  source text not null check (source in ('habits', 'today', 'suggestion', 'legacy')),
  note text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique,
  foreign key (user_id, habit_id) references public.habits (user_id, id)
);

create unique index habit_check_ins_live_habit_date_idx
  on public.habit_check_ins (habit_id, local_date) where deleted_at is null;
create index habit_check_ins_user_deleted_date_idx
  on public.habit_check_ins (user_id, deleted_at, local_date);
create index habit_check_ins_habit_deleted_date_idx
  on public.habit_check_ins (habit_id, deleted_at, local_date);

alter table public.habit_check_ins enable row level security;

create policy habit_check_ins_select_own on public.habit_check_ins
  for select to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active());

create policy habit_check_ins_insert_own on public.habit_check_ins
  for insert to authenticated
  with check (
    user_id = (select auth.uid()) and public.account_is_active()
    and exists (
      select 1 from public.habits
      where id = habit_check_ins.habit_id and user_id = habit_check_ins.user_id
        and deleted_at is null
    )
  );

create policy habit_check_ins_update_own on public.habit_check_ins
  for update to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active())
  with check (
    user_id = (select auth.uid()) and public.account_is_active()
    and exists (
      select 1 from public.habits
      where id = habit_check_ins.habit_id and user_id = habit_check_ins.user_id
        and deleted_at is null
    )
  );

insert into realtime.channels (pattern, description, enabled)
values
  ('habits:%', 'Per-owner habit changes', true),
  ('habit_check_ins:%', 'Per-owner habit check-in changes', true)
on conflict (pattern) do update
set description = excluded.description, enabled = excluded.enabled;

create trigger habits_publish_owner_change
  after insert or update on public.habits
  for each row execute function public.publish_owner_change();

create trigger habit_check_ins_publish_owner_change
  after insert or update on public.habit_check_ins
  for each row execute function public.publish_owner_change();

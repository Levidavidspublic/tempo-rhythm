-- Canonical Tempo identity, subscription, task, and recurrence tables with RLS.

create table public.account_gate (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  email_verified boolean,
  email_verification_time bigint,
  role text check (role in ('admin', 'user')),
  user_type text check (user_type in ('free', 'paid')),
  beta_access text check (beta_access in ('none', 'tester', 'founder')),
  entitlement_tier text check (entitlement_tier in ('none', 'basic', 'pro', 'max', 'god')),
  is_god_tier boolean,
  beta_approved_at bigint,
  is_active boolean,
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'revoked')),
  approval_updated_at bigint,
  approval_updated_by text,
  legacy_convex_id text unique,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint
);

create index account_gate_approval_status_idx on public.account_gate (approval_status);
create index account_gate_role_idx on public.account_gate (role);
create index account_gate_user_type_idx on public.account_gate (user_type);
create index account_gate_deleted_at_idx on public.account_gate (deleted_at);
create index account_gate_email_idx on public.account_gate (pg_catalog.lower(email));

alter table public.account_gate enable row level security;

create policy account_gate_select_own on public.account_gate
  for select to authenticated
  using (user_id = (select auth.uid()));

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  full_name text,
  onboarded_at bigint,
  created_at bigint not null,
  updated_at bigint not null
);

alter table public.profiles enable row level security;

create table public.subscription_states (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('none', 'trial', 'basic', 'pro', 'max')),
  billing_cycle text not null check (billing_cycle in ('none', 'monthly', 'annual', 'lifetime')),
  status text not null check (status in ('inactive', 'active', 'grace', 'cancelled')),
  trial_used boolean not null,
  source text,
  legacy_convex_id text unique,
  created_at bigint not null,
  updated_at bigint not null
);

create index subscription_states_user_id_idx on public.subscription_states (user_id);

alter table public.subscription_states enable row level security;

create function public.account_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.account_gate
    where user_id = auth.uid()
      and deleted_at is null
      and coalesce(is_active, true)
  );
$$;

revoke execute on function public.account_is_active() from public;
grant execute on function public.account_is_active() to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active());

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.account_is_active());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active())
  with check (user_id = (select auth.uid()) and public.account_is_active());

create function public.handle_new_tempo_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ms bigint := (extract(epoch from pg_catalog.now()) * 1000)::bigint;
begin
  -- New gate rows always start pending. The P05 loader restores imported approval status.
  insert into public.account_gate (
    user_id, email, email_verified, role, user_type, beta_access, entitlement_tier,
    is_active, approval_status, approval_updated_at, created_at, updated_at
  )
  values (
    new.id, new.email, false, 'user', 'paid', 'tester', 'max',
    true, 'pending', now_ms, now_ms, now_ms
  )
  on conflict do nothing;

  insert into public.profiles (user_id, name, created_at, updated_at)
  values (new.id, new.profile->>'name', now_ms, now_ms)
  on conflict do nothing;

  insert into public.subscription_states (
    user_id, plan, billing_cycle, status, trial_used, source, created_at, updated_at
  )
  values (new.id, 'max', 'lifetime', 'active', true, 'open_signup_grant', now_ms, now_ms)
  on conflict do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_tempo_user() from public;

create trigger on_auth_user_created_tempo
  after insert on auth.users
  for each row execute function public.handle_new_tempo_user();

create table public.task_repeat_cfgs (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  repeat_cycle text not null check (repeat_cycle in ('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY')),
  repeat_every integer not null,
  weekdays integer[] not null,
  monthly_week_of_month integer,
  monthly_weekday integer,
  monthly_last_day boolean,
  deleted_instance_dates text[] not null default '{}',
  skip_overdue boolean not null,
  wait_for_completion boolean not null,
  repeat_from_completion_date boolean not null,
  is_paused boolean not null,
  default_estimate bigint,
  last_task_creation_day text,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique,
  constraint task_repeat_cfgs_user_id_id_key unique (user_id, id)
);

create index task_repeat_cfgs_user_id_idx on public.task_repeat_cfgs (user_id);
create index task_repeat_cfgs_user_deleted_idx on public.task_repeat_cfgs (user_id, deleted_at);

alter table public.task_repeat_cfgs enable row level security;

create policy task_repeat_cfgs_select_own on public.task_repeat_cfgs
  for select to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active());

create policy task_repeat_cfgs_insert_own on public.task_repeat_cfgs
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.account_is_active());

create policy task_repeat_cfgs_update_own on public.task_repeat_cfgs
  for update to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active())
  with check (user_id = (select auth.uid()) and public.account_is_active());

create table public.tasks (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  status text not null check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  priority text not null check (priority in ('low', 'medium', 'high')),
  energy text check (energy in ('low', 'medium', 'high')),
  time_estimate bigint,
  flexibility text check (flexibility in ('fixed', 'elastic')),
  time_spent_on_day jsonb,
  repeat_cfg_id uuid,
  parent_task_id uuid,
  project_id text,
  project_name text,
  due_at bigint,
  completed_at bigint,
  checklist jsonb,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique,
  constraint tasks_user_id_id_key unique (user_id, id),
  constraint tasks_user_id_repeat_cfg_id_fkey
    foreign key (user_id, repeat_cfg_id) references public.task_repeat_cfgs (user_id, id) match simple,
  constraint tasks_user_id_parent_task_id_fkey
    foreign key (user_id, parent_task_id) references public.tasks (user_id, id) match simple
);

create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_user_status_idx on public.tasks (user_id, status);
create index tasks_user_due_idx on public.tasks (user_id, due_at);
create index tasks_user_project_idx on public.tasks (user_id, project_id);
create index tasks_user_deleted_idx on public.tasks (user_id, deleted_at);
create index tasks_user_deleted_completed_idx on public.tasks (user_id, deleted_at, completed_at);

alter table public.tasks enable row level security;

create policy tasks_select_own on public.tasks
  for select to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active());

create policy tasks_insert_own on public.tasks
  for insert to authenticated
  with check (user_id = (select auth.uid()) and public.account_is_active());

create policy tasks_update_own on public.tasks
  for update to authenticated
  using (user_id = (select auth.uid()) and public.account_is_active())
  with check (user_id = (select auth.uid()) and public.account_is_active());

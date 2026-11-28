create table public.whop_membership_events (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  event_id text not null unique check (event_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  membership_id text not null check (membership_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  event_type text not null check (
    event_type in ('membership.activated', 'membership.updated', 'membership.deactivated')
  ),
  status text not null check (
    status in ('trialing', 'active', 'past_due', 'completed', 'canceled', 'expired', 'unresolved')
  ),
  plan_id text,
  product_id text,
  whop_user_id text,
  cancel_at_period_end boolean not null,
  event_timestamp bigint not null,
  received_at bigint not null default (extract(epoch from pg_catalog.now()) * 1000)::bigint,
  deleted_at bigint,
  legacy_convex_id text unique
);

create index whop_membership_events_membership_time_idx
  on public.whop_membership_events (membership_id, event_timestamp desc);

alter table public.whop_membership_events enable row level security;
revoke all on table public.whop_membership_events from public, anon, authenticated;

do $$
begin
  if exists (select from pg_catalog.pg_roles where rolname = 'project_admin') then
    revoke delete, truncate on public.whop_membership_events from project_admin;
    grant select, insert, update on public.whop_membership_events to project_admin;
  end if;
end;
$$;

create table public.whop_membership_events (
  event_id text primary key check (event_id ~ '^[A-Za-z0-9_-]{1,128}$'),
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
  received_at bigint not null default (extract(epoch from pg_catalog.now()) * 1000)::bigint
);

create index whop_membership_events_membership_time_idx
  on public.whop_membership_events (membership_id, event_timestamp desc);

alter table public.whop_membership_events enable row level security;
revoke all on table public.whop_membership_events from public, anon, authenticated;

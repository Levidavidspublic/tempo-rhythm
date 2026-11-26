create table public.voice_leases (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null,
  client_key text not null check (client_key ~ '^[A-Za-z0-9_-]{8,64}$'),
  status text not null default 'active' check (status in ('active', 'ended')),
  language text not null check (language in ('en', 'he')),
  started_at bigint not null check (started_at >= 0),
  last_renewal_at bigint not null,
  expires_at bigint generated always as (
    least(last_renewal_at + 45000, started_at + 900000)
  ) stored,
  ended_at bigint,
  duration_ms bigint,
  end_reason text check (end_reason in ('stopped', 'replaced', 'expired', 'exhausted', 'revoked')),
  date_key date not null,
  utc_date_key date not null,
  grants integer not null default 0 check (grants between 0 and 3),
  sentences integer not null default 0 check (sentences >= 0),
  tts_chars integer not null default 0 check (tts_chars between 0 and 20000),
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique,
  constraint voice_leases_heartbeat_bounds check (
    last_renewal_at between started_at and started_at + 900000
    and last_renewal_at <= updated_at
  ),
  constraint voice_leases_end_state check (
    (status = 'active' and ended_at is null and duration_ms is null and end_reason is null)
    or (
      status = 'ended'
      and ended_at is not null and duration_ms is not null and end_reason is not null
      and ended_at between started_at and expires_at
      and ended_at <= updated_at
      and duration_ms = ended_at - started_at
    )
  )
);

create unique index voice_leases_one_active_per_owner
  on public.voice_leases (user_id)
  where status = 'active' and deleted_at is null;

create index voice_leases_owner_day_idx on public.voice_leases (user_id, date_key);
create index voice_leases_utc_day_idx on public.voice_leases (utc_date_key);

alter table public.voice_leases enable row level security;
revoke all on table public.voice_leases from public, anon, authenticated;

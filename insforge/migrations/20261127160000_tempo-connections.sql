create table public.oauth_clients (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  issuer text not null,
  redirect_uri text not null,
  client_id text not null,
  client_secret_cipher text,
  key_version integer not null,
  token_endpoint_auth_method text not null
    check (token_endpoint_auth_method in ('none', 'client_secret_basic', 'client_secret_post')),
  authorization_endpoint text not null,
  token_endpoint text not null,
  registration_endpoint text,
  revocation_endpoint text,
  code_challenge_s256 boolean not null check (code_challenge_s256),
  iss_parameter_supported boolean,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique
);

create unique index oauth_clients_live_issuer_redirect_idx
  on public.oauth_clients (issuer, redirect_uri) where deleted_at is null;

create table public.connections (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider = 'executor'),
  status text not null
    check (status in ('pending_confirm', 'connected', 'needs_reauth', 'unavailable', 'revoking', 'disconnected')),
  mcp_url text not null,
  issuer text not null,
  client_row_id uuid not null references public.oauth_clients(id),
  scope text,
  account_label text,
  connected_at bigint not null,
  last_used_at bigint,
  last_error_at bigint,
  confirm_nonce_hash text unique check (confirm_nonce_hash ~ '^[0-9a-f]{64}$'),
  confirm_expires_at bigint,
  start_generation bigint not null default 0 check (start_generation >= 0),
  refresh_lease_until bigint,
  refresh_lease_token text,
  revoked_at_provider boolean,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique,
  unique (user_id, id)
);

create index connections_user_provider_deleted_idx
  on public.connections (user_id, provider, deleted_at);
create index connections_status_updated_idx
  on public.connections (status, updated_at);
create unique index connections_one_usable_provider_idx
  on public.connections (user_id, provider)
  where deleted_at is null and status in ('connected', 'needs_reauth', 'unavailable');

create table public.connection_secrets (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null unique,
  access_token_cipher text,
  refresh_token_cipher text,
  access_token_expires_at bigint,
  key_version integer not null,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique,
  foreign key (user_id, connection_id) references public.connections (user_id, id) on delete cascade
);

create index connection_secrets_user_id_idx on public.connection_secrets (user_id);

create table public.connection_limits (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  connect_window_start_ms bigint,
  connect_window_count integer check (connect_window_count >= 0),
  call_window_start_ms bigint,
  call_window_count integer check (call_window_count >= 0),
  disconnect_generation bigint not null default 0 check (disconnect_generation >= 0),
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique
);

create table public.oauth_pending (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider = 'executor'),
  state_hash text not null unique check (state_hash ~ '^[0-9a-f]{64}$'),
  code_verifier_cipher text,
  key_version integer not null,
  issuer text not null,
  resource text not null,
  redirect_uri text not null,
  client_row_id uuid not null references public.oauth_clients(id),
  return_to text not null check (return_to in ('settings', 'coach')),
  expires_at bigint not null,
  used_at bigint,
  start_generation bigint not null default 0 check (start_generation >= 0),
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique
);

create index oauth_pending_user_deleted_idx on public.oauth_pending (user_id, deleted_at);
create index oauth_pending_live_expiry_idx
  on public.oauth_pending (expires_at) where deleted_at is null;

create table public.connection_calls (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null,
  kind text not null check (kind in ('tool_call', 'disconnect')),
  tool text,
  path text,
  decision text check (decision in ('auto', 'approved', 'rejected', 'blocked')),
  outcome text not null
    check (outcome in ('ok', 'error', 'approval_required', 'timeout', 'rate_limited', 'unauthorized', 'revoked', 'not_revoked')),
  input_digest text check (input_digest ~ '^[0-9a-f]{64}$'),
  result_bytes bigint check (result_bytes >= 0),
  duration_ms bigint check (duration_ms >= 0),
  message_id uuid,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique,
  foreign key (user_id, connection_id) references public.connections (user_id, id) on delete cascade
);

create index connection_calls_user_created_idx on public.connection_calls (user_id, created_at);
create index connection_calls_connection_created_idx on public.connection_calls (connection_id, created_at);

alter table public.connections enable row level security;
alter table public.connection_secrets enable row level security;
alter table public.connection_limits enable row level security;
alter table public.connection_calls enable row level security;
alter table public.oauth_clients enable row level security;
alter table public.oauth_pending enable row level security;

revoke all on public.connections, public.connection_secrets, public.connection_limits,
  public.connection_calls, public.oauth_clients, public.oauth_pending from public, anon, authenticated;

do $$
begin
  if exists (select from pg_catalog.pg_roles where rolname = 'project_admin') then
    revoke delete, truncate on public.connections, public.connection_secrets, public.connection_limits,
      public.connection_calls, public.oauth_clients, public.oauth_pending from project_admin;
    grant select, insert, update on public.connections, public.connection_secrets, public.connection_limits,
      public.connection_calls, public.oauth_clients, public.oauth_pending to project_admin;
  end if;
end;
$$;

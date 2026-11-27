create table public.mcp_tokens (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  prefix text not null check (prefix ~ '^tmcp_[A-Za-z0-9_-]{3}$'),
  last_used_at bigint,
  revoked_at bigint,
  window_start_ms bigint,
  window_count integer,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  legacy_convex_id text unique,
  constraint mcp_tokens_rate_window check (
    (window_start_ms is null and window_count is null)
    or (window_start_ms is not null and window_count is not null and window_count between 1 and 120)
  )
);

create index mcp_tokens_owner_created_idx on public.mcp_tokens (user_id, created_at desc);

alter table public.mcp_tokens enable row level security;
revoke all on table public.mcp_tokens from public, anon, authenticated;

do $$
begin
  if exists (select from pg_catalog.pg_roles where rolname = 'project_admin') then
    revoke delete, truncate on public.mcp_tokens from project_admin;
    grant select, insert, update on public.mcp_tokens to project_admin;
  end if;
end;
$$;

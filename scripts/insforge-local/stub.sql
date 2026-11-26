-- Local stand-in for InsForge objects used by Tempo's migrations.
-- Adapted from InsForge OSS migrations 013, 017, 018 and 053 and deploy/docker-init/db/db-init.sql.
-- Copyright 2025 Insforge Inc. SPDX-License-Identifier: Apache-2.0
-- Source and license: https://github.com/InsForge/InsForge (see README.md).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'project_admin') then
    create role project_admin nologin bypassrls;
  end if;
end
$$;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password text,
  email_verified boolean not null default false,
  profile jsonb default '{}'::jsonb,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid
$$;

create function auth.role() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  )
$$;

grant usage on schema auth to public;
grant select (id, profile, created_at) on auth.users to public;
grant update (profile) on auth.users to public;
grant select on auth.users to project_admin;
alter table auth.users enable row level security;
create policy auth_users_profiles_read on auth.users for select using (true);
create policy auth_users_profile_update on auth.users for update
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create schema realtime;
create table realtime.channels (
  id uuid primary key default gen_random_uuid(),
  pattern text unique not null,
  description text,
  webhook_urls text[],
  enabled boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table realtime.messages (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  channel_id uuid references realtime.channels(id) on delete set null,
  channel_name text not null,
  payload jsonb not null default '{}'::jsonb,
  sender_type text not null default 'system' check (sender_type in ('system', 'user')),
  sender_id uuid,
  created_at timestamptz default now()
);

create function realtime.channel_name() returns text language sql stable as $$
  select nullif(current_setting('realtime.channel_name', true), '')
$$;

create function realtime.publish(p_channel_name text, p_event_name text, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_channel_id uuid;
  v_message_id uuid;
begin
  select id into v_channel_id from realtime.channels
  where enabled and (pattern = p_channel_name or p_channel_name like pattern)
  order by pattern = p_channel_name desc limit 1;
  if v_channel_id is null then
    raise warning 'Realtime: no channel for %', p_channel_name;
    return null;
  end if;
  insert into realtime.messages (event_name, channel_id, channel_name, payload, sender_type)
  values (p_event_name, v_channel_id, p_channel_name, p_payload, 'system') returning id into v_message_id;
  return v_message_id;
end
$$;

revoke all on function realtime.publish(text, text, jsonb) from public;
grant usage on schema realtime to anon, authenticated;
grant select on realtime.channels to anon, authenticated;
grant insert on realtime.messages to anon, authenticated;
grant execute on function realtime.channel_name() to anon, authenticated;

grant usage on schema public to anon, authenticated, project_admin;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, project_admin;

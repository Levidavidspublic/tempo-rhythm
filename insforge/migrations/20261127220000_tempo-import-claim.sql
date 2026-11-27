create schema tempo_import;

revoke all on schema tempo_import from public, anon, authenticated;
grant usage on schema tempo_import to project_admin;

create table tempo_import.staged_users (
  email_lower text primary key check (email_lower = pg_catalog.lower(email_lower)),
  legacy_convex_id text unique not null,
  gate jsonb not null,
  profile jsonb,
  subscription jsonb,
  staged_at bigint not null,
  claimed_user_id uuid,
  claimed_at bigint
);

create table tempo_import.staged_rows (
  target_table text not null check (target_table in ('task_repeat_cfgs', 'tasks')),
  id uuid not null,
  legacy_convex_id text not null,
  owner_email_lower text not null references tempo_import.staged_users (email_lower),
  load_order int not null,
  payload jsonb not null,
  staged_at bigint not null,
  claimed_at bigint,
  primary key (target_table, id),
  unique (target_table, legacy_convex_id)
);

create index staged_rows_owner_load_idx
  on tempo_import.staged_rows (owner_email_lower, load_order, target_table, id)
  where claimed_at is null;

alter table tempo_import.staged_users enable row level security;
alter table tempo_import.staged_rows enable row level security;
revoke all on all tables in schema tempo_import from public, anon, authenticated;
grant select, insert, update on tempo_import.staged_users, tempo_import.staged_rows to project_admin;

create table tempo_import.load_state (
  id integer primary key check (id = 1),
  completed_at bigint
);

alter table tempo_import.load_state enable row level security;
revoke all on tempo_import.load_state from public, anon, authenticated;
grant select, insert, update on tempo_import.load_state to project_admin;

create function tempo_import.claim_staged(p_user_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public, tempo_import, pg_temp
as $$
declare
  staged tempo_import.staged_users;
  staged_row tempo_import.staged_rows;
  gate public.account_gate;
  profile public.profiles;
  subscription public.subscription_states;
  subscription_id uuid;
  claim_ms bigint := (extract(epoch from pg_catalog.now()) * 1000)::bigint;
  inserted bigint;
  same_row boolean;
begin
  if not exists (
    select from auth.users
    where id = p_user_id and email_verified and pg_catalog.lower(email) = pg_catalog.lower(p_email)
  ) then
    return;
  end if;

  select * into staged from tempo_import.staged_users
  where email_lower = pg_catalog.lower(p_email) and claimed_at is null
  for update;
  if not found then
    return;
  end if;

  if exists (
    select from tempo_import.load_state where id = 1 and completed_at is null
  ) then
    return;
  end if;

  gate := pg_catalog.jsonb_populate_record(null::public.account_gate, staged.gate);
  update public.account_gate set
    email = staged.email_lower,
    email_verified = gate.email_verified,
    email_verification_time = gate.email_verification_time,
    role = gate.role,
    user_type = gate.user_type,
    beta_access = gate.beta_access,
    entitlement_tier = gate.entitlement_tier,
    is_god_tier = gate.is_god_tier,
    beta_approved_at = gate.beta_approved_at,
    is_active = gate.is_active,
    approval_status = gate.approval_status,
    approval_updated_at = gate.approval_updated_at,
    approval_updated_by = gate.approval_updated_by,
    legacy_convex_id = staged.legacy_convex_id,
    created_at = gate.created_at,
    updated_at = gate.updated_at,
    deleted_at = gate.deleted_at
  where user_id = p_user_id
    and (legacy_convex_id is null or legacy_convex_id = staged.legacy_convex_id)
    and (
      (
        updated_at = created_at
        and approval_status = 'pending'
        and approval_updated_at = created_at
        and approval_updated_by is null
      )
      or gate.updated_at >= updated_at
    );
  get diagnostics inserted = row_count;
  if inserted = 0 and not exists (
    select from public.account_gate
    where user_id = p_user_id
      and (legacy_convex_id is null or legacy_convex_id = staged.legacy_convex_id)
  ) then
    raise exception 'Import claim requires an unbound Tempo account';
  end if;

  if staged.profile is not null then
    profile := pg_catalog.jsonb_populate_record(null::public.profiles, staged.profile);
    update public.profiles set
      name = profile.name,
      full_name = profile.full_name,
      onboarded_at = profile.onboarded_at,
      created_at = profile.created_at,
      updated_at = profile.updated_at
    where user_id = p_user_id
      and (updated_at = created_at or profile.updated_at >= updated_at);
  end if;

  if staged.subscription is not null then
    subscription := pg_catalog.jsonb_populate_record(null::public.subscription_states, staged.subscription);
    select id into strict subscription_id from public.subscription_states
    where user_id = p_user_id
      and (legacy_convex_id is null or legacy_convex_id = subscription.legacy_convex_id)
    for update;
    update public.subscription_states set
      plan = subscription.plan,
      billing_cycle = subscription.billing_cycle,
      status = subscription.status,
      trial_used = subscription.trial_used,
      source = subscription.source,
      legacy_convex_id = subscription.legacy_convex_id,
      created_at = subscription.created_at,
      updated_at = subscription.updated_at
    where id = subscription_id
      and (
        (source = 'open_signup_grant' and updated_at = created_at)
        or subscription.updated_at >= updated_at
      );
  else
    update public.subscription_states set
      plan = 'none', billing_cycle = 'none', status = 'inactive', trial_used = false, source = null
    where user_id = p_user_id and legacy_convex_id is null
      and updated_at = created_at and plan = 'max' and billing_cycle = 'lifetime'
      and status = 'active' and trial_used and source = 'open_signup_grant';
  end if;

  for staged_row in
    select * from tempo_import.staged_rows
    where owner_email_lower = staged.email_lower and claimed_at is null
    order by load_order, target_table, id
    for update
  loop
    if staged_row.target_table not in ('task_repeat_cfgs', 'tasks') then
      raise exception 'Unsupported import target';
    end if;

    execute pg_catalog.format(
      'insert into public.%1$I
        select * from pg_catalog.jsonb_populate_record(null::public.%1$I, $1)
        on conflict (id) do nothing',
      staged_row.target_table
    ) using staged_row.payload || pg_catalog.jsonb_build_object(
      'id', staged_row.id, 'legacy_convex_id', staged_row.legacy_convex_id, 'user_id', p_user_id
    );
    get diagnostics inserted = row_count;
    if inserted = 0 then
      execute pg_catalog.format(
        'select exists (select from public.%I where id = $1 and user_id = $2 and legacy_convex_id = $3)',
        staged_row.target_table
      ) into same_row using staged_row.id, p_user_id, staged_row.legacy_convex_id;
      if not same_row then
        raise exception 'Import claim conflicts with an existing row';
      end if;
    end if;
  end loop;

  update tempo_import.staged_rows set claimed_at = claim_ms
  where owner_email_lower = staged.email_lower and claimed_at is null;
  update tempo_import.staged_users set claimed_user_id = p_user_id, claimed_at = claim_ms
  where email_lower = staged.email_lower;
end;
$$;

revoke execute on function tempo_import.claim_staged(uuid, text) from public, anon, authenticated;

create function tempo_import.claim_verified_user()
returns trigger
language plpgsql
security definer
set search_path = public, tempo_import, pg_temp
as $$
begin
  perform tempo_import.claim_staged(new.id, new.email);
  return new;
end;
$$;

revoke execute on function tempo_import.claim_verified_user() from public, anon, authenticated;

create function tempo_import.begin_staged_load()
returns void
language plpgsql
security definer
set search_path = tempo_import, pg_temp
as $$
begin
  insert into tempo_import.load_state (id, completed_at) values (1, null)
  on conflict (id) do update set completed_at = null;
end;
$$;

create function tempo_import.finalize_staged_load()
returns void
language plpgsql
security definer
set search_path = public, tempo_import, pg_temp
as $$
declare
  verified auth.users;
  claim_ms bigint := (extract(epoch from pg_catalog.now()) * 1000)::bigint;
begin
  insert into tempo_import.load_state (id, completed_at) values (1, claim_ms)
  on conflict (id) do update set completed_at = claim_ms;
  for verified in
    select users.*
    from auth.users as users
    join tempo_import.staged_users as staged
      on staged.email_lower = pg_catalog.lower(users.email)
    where users.email_verified and staged.claimed_at is null
  loop
    perform tempo_import.claim_staged(verified.id, verified.email);
  end loop;
end;
$$;

revoke execute on function tempo_import.begin_staged_load(), tempo_import.finalize_staged_load()
  from public, anon, authenticated;
grant execute on function tempo_import.begin_staged_load(), tempo_import.finalize_staged_load()
  to project_admin;

-- Sort after on_auth_user_created_tempo so the INSERT trigger has created the public identity rows.
create trigger on_auth_user_verified_tempo_import
  after insert or update of email_verified on auth.users
  for each row when (new.email_verified)
  execute function tempo_import.claim_verified_user();

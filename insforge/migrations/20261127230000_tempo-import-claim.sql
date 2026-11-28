create schema tempo_import;

revoke all on schema tempo_import from public, anon, authenticated;
grant usage on schema tempo_import to project_admin;

create table tempo_import.loads (
  id uuid primary key,
  status text not null check (status in ('open', 'finalized', 'released')),
  created_at bigint not null,
  finalized_at bigint,
  released_at bigint,
  check (
    (status = 'open' and finalized_at is null and released_at is null)
    or (status = 'finalized' and finalized_at is not null and released_at is null)
    or (status = 'released' and released_at is not null and finalized_at is null)
  )
);

create table tempo_import.staged_users (
  load_id uuid not null references tempo_import.loads (id),
  email_lower text not null check (email_lower = pg_catalog.lower(email_lower)),
  legacy_convex_id text not null,
  gate jsonb not null,
  profile jsonb,
  subscription jsonb,
  staged_at bigint not null,
  claimed_user_id uuid,
  claimed_at bigint,
  primary key (load_id, email_lower),
  unique (load_id, legacy_convex_id)
);

create table tempo_import.staged_rows (
  load_id uuid not null,
  target_table text not null check (target_table in ('task_repeat_cfgs', 'tasks')),
  id uuid not null,
  legacy_convex_id text not null,
  owner_email_lower text not null,
  load_order int not null,
  payload jsonb not null,
  staged_at bigint not null,
  claimed_at bigint,
  primary key (load_id, target_table, id),
  unique (load_id, target_table, legacy_convex_id),
  foreign key (load_id, owner_email_lower)
    references tempo_import.staged_users (load_id, email_lower)
);

create index staged_rows_owner_load_idx
  on tempo_import.staged_rows (load_id, owner_email_lower, load_order, target_table, id)
  where claimed_at is null;

create table tempo_import.pending_verifications (
  load_id uuid not null references tempo_import.loads (id),
  user_id uuid not null,
  email_lower text not null,
  primary key (load_id, user_id)
);

alter table tempo_import.loads enable row level security;
alter table tempo_import.staged_users enable row level security;
alter table tempo_import.staged_rows enable row level security;
alter table tempo_import.pending_verifications enable row level security;
revoke all on all tables in schema tempo_import from public, anon, authenticated;
grant select, insert, update on tempo_import.loads, tempo_import.staged_users,
  tempo_import.staged_rows, tempo_import.pending_verifications to project_admin;

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
  changed bigint;
  same_row boolean;
begin
  if not exists (
    select from auth.users
    where id = p_user_id and email_verified and pg_catalog.lower(email) = pg_catalog.lower(p_email)
  ) then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(2026112701);

  insert into tempo_import.pending_verifications (load_id, user_id, email_lower)
  select loads.id, p_user_id, pg_catalog.lower(p_email)
  from tempo_import.loads as loads
  join tempo_import.staged_users as waiting
    on waiting.load_id = loads.id and waiting.email_lower = pg_catalog.lower(p_email)
  where loads.status = 'open'
  on conflict (load_id, user_id) do update set email_lower = excluded.email_lower;

  for staged in
    select waiting.*
    from tempo_import.staged_users as waiting
    join tempo_import.loads as loads on loads.id = waiting.load_id
    where waiting.email_lower = pg_catalog.lower(p_email)
      and waiting.claimed_at is null
      and loads.status = 'finalized'
    order by loads.finalized_at, waiting.load_id
    for update of waiting
  loop
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
    get diagnostics changed = row_count;
    if changed = 0 and not exists (
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
      select id into subscription_id from public.subscription_states
      where user_id = p_user_id
        and (legacy_convex_id is null or legacy_convex_id = subscription.legacy_convex_id)
      for update;
      if found then
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
      end if;
    end if;

    for staged_row in
      select * from tempo_import.staged_rows
      where load_id = staged.load_id
        and owner_email_lower = staged.email_lower
        and claimed_at is null
      order by load_order, target_table, id
      for update
    loop
      execute pg_catalog.format(
        'insert into public.%1$I
          select * from pg_catalog.jsonb_populate_record(null::public.%1$I, $1)
          on conflict (id) do nothing',
        staged_row.target_table
      ) using staged_row.payload || pg_catalog.jsonb_build_object(
        'id', staged_row.id, 'legacy_convex_id', staged_row.legacy_convex_id, 'user_id', p_user_id
      );
      get diagnostics changed = row_count;
      if changed = 0 then
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
    where load_id = staged.load_id and owner_email_lower = staged.email_lower and claimed_at is null;
    update tempo_import.staged_users set claimed_user_id = p_user_id, claimed_at = claim_ms
    where load_id = staged.load_id and email_lower = staged.email_lower;
    delete from tempo_import.pending_verifications
    where load_id = staged.load_id and user_id = p_user_id;
  end loop;
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

create trigger on_auth_user_verified_tempo_import
  after insert or update of email_verified on auth.users
  for each row when (new.email_verified)
  execute function tempo_import.claim_verified_user();

create function tempo_import.begin_staged_load(p_load_id uuid)
returns uuid
language plpgsql
security definer
set search_path = tempo_import, pg_temp
as $$
declare
  now_ms bigint := (extract(epoch from pg_catalog.now()) * 1000)::bigint;
begin
  insert into tempo_import.loads (id, status, created_at)
  values (p_load_id, 'open', now_ms);
  return p_load_id;
end;
$$;

create function tempo_import.finalize_staged_load(p_load_id uuid)
returns void
language plpgsql
security definer
set search_path = public, tempo_import, pg_temp
as $$
declare
  verified auth.users;
  now_ms bigint := (extract(epoch from pg_catalog.now()) * 1000)::bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(2026112701);
  update tempo_import.loads set status = 'finalized', finalized_at = now_ms
  where id = p_load_id and status = 'open';
  if not found then
    raise exception 'Only an open load can be finalized';
  end if;
  for verified in
    select users.*
    from auth.users as users
    join tempo_import.staged_users as staged
      on staged.load_id = p_load_id and staged.email_lower = pg_catalog.lower(users.email)
    where users.email_verified and staged.claimed_at is null
  loop
    perform tempo_import.claim_staged(verified.id, verified.email);
  end loop;
  for verified in
    select users.*
    from auth.users as users
    join tempo_import.pending_verifications as pending
      on pending.load_id = p_load_id and pending.user_id = users.id
    where users.email_verified and pg_catalog.lower(users.email) = pending.email_lower
  loop
    perform tempo_import.claim_staged(verified.id, verified.email);
  end loop;
end;
$$;

create function tempo_import.release_staged_load(p_load_id uuid)
returns void
language plpgsql
security definer
set search_path = tempo_import, pg_temp
as $$
declare
  now_ms bigint := (extract(epoch from pg_catalog.now()) * 1000)::bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(2026112701);
  if not exists (
    select from tempo_import.loads where id = p_load_id and status = 'open' for update
  ) then
    raise exception 'Only an open load can be released';
  end if;
  delete from tempo_import.staged_rows where load_id = p_load_id;
  delete from tempo_import.pending_verifications where load_id = p_load_id;
  delete from tempo_import.staged_users where load_id = p_load_id;
  update tempo_import.loads set status = 'released', released_at = now_ms
  where id = p_load_id and status = 'open';
end;
$$;

revoke execute on function tempo_import.begin_staged_load(uuid),
  tempo_import.finalize_staged_load(uuid), tempo_import.release_staged_load(uuid)
  from public, anon, authenticated;
grant execute on function tempo_import.begin_staged_load(uuid),
  tempo_import.finalize_staged_load(uuid), tempo_import.release_staged_load(uuid)
  to project_admin;

begin;

set local role project_admin;
insert into tempo_import.staged_users (
  email_lower, legacy_convex_id, gate, profile, subscription, staged_at
) values (
  'claim-owner@example.invalid', 'claim-legacy-owner',
  '{"role":"admin","user_type":"paid","beta_access":"tester","entitlement_tier":"pro",
    "is_active":true,"approval_status":"approved","created_at":10,"updated_at":11}'::jsonb,
  '{"name":"Staged profile","full_name":"Imported Profile","onboarded_at":9,
    "created_at":10,"updated_at":11}'::jsonb,
  '{"legacy_convex_id":"claim-legacy-subscription","plan":"pro","billing_cycle":"monthly",
    "status":"grace","trial_used":true,"source":"import","created_at":12,"updated_at":13}'::jsonb,
  100
), (
  'claim-pending@example.invalid', 'claim-legacy-pending',
  '{"role":"user","is_active":true,"approval_status":"pending","created_at":10,"updated_at":11}',
  null, null, 100
);

insert into tempo_import.staged_rows (
  target_table, id, legacy_convex_id, owner_email_lower, load_order, payload, staged_at
) values (
  'tasks', '00000000-0000-4000-8000-000000000474', 'claim-child', 'claim-owner@example.invalid', 3,
  '{"title":"Child","status":"todo","priority":"low","created_at":10,"updated_at":11,
    "parent_task_id":"00000000-0000-4000-8000-000000000473"}', 100
), (
  'tasks', '00000000-0000-4000-8000-000000000473', 'claim-parent', 'claim-owner@example.invalid', 2,
  '{"title":"Parent","status":"todo","priority":"low","created_at":10,"updated_at":11,
    "user_id":"00000000-0000-4000-8000-000000000476",
    "repeat_cfg_id":"00000000-0000-4000-8000-000000000472"}', 100
), (
  'task_repeat_cfgs', '00000000-0000-4000-8000-000000000472', 'claim-repeat', 'claim-owner@example.invalid', 1,
  '{"repeat_cycle":"DAILY","repeat_every":1,"weekdays":[],"deleted_instance_dates":[],
    "skip_overdue":false,"wait_for_completion":false,"repeat_from_completion_date":false,
    "is_paused":false,"created_at":10,"updated_at":11}', 100
);

do $$
begin
  begin
    insert into tempo_import.staged_rows (
      target_table, id, legacy_convex_id, owner_email_lower, load_order, payload, staged_at
    ) values (
      'account_gate', '00000000-0000-4000-8000-000000000477', 'not-allowed',
      'claim-owner@example.invalid', 0, '{}', 100
    );
    raise exception 'Non-whitelisted import target accepted';
  exception when sqlstate '23514' then null;
  end;
end;
$$;

reset role;
insert into auth.users (id, email, email_verified) values
  ('00000000-0000-4000-8000-000000000471', 'Claim-Owner@Example.Invalid', false),
  ('00000000-0000-4000-8000-000000000476', 'nonmatching@example.invalid', true);

select tempo_import.claim_staged('00000000-0000-4000-8000-000000000476', 'claim-owner@example.invalid');
select tempo_import.claim_staged('00000000-0000-4000-8000-000000000471', 'claim-owner@example.invalid');

do $$
begin
  if exists (select from tempo_import.staged_users where claimed_at is not null or claimed_user_id is not null)
    or exists (select from tempo_import.staged_rows where claimed_at is not null)
    or exists (select from public.account_gate where legacy_convex_id like 'claim-legacy-%')
    or exists (select from public.tasks where legacy_convex_id like 'claim-%')
    or exists (select from public.task_repeat_cfgs where legacy_convex_id = 'claim-repeat') then
    raise exception 'An unverified or nonmatching auth user claimed staged data';
  end if;
end;
$$;

update auth.users set email_verified = true where id = '00000000-0000-4000-8000-000000000471';
insert into auth.users (id, email, email_verified)
values ('00000000-0000-4000-8000-000000000475', 'claim-pending@example.invalid', true);

do $$
declare
  owner_id constant uuid := '00000000-0000-4000-8000-000000000471';
  pending_id constant uuid := '00000000-0000-4000-8000-000000000475';
  claim_time bigint;
begin
  select claimed_at into strict claim_time from tempo_import.staged_users
  where email_lower = 'claim-owner@example.invalid' and claimed_user_id = owner_id;
  if claim_time is null or (select count(*) from tempo_import.staged_rows where claimed_at = claim_time) <> 3 then
    raise exception 'Staged user and row claims were not recorded';
  end if;
  if not exists (select from public.account_gate where user_id = owner_id
      and legacy_convex_id = 'claim-legacy-owner' and approval_status = 'approved'
      and role = 'admin' and entitlement_tier = 'pro' and updated_at = 11) then
    raise exception 'Imported gate state was not restored';
  end if;
  if not exists (select from public.profiles where user_id = owner_id
      and name = 'Staged profile' and full_name = 'Imported Profile' and onboarded_at = 9)
    or (select count(*) from public.subscription_states where user_id = owner_id) <> 1
    or not exists (select from public.subscription_states where user_id = owner_id
      and legacy_convex_id = 'claim-legacy-subscription' and plan = 'pro' and billing_cycle = 'monthly'
      and status = 'grace' and trial_used and source = 'import' and updated_at = 13) then
    raise exception 'Imported profile or subscription state was not restored';
  end if;
  if not exists (
    select from public.tasks child
    join public.tasks parent on (child.user_id, child.parent_task_id) = (parent.user_id, parent.id)
    join public.task_repeat_cfgs repeat on (parent.user_id, parent.repeat_cfg_id) = (repeat.user_id, repeat.id)
    where child.user_id = owner_id and child.legacy_convex_id = 'claim-child'
      and parent.legacy_convex_id = 'claim-parent' and repeat.legacy_convex_id = 'claim-repeat'
  ) then
    raise exception 'Imported tasks and their references were not materialized for the verified owner';
  end if;
  if not exists (select from tempo_import.staged_users
      where claimed_user_id = pending_id and claimed_at is not null)
    or not exists (select from public.account_gate where user_id = pending_id
      and legacy_convex_id = 'claim-legacy-pending' and approval_status = 'pending')
    or not exists (select from public.subscription_states where user_id = pending_id
      and plan = 'none' and status = 'inactive' and not trial_used) then
    raise exception 'Already-verified insert did not claim pending gate without the signup grant';
  end if;
end;
$$;

update public.account_gate set approval_status = 'revoked'
where user_id = '00000000-0000-4000-8000-000000000471';
update public.tasks set title = 'Edited after claim' where legacy_convex_id = 'claim-child';
update auth.users set email_verified = true where id = '00000000-0000-4000-8000-000000000471';

do $$
declare
  client text;
  staged_table regclass;
begin
  if not exists (select from public.account_gate
      where legacy_convex_id = 'claim-legacy-owner' and approval_status = 'revoked')
    or not exists (select from public.tasks
      where legacy_convex_id = 'claim-child' and title = 'Edited after claim')
    or (select count(*) from public.subscription_states
      where user_id = '00000000-0000-4000-8000-000000000471') <> 1 then
    raise exception 'Repeated verification changed an already-claimed account';
  end if;

  foreach client in array array['anon', 'authenticated']
  loop
    if has_schema_privilege(client, 'tempo_import', 'USAGE, CREATE')
      or has_function_privilege(client, 'tempo_import.claim_staged(uuid, text)', 'EXECUTE')
      or has_function_privilege(client, 'tempo_import.claim_verified_user()', 'EXECUTE') then
      raise exception 'Client has schema or claim function access: %', client;
    end if;
    foreach staged_table in array array[
      'tempo_import.staged_users'::regclass, 'tempo_import.staged_rows'::regclass
    ]
    loop
      if has_table_privilege(client, staged_table, 'SELECT, INSERT, UPDATE, DELETE')
        or has_any_column_privilege(client, staged_table, 'SELECT, INSERT, UPDATE') then
        raise exception 'Client has staged table access: %', client;
      end if;
    end loop;
  end loop;
end;
$$;

rollback;

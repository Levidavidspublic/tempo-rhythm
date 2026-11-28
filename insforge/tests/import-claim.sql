begin;

set local role project_admin;
select tempo_import.begin_staged_load('00000000-0000-4000-8000-0000000004a1'::uuid);
insert into tempo_import.staged_users (
  load_id, email_lower, legacy_convex_id, gate, staged_at
) values (
  '00000000-0000-4000-8000-0000000004a1', 'claim-a@example.invalid', 'claim-legacy-a',
  '{"role":"user","is_active":true,"approval_status":"approved","created_at":10,"updated_at":11}',
  100
);
insert into tempo_import.staged_rows (
  load_id, target_table, id, legacy_convex_id, owner_email_lower, load_order, payload, staged_at
) values (
  '00000000-0000-4000-8000-0000000004a1', 'tasks',
  '00000000-0000-4000-8000-0000000004a2', 'claim-task-a', 'claim-a@example.invalid', 1,
  '{"title":"Kept","status":"todo","priority":"low","created_at":10,"updated_at":11}', 100
);
select tempo_import.finalize_staged_load('00000000-0000-4000-8000-0000000004a1'::uuid);

select tempo_import.begin_staged_load('00000000-0000-4000-8000-0000000004b1'::uuid);
insert into tempo_import.staged_users (
  load_id, email_lower, legacy_convex_id, gate, staged_at
) values (
  '00000000-0000-4000-8000-0000000004b1', 'claim-b@example.invalid', 'claim-legacy-b',
  '{"role":"user","is_active":true,"approval_status":"approved","created_at":10,"updated_at":11}',
  100
);
insert into tempo_import.staged_rows (
  load_id, target_table, id, legacy_convex_id, owner_email_lower, load_order, payload, staged_at
) values (
  '00000000-0000-4000-8000-0000000004b1', 'tasks',
  '00000000-0000-4000-8000-0000000004b2', 'claim-task-b', 'claim-b@example.invalid', 1,
  '{"title":"Dropped","status":"todo","priority":"low","created_at":10,"updated_at":11}', 100
);
select tempo_import.release_staged_load('00000000-0000-4000-8000-0000000004b1'::uuid);
reset role;

insert into auth.users (id, email, email_verified)
values ('00000000-0000-4000-8000-0000000004a3', 'claim-a@example.invalid', true);

do $$
begin
  if not exists (
    select from tempo_import.loads
    where id = '00000000-0000-4000-8000-0000000004a1' and status = 'finalized'
  ) or not exists (
    select from tempo_import.staged_users
    where load_id = '00000000-0000-4000-8000-0000000004a1' and claimed_at is not null
  ) or not exists (
    select from public.tasks where legacy_convex_id = 'claim-task-a'
  ) then
    raise exception 'A finalized unverified load was not claimed after verification';
  end if;
  if exists (
    select from tempo_import.staged_users where load_id = '00000000-0000-4000-8000-0000000004b1'
  ) or exists (
    select from tempo_import.staged_rows where load_id = '00000000-0000-4000-8000-0000000004b1'
  ) or exists (
    select from public.tasks where legacy_convex_id = 'claim-task-b'
  ) or (select status from tempo_import.loads
        where id = '00000000-0000-4000-8000-0000000004b1') is distinct from 'released' then
    raise exception 'A released load was not discarded, or it removed the earlier load';
  end if;
end;
$$;

set local role project_admin;
select tempo_import.begin_staged_load('00000000-0000-4000-8000-0000000004c1'::uuid);
insert into tempo_import.staged_users (
  load_id, email_lower, legacy_convex_id, gate, staged_at
) values (
  '00000000-0000-4000-8000-0000000004c1', 'claim-c@example.invalid', 'claim-legacy-c',
  '{"role":"user","is_active":true,"approval_status":"approved","created_at":10,"updated_at":11}',
  100
);
reset role;
insert into auth.users (id, email, email_verified)
values ('00000000-0000-4000-8000-0000000004c3', 'claim-c@example.invalid', true);

do $$
begin
  if exists (
    select from public.account_gate
    where user_id = '00000000-0000-4000-8000-0000000004c3' and legacy_convex_id = 'claim-legacy-c'
  ) or exists (
    select from tempo_import.staged_users
    where load_id = '00000000-0000-4000-8000-0000000004c1' and claimed_at is not null
  ) then
    raise exception 'Verification during an open load sealed that load';
  end if;
end;
$$;

set local role project_admin;
select tempo_import.finalize_staged_load('00000000-0000-4000-8000-0000000004c1'::uuid);
reset role;

do $$
begin
  if not exists (
    select from tempo_import.staged_users
    where load_id = '00000000-0000-4000-8000-0000000004c1'
      and claimed_user_id = '00000000-0000-4000-8000-0000000004c3'
      and claimed_at is not null
  ) then
    raise exception 'Finalizing did not claim a user verified while the load was open';
  end if;
end;
$$;

rollback;

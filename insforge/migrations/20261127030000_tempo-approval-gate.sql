-- Owner data is available only to approved accounts. The account_gate owner policy
-- stays unchanged so pending and revoked users can read their own approval status.
-- P05 restores imported approval statuses, treating a missing status as approved.

create or replace function public.account_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.account_gate
    where user_id = auth.uid()
      and deleted_at is null
      and coalesce(is_active, true)
      and approval_status = 'approved'
  );
$$;

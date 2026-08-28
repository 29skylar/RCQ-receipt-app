-- Fix accounts role check so Staff is allowed, then insert Staff.
-- Run this whole block in Supabase SQL Editor.

-- 1) Drop ANY check constraint on accounts.role (name can vary)
do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'accounts'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%role%'
  loop
    execute format('alter table public.accounts drop constraint %I', r.conname);
  end loop;
end $$;

-- 2) Recreate the check with Staff included
alter table public.accounts
  add constraint accounts_role_check
  check (role in ('Sales Rep', 'CEO', 'Staff'));

-- 3) Insert / update Staff account
insert into public.accounts (display_name, role, is_active)
values ('Staff', 'Staff', true)
on conflict (display_name) do update
set role = 'Staff',
    is_active = true,
    updated_at = now();

-- 4) Allow CRM (anon key) to manage accounts / plans / insurers
drop policy if exists "prototype_accounts_read" on public.accounts;
drop policy if exists "prototype_accounts_all" on public.accounts;
create policy "prototype_accounts_all"
  on public.accounts for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "prototype_insurance_plans_read" on public.insurance_plans;
drop policy if exists "prototype_insurance_plans_all" on public.insurance_plans;
create policy "prototype_insurance_plans_all"
  on public.insurance_plans for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "prototype_insurers_read" on public.insurers;
drop policy if exists "prototype_insurers_all" on public.insurers;
create policy "prototype_insurers_all"
  on public.insurers for all
  to anon, authenticated
  using (true)
  with check (true);

-- 5) Confirm Staff exists
select id, display_name, role, is_active
from public.accounts
where display_name = 'Staff';

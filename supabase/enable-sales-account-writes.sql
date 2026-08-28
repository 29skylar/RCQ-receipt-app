-- Enable Staff to create / update sales accounts from the CRM
-- Run in Supabase SQL Editor (safe to re-run).

-- Ensure Staff role is allowed
alter table public.accounts drop constraint if exists accounts_role_check;
alter table public.accounts
  add constraint accounts_role_check
  check (role in ('Sales Rep', 'CEO', 'Staff'));

insert into public.accounts (display_name, role, is_active)
values ('Staff', 'Staff', true)
on conflict (display_name) do update
set role = 'Staff',
    is_active = true,
    updated_at = now();

-- Allow anon (mock login prototype) to manage accounts
alter table public.accounts enable row level security;

drop policy if exists "prototype_accounts_read" on public.accounts;
drop policy if exists "prototype_accounts_all" on public.accounts;
create policy "prototype_accounts_all"
  on public.accounts for all
  to anon, authenticated
  using (true)
  with check (true);

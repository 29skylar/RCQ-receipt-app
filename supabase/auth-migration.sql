-- =============================================================================
-- Supabase Auth migration for Insurance Broker CRM
-- Run in Supabase SQL Editor AFTER enabling Email auth in Authentication settings.
-- =============================================================================

-- 1) Link CRM accounts to Supabase Auth users
alter table public.accounts
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null;

alter table public.accounts
  add column if not exists email text unique;

comment on column public.accounts.auth_user_id is
  'Links this CRM account to auth.users for email/password login.';
comment on column public.accounts.email is
  'Login email for this CRM account.';

-- 2) Helper functions for RLS
create or replace function public.current_account_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.accounts
  where auth_user_id = auth.uid()
    and is_active = true
  limit 1;
$$;

create or replace function public.current_account_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.accounts
  where auth_user_id = auth.uid()
    and is_active = true
  limit 1;
$$;

create or replace function public.is_elevated_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_account_role() in ('CEO', 'Staff'), false);
$$;

-- 3) Drop prototype open policies (safe if they do not exist)
drop policy if exists prototype_accounts_all on public.accounts;
drop policy if exists prototype_client_records_all on public.client_records;
drop policy if exists prototype_pipeline_statuses_read on public.pipeline_statuses;
drop policy if exists prototype_insurers_all on public.insurers;
drop policy if exists prototype_insurance_plans_all on public.insurance_plans;
drop policy if exists prototype_currencies_read on public.currencies;

-- 4) Enable RLS
alter table public.accounts enable row level security;
alter table public.client_records enable row level security;
alter table public.pipeline_statuses enable row level security;
alter table public.insurers enable row level security;
alter table public.insurance_plans enable row level security;
alter table public.currencies enable row level security;

-- 5) Accounts policies
drop policy if exists accounts_select_own_or_elevated on public.accounts;
drop policy if exists accounts_insert_staff on public.accounts;
drop policy if exists accounts_update_staff on public.accounts;

create policy "accounts_select_own_or_elevated"
  on public.accounts for select
  using (
    auth_user_id = auth.uid()
    or public.is_elevated_role()
  );

create policy "accounts_insert_staff"
  on public.accounts for insert
  with check (public.current_account_role() = 'Staff');

create policy "accounts_update_staff"
  on public.accounts for update
  using (public.current_account_role() = 'Staff')
  with check (public.current_account_role() = 'Staff');

-- 6) Client records policies
drop policy if exists client_records_select_own_or_elevated on public.client_records;
drop policy if exists client_records_insert_sales_rep on public.client_records;
drop policy if exists client_records_update_own_or_elevated on public.client_records;
drop policy if exists client_records_delete_own_or_elevated on public.client_records;

create policy "client_records_select_own_or_elevated"
  on public.client_records for select
  using (
    owner_account_id = public.current_account_id()
    or public.is_elevated_role()
  );

create policy "client_records_insert_sales_rep"
  on public.client_records for insert
  with check (
    public.current_account_role() = 'Sales Rep'
    and owner_account_id = public.current_account_id()
  );

create policy "client_records_update_own_or_elevated"
  on public.client_records for update
  using (
    owner_account_id = public.current_account_id()
    or public.is_elevated_role()
  )
  with check (
    owner_account_id = public.current_account_id()
    or public.is_elevated_role()
  );

create policy "client_records_delete_own_or_elevated"
  on public.client_records for delete
  using (
    owner_account_id = public.current_account_id()
    or public.is_elevated_role()
  );

-- 7) Reference data policies
drop policy if exists pipeline_statuses_read_authenticated on public.pipeline_statuses;
drop policy if exists currencies_read_authenticated on public.currencies;
drop policy if exists insurers_read_authenticated on public.insurers;
drop policy if exists insurers_write_staff on public.insurers;
drop policy if exists insurance_plans_read_authenticated on public.insurance_plans;
drop policy if exists insurance_plans_write_staff on public.insurance_plans;

create policy "pipeline_statuses_read_authenticated"
  on public.pipeline_statuses for select
  using (auth.role() = 'authenticated');

create policy "currencies_read_authenticated"
  on public.currencies for select
  using (auth.role() = 'authenticated');

create policy "insurers_read_authenticated"
  on public.insurers for select
  using (auth.role() = 'authenticated');

create policy "insurers_write_staff"
  on public.insurers for all
  using (public.current_account_role() = 'Staff')
  with check (public.current_account_role() = 'Staff');

create policy "insurance_plans_read_authenticated"
  on public.insurance_plans for select
  using (auth.role() = 'authenticated');

create policy "insurance_plans_write_staff"
  on public.insurance_plans for all
  using (public.current_account_role() = 'Staff')
  with check (public.current_account_role() = 'Staff');

-- =============================================================================
-- After running this SQL, run the seed script once to create auth users:
--   node scripts/seed-auth-users.mjs
-- Existing accounts will get emails like tr.alan.but@crm.local with password 123456
-- =============================================================================

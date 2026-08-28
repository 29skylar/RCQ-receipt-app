-- Prototype-only: allow the browser Anon key to read/write CRM tables
-- while we still use the mock account switcher (no Supabase Auth yet).
--
-- Run this in the Supabase SQL Editor if SELECT/INSERT fails with
-- "permission denied" / RLS errors.
--
-- Replace with real auth + tighter policies before production.

alter table public.accounts enable row level security;
alter table public.client_records enable row level security;
alter table public.pipeline_statuses enable row level security;
alter table public.insurers enable row level security;
alter table public.insurance_plans enable row level security;
alter table public.currencies enable row level security;

drop policy if exists "prototype_accounts_read" on public.accounts;
drop policy if exists "prototype_accounts_all" on public.accounts;
create policy "prototype_accounts_all"
  on public.accounts for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "prototype_client_records_all" on public.client_records;
create policy "prototype_client_records_all"
  on public.client_records for all
  to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "prototype_pipeline_statuses_read" on public.pipeline_statuses;
create policy "prototype_pipeline_statuses_read"
  on public.pipeline_statuses for select
  to anon, authenticated
  using (true);

drop policy if exists "prototype_insurers_read" on public.insurers;
drop policy if exists "prototype_insurers_all" on public.insurers;
create policy "prototype_insurers_all"
  on public.insurers for all
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

drop policy if exists "prototype_currencies_read" on public.currencies;
create policy "prototype_currencies_read"
  on public.currencies for select
  to anon, authenticated
  using (true);

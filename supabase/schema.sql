-- =============================================================================
-- Insurance Broker CRM — Supabase database requirements
-- =============================================================================
-- Purpose: Tell Supabase / backend what information to hold.
-- Run this in the Supabase SQL Editor (or as a migration).
--
-- Business rules mirrored from the Next.js prototype:
--   1. Sales reps (TR-Alan But, TR-Sally) only see / edit their own client records.
--   2. CEO can view (and manage) ALL client records.
--   3. When a sales rep adds a record, owner = that sales rep.
--   4. Required on create: status, client_name, date_of_first_met.
--      All other application / client detail fields may be NULL.
--   5. HKD premium is derived: premiums * exchange_rate (do not store as source
--      of truth unless you also want a cached column — see note below).
-- =============================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1) Lookup / reference data
-- -----------------------------------------------------------------------------

-- User accounts that log into the CRM
create table if not exists public.accounts (
  id            uuid primary key default gen_random_uuid(),
  display_name  text not null unique,          -- e.g. 'TR-Alan But', 'TR-Sally', 'CEO'
  role          text not null
                check (role in ('Sales Rep', 'CEO', 'Staff')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.accounts is
  'CRM login accounts. Sales Reps own client records; CEO can see all records.';

-- Pipeline statuses (dropdown values)
create table if not exists public.pipeline_statuses (
  code          text primary key,              -- exact label shown in UI
  sort_order    integer not null,
  is_active     boolean not null default true
);

comment on table public.pipeline_statuses is
  'Allowed Status dropdown values for a client record.';

-- Insurers
create table if not exists public.insurers (
  code          text primary key,              -- 'AIA' | 'AXA' | 'FWD'
  name          text not null,
  is_active     boolean not null default true
);

comment on table public.insurers is
  'Insurer dropdown values.';

-- Plan names linked to an insurer (dependent dropdown)
create table if not exists public.insurance_plans (
  id            uuid primary key default gen_random_uuid(),
  insurer_code  text not null references public.insurers (code) on update cascade,
  plan_name     text not null,
  is_active     boolean not null default true,
  unique (insurer_code, plan_name)
);

comment on table public.insurance_plans is
  'Plan Name options. UI must filter by selected insurer.';

-- Currencies + fixed exchange rates used by the prototype
create table if not exists public.currencies (
  code          text primary key,              -- 'HKD' | 'USD'
  ex_rate_to_hkd numeric(12, 4) not null,      -- HKD=1.00, USD=7.80
  is_active     boolean not null default true
);

comment on table public.currencies is
  'Currency dropdown and Ex Rate source. Ex Rate is auto-filled from this table.';

-- -----------------------------------------------------------------------------
-- 2) Main transactional data: client / application records
-- -----------------------------------------------------------------------------

create table if not exists public.client_records (
  id                         uuid primary key default gen_random_uuid(),

  -- Ownership / multi-user isolation
  owner_account_id           uuid not null
                             references public.accounts (id),
  -- Convenience denormalized owner label (optional but useful for reports)
  owner_display_name         text not null,

  -- A. Pipeline Status & Timing
  -- REQUIRED
  status                     text not null
                             references public.pipeline_statuses (code),
  -- OPTIONAL  (month picker; store as first day of month or YYYY-MM string)
  anticipated_closing_month  date,             -- e.g. 2026-01-01 meaning Jan 2026

  -- B. Client Information
  -- REQUIRED
  client_name                text not null,
  -- REQUIRED
  date_of_first_met          date not null,    -- display as DD/MM/YYYY in UI
  -- OPTIONAL
  gender                     text
                             check (gender is null or gender in ('Male', 'Female')),
  age                        integer
                             check (age is null or (age >= 0 and age <= 120)),
  occupation                 text,

  -- C. Application Information
  -- OPTIONAL
  insurer_code               text
                             references public.insurers (code),
  policy_no                  text,
  plan_name                  text,             -- should match insurance_plans when set
  payment_term_years         integer
                             check (payment_term_years is null or payment_term_years >= 1),
  currency_code              text
                             references public.currencies (code),
  -- Premiums in original currency (OPTIONAL)
  premiums                   numeric(14, 2)
                             check (premiums is null or premiums >= 0),
  -- 簽單員服務 Y/N (OPTIONAL)
  signer_service             text
                             check (signer_service is null or signer_service in ('Yes', 'No')),
  sign_date                  date,             -- display as DD/MM/YYYY
  submit_date                date,             -- display as DD/MM/YYYY

  -- Audit
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  -- Plan must belong to selected insurer when both are present
  constraint client_records_plan_requires_insurer
    check (plan_name is null or insurer_code is not null)
);

comment on table public.client_records is
  'One row = one client / application pipeline record owned by a sales rep.';

comment on column public.client_records.owner_account_id is
  'Sales rep who owns the record. Auto-set on insert for Sales Rep users.';
comment on column public.client_records.status is
  'REQUIRED. Pipeline status dropdown.';
comment on column public.client_records.client_name is
  'REQUIRED. Name of client.';
comment on column public.client_records.date_of_first_met is
  'REQUIRED. Date of first met (UI format DD/MM/YYYY).';
comment on column public.client_records.anticipated_closing_month is
  'OPTIONAL. Anticipated closing month (UI shows e.g. Jan 2026).';
comment on column public.client_records.premiums is
  'OPTIONAL. Premium amount in original currency.';
comment on column public.client_records.currency_code is
  'OPTIONAL. Drives Ex Rate. HKD=>1.00, USD=>7.80.';

-- Derived HKD premium (read-only in UI). Prefer a VIEW or generated column:
-- HKD Premium = premiums * currencies.ex_rate_to_hkd
alter table public.client_records
  add column if not exists hkd_premium numeric(14, 2)
  generated always as (
    case
      when premiums is null then null
      when currency_code = 'HKD' then premiums * 1.00
      when currency_code = 'USD' then premiums * 7.80
      else null
    end
  ) stored;

comment on column public.client_records.hkd_premium is
  'AUTO-CALCULATED (read-only). premiums * ex rate. Do not accept from client form.';

-- Helpful indexes
create index if not exists idx_client_records_owner
  on public.client_records (owner_account_id);

create index if not exists idx_client_records_status
  on public.client_records (status);

create index if not exists idx_client_records_client_name
  on public.client_records (client_name);

create index if not exists idx_client_records_policy_no
  on public.client_records (policy_no);

create index if not exists idx_client_records_updated_at
  on public.client_records (updated_at desc);

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_accounts_updated_at on public.accounts;
create trigger trg_accounts_updated_at
  before update on public.accounts
  for each row execute function public.set_updated_at();

drop trigger if exists trg_client_records_updated_at on public.client_records;
create trigger trg_client_records_updated_at
  before update on public.client_records
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3) Seed reference data (matches current CRM prototype)
-- -----------------------------------------------------------------------------

insert into public.accounts (display_name, role) values
  ('TR-Alan But', 'Sales Rep'),
  ('TR-Sally', 'Sales Rep'),
  ('CEO', 'CEO'),
  ('Staff', 'Staff')
on conflict (display_name) do nothing;

insert into public.pipeline_statuses (code, sort_order) values
  ('初次接觸', 1),
  ('了解客戶', 2),
  ('簽署SESG', 3),
  ('FNA', 4),
  ('向客提出建議', 5),
  ('申請表格簽署', 6),
  ('申請待審批', 7),
  ('申請簽發', 8),
  ('費用代收', 9),
  ('Counter offer', 10),
  ('拒絕counter offer', 11),
  ('取消', 12),
  ('公司拒絕', 13)
on conflict (code) do nothing;

insert into public.insurers (code, name) values
  ('AIA', 'AIA'),
  ('AXA', 'AXA'),
  ('FWD', 'FWD')
on conflict (code) do nothing;

insert into public.insurance_plans (insurer_code, plan_name) values
  ('AIA', 'AIA 環宇盈活儲蓄保險計劃-整付'),
  ('AIA', 'AIA 盈御多元貨幣計劃3-5年繳'),
  ('AXA', 'AXA 盈家壽險'),
  ('AXA', 'AXA 盛利 II 儲蓄保險 – 至尊'),
  ('FWD', 'FWD 智盈匯聚(優越版) III壽險計劃'),
  ('FWD', 'FWD 盈聚·天下壽險計劃-2年')
on conflict (insurer_code, plan_name) do nothing;

insert into public.currencies (code, ex_rate_to_hkd) values
  ('HKD', 1.00),
  ('USD', 7.80)
on conflict (code) do nothing;

-- -----------------------------------------------------------------------------
-- 4) Row Level Security (RLS) — what each role may access
-- -----------------------------------------------------------------------------
-- NOTE: Wire these policies to Supabase Auth later.
-- For now this documents intended access:
--   - Sales Rep: SELECT/INSERT/UPDATE/DELETE only rows they own
--   - CEO: SELECT (and optionally UPDATE) all rows
--
-- Example pattern (enable after auth.users <-> accounts mapping exists):
--
-- alter table public.client_records enable row level security;
--
-- create policy "sales_select_own" on public.client_records
--   for select using (
--     owner_account_id = (select id from public.accounts where ... = auth.uid())
--     or exists (
--       select 1 from public.accounts a
--       where a.id = (select ...) and a.role = 'CEO'
--     )
--   );

-- -----------------------------------------------------------------------------
-- 5) Field checklist summary (for humans)
-- -----------------------------------------------------------------------------
-- TABLE: accounts
--   display_name, role (Sales Rep | CEO), is_active, timestamps
--
-- TABLE: pipeline_statuses
--   code (Status dropdown labels listed above)
--
-- TABLE: insurers
--   code: AIA, AXA, FWD
--
-- TABLE: insurance_plans
--   insurer_code + plan_name (dependent Plan Name dropdown)
--
-- TABLE: currencies
--   code: HKD / USD, ex_rate_to_hkd: 1.00 / 7.80
--
-- TABLE: client_records  (main form)
--   REQUIRED:
--     - status
--     - client_name
--     - date_of_first_met
--     - owner_account_id / owner_display_name  (system-set on create)
--   OPTIONAL:
--     - anticipated_closing_month
--     - gender (Male | Female)
--     - age
--     - occupation
--     - insurer_code
--     - policy_no
--     - plan_name  (requires insurer_code)
--     - payment_term_years
--     - currency_code
--     - premiums
--     - signer_service (Yes | No)   -- 簽單員服務
--     - sign_date
--     - submit_date
--   AUTO / READ-ONLY:
--     - hkd_premium = premiums * ex_rate
--     - created_at, updated_at
-- =============================================================================

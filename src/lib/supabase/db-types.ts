import type {
  Currency,
  Gender,
  Insurer,
  PipelineStatus,
  SalesRepId,
  YesNo,
} from "@/lib/types";

/** Row shape matching public.client_records in Supabase */
export interface ClientRecordRow {
  id: string;
  owner_account_id: string;
  owner_display_name: string;
  status: string;
  anticipated_closing_month: string | null;
  client_name: string;
  date_of_first_met: string;
  gender: string | null;
  age: number | null;
  occupation: string | null;
  insurer_code: string | null;
  policy_no: string | null;
  plan_name: string | null;
  payment_term_years: number | null;
  currency_code: string | null;
  premiums: number | string | null;
  signer_service: string | null;
  sign_date: string | null;
  submit_date: string | null;
  hkd_premium?: number | string | null;
  created_at: string;
  updated_at: string;
}

export interface AccountRow {
  id: string;
  display_name: string;
  email: string | null;
  auth_user_id: string | null;
  role: string;
  is_active: boolean;
}

export interface InsurerRow {
  code: string;
  name: string;
  is_active: boolean;
}

export interface InsurancePlanRow {
  id: string;
  insurer_code: string;
  plan_name: string;
  is_active: boolean;
}

export type ClientRecordInsert = {
  owner_account_id: string;
  owner_display_name: SalesRepId;
  status: PipelineStatus;
  anticipated_closing_month: string | null;
  client_name: string;
  date_of_first_met: string;
  gender: Gender | null;
  age: number | null;
  occupation: string | null;
  insurer_code: Insurer | null;
  policy_no: string | null;
  plan_name: string | null;
  payment_term_years: number | null;
  currency_code: Currency | null;
  premiums: number | null;
  signer_service: YesNo | null;
  sign_date: string | null;
  submit_date: string | null;
};

export type ClientRecordUpdate = Omit<
  ClientRecordInsert,
  "owner_account_id" | "owner_display_name"
>;

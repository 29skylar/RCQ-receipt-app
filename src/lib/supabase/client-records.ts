import type { ClientFormValues, ClientRecord, PipelineStatus, SalesRepId } from "@/lib/types";
import { supabase } from "./client";
import type { AccountRow, ClientRecordRow, InsurancePlanRow, InsurerRow } from "./db-types";
import { formValuesToInsert, formValuesToUpdate, mapRowToClientRecord } from "./mappers";

const ACCOUNT_COLUMNS = "id, display_name, email, auth_user_id, role, is_active";

export async function fetchAccountByAuthUserId(authUserId: string): Promise<AccountRow | null> {
  const { data, error } = await supabase
    .from("accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) throw error;
  return (data as AccountRow | null) ?? null;
}

export async function fetchAccounts(): Promise<AccountRow[]> {
  const { data, error } = await supabase
    .from("accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as AccountRow[];
}

export async function fetchAllAccounts(): Promise<AccountRow[]> {
  const { data, error } = await supabase
    .from("accounts")
    .select(ACCOUNT_COLUMNS)
    .order("role", { ascending: true })
    .order("display_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as AccountRow[];
}

export async function setSalesAccountActive(
  accountId: string,
  isActive: boolean,
): Promise<AccountRow> {
  const { data, error } = await supabase
    .from("accounts")
    .update({ is_active: isActive })
    .eq("id", accountId)
    .eq("role", "Sales Rep")
    .select(ACCOUNT_COLUMNS)
    .single();

  if (error) throw error;
  return data as AccountRow;
}

/** Active insurers for the Add/Edit form dropdown */
export async function fetchActiveInsurers(): Promise<InsurerRow[]> {
  const { data, error } = await supabase
    .from("insurers")
    .select("code, name, is_active")
    .eq("is_active", true)
    .order("code", { ascending: true });

  if (error) throw error;
  return (data ?? []) as InsurerRow[];
}

/** All insurers (active + archived) for Staff catalog */
export async function fetchAllInsurers(): Promise<InsurerRow[]> {
  const { data, error } = await supabase
    .from("insurers")
    .select("code, name, is_active")
    .order("code", { ascending: true });

  if (error) throw error;
  return (data ?? []) as InsurerRow[];
}

/** Active plans for one insurer (dependent Plan Name dropdown) */
export async function fetchActivePlansByInsurer(insurerCode: string): Promise<InsurancePlanRow[]> {
  const { data, error } = await supabase
    .from("insurance_plans")
    .select("id, insurer_code, plan_name, is_active")
    .eq("insurer_code", insurerCode)
    .eq("is_active", true)
    .order("plan_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as InsurancePlanRow[];
}

/** All plans for Staff catalog (optionally filtered by insurer) */
export async function fetchAllPlans(insurerCode?: string): Promise<InsurancePlanRow[]> {
  let query = supabase
    .from("insurance_plans")
    .select("id, insurer_code, plan_name, is_active")
    .order("insurer_code", { ascending: true })
    .order("plan_name", { ascending: true });

  if (insurerCode) {
    query = query.eq("insurer_code", insurerCode);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as InsurancePlanRow[];
}

export async function addInsurer(code: string, name?: string): Promise<InsurerRow> {
  const trimmedCode = code.trim();
  const trimmedName = (name ?? code).trim() || trimmedCode;
  if (!trimmedCode) {
    throw new Error("Insurer code is required.");
  }

  const { data, error } = await supabase
    .from("insurers")
    .upsert(
      {
        code: trimmedCode,
        name: trimmedName,
        is_active: true,
      },
      { onConflict: "code" },
    )
    .select("code, name, is_active")
    .single();

  if (error) throw error;
  return data as InsurerRow;
}

export async function addInsurancePlan(
  insurerCode: string,
  planName: string,
): Promise<InsurancePlanRow> {
  const rows = await addInsurancePlans(insurerCode, [planName]);
  return rows[0];
}

/** Add multiple plans for one insurer in a single request (one name per entry). */
export async function addInsurancePlans(
  insurerCode: string,
  planNames: string[],
): Promise<InsurancePlanRow[]> {
  if (!insurerCode) {
    throw new Error("Insurer is required.");
  }

  const uniqueNames = [
    ...new Set(
      planNames
        .map((name) => name.trim())
        .filter((name) => name.length > 0),
    ),
  ];

  if (uniqueNames.length === 0) {
    throw new Error("Enter at least one plan name.");
  }

  const payload = uniqueNames.map((plan_name) => ({
    insurer_code: insurerCode,
    plan_name,
    is_active: true,
  }));

  const { data, error } = await supabase
    .from("insurance_plans")
    .upsert(payload, { onConflict: "insurer_code,plan_name" })
    .select("id, insurer_code, plan_name, is_active");

  if (error) throw error;
  return (data ?? []) as InsurancePlanRow[];
}

export async function setPlanActive(planId: string, isActive: boolean): Promise<InsurancePlanRow> {
  const { data, error } = await supabase
    .from("insurance_plans")
    .update({ is_active: isActive })
    .eq("id", planId)
    .select("id, insurer_code, plan_name, is_active")
    .single();

  if (error) throw error;
  return data as InsurancePlanRow;
}

/** Permanently remove a plan from the catalog (client_records still keep stored plan_name text). */
export async function deleteInsurancePlan(planId: string): Promise<void> {
  const { error } = await supabase.from("insurance_plans").delete().eq("id", planId);
  if (error) throw error;
}

export async function fetchClientRecords(
  ownerAccountId: string,
  viewAll: boolean,
): Promise<ClientRecord[]> {
  let query = supabase.from("client_records").select("*").order("updated_at", { ascending: false });

  if (!viewAll) {
    query = query.eq("owner_account_id", ownerAccountId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as ClientRecordRow[]).map(mapRowToClientRecord);
}

export async function insertClientRecord(
  values: ClientFormValues,
  ownerDisplayName: SalesRepId,
  ownerAccountId: string,
): Promise<ClientRecord> {
  const payload = formValuesToInsert(values, ownerAccountId, ownerDisplayName);
  const { data, error } = await supabase.from("client_records").insert(payload).select("*").single();

  if (error) throw error;
  return mapRowToClientRecord(data as ClientRecordRow);
}

export async function updateClientRecord(
  id: string,
  values: ClientFormValues,
): Promise<ClientRecord> {
  const payload = formValuesToUpdate(values);
  const { data, error } = await supabase
    .from("client_records")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapRowToClientRecord(data as ClientRecordRow);
}

export async function updateClientStatus(
  id: string,
  status: PipelineStatus,
): Promise<ClientRecord> {
  const { data, error } = await supabase
    .from("client_records")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapRowToClientRecord(data as ClientRecordRow);
}

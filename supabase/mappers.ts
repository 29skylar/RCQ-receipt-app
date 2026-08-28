import type { ClientFormValues, ClientRecord, SalesRepId } from "@/lib/types";
import type { ClientRecordInsert, ClientRecordRow, ClientRecordUpdate } from "./db-types";

function emptyToNull<T extends string>(value: T | ""): T | null {
  return value === "" ? null : value;
}

function numberOrNull(value: number | ""): number | null {
  return value === "" ? null : value;
}

/** UI month input "YYYY-MM" <-> DB date "YYYY-MM-01" */
export function monthToDbDate(monthValue: string): string | null {
  if (!monthValue) return null;
  if (/^\d{4}-\d{2}$/.test(monthValue)) return `${monthValue}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(monthValue)) return monthValue.slice(0, 7) + "-01";
  return null;
}

export function dbDateToMonth(dateValue: string | null): string {
  if (!dateValue) return "";
  return dateValue.slice(0, 7);
}

export function mapRowToClientRecord(row: ClientRecordRow): ClientRecord {
  const premiumsRaw = row.premiums;
  const premiums =
    premiumsRaw === null || premiumsRaw === undefined || premiumsRaw === ""
      ? ("" as const)
      : Number(premiumsRaw);

  return {
    id: row.id,
    owner: row.owner_display_name as SalesRepId,
    status: row.status as ClientRecord["status"],
    anticipatedClosingMonth: dbDateToMonth(row.anticipated_closing_month),
    clientName: row.client_name,
    dateOfFirstMet: row.date_of_first_met,
    gender: (row.gender as ClientRecord["gender"]) ?? "",
    age: row.age ?? "",
    occupation: row.occupation ?? "",
    insurer: (row.insurer_code as ClientRecord["insurer"]) ?? "",
    policyNo: row.policy_no ?? "",
    planName: row.plan_name ?? "",
    paymentTermYears: row.payment_term_years ?? "",
    currency: (row.currency_code as ClientRecord["currency"]) ?? "",
    premiums: Number.isFinite(premiums as number) ? (premiums as number) : "",
    signerService: (row.signer_service as ClientRecord["signerService"]) ?? "",
    signDate: row.sign_date ?? "",
    submitDate: row.submit_date ?? "",
    updatedAt: row.updated_at,
  };
}

export function formValuesToInsert(
  values: ClientFormValues,
  ownerAccountId: string,
  ownerDisplayName: SalesRepId,
): ClientRecordInsert {
  return {
    owner_account_id: ownerAccountId,
    owner_display_name: ownerDisplayName,
    ...formValuesToUpdate(values),
  };
}

export function formValuesToUpdate(values: ClientFormValues): ClientRecordUpdate {
  return {
    status: values.status,
    anticipated_closing_month: monthToDbDate(values.anticipatedClosingMonth),
    client_name: values.clientName.trim(),
    date_of_first_met: values.dateOfFirstMet,
    gender: emptyToNull(values.gender),
    age: numberOrNull(values.age),
    occupation: values.occupation.trim() || null,
    insurer_code: emptyToNull(values.insurer),
    policy_no: values.policyNo.trim() || null,
    plan_name: values.planName.trim() || null,
    payment_term_years: numberOrNull(values.paymentTermYears),
    currency_code: emptyToNull(values.currency),
    premiums: numberOrNull(values.premiums),
    signer_service: emptyToNull(values.signerService),
    sign_date: values.signDate || null,
    submit_date: values.submitDate || null,
  };
}

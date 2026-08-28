export type AccountId = string; // accounts.display_name from Supabase
export type SalesRepId = string; // any Sales Rep display_name
export type UserRole = "Sales Rep" | "CEO" | "Staff";

export type PipelineStatus =
  | "初次接觸"
  | "了解客戶"
  | "簽署SESG"
  | "FNA"
  | "向客提出建議"
  | "申請表格簽署"
  | "申請待審批"
  | "申請簽發"
  | "費用代收"
  | "Counter offer"
  | "拒絕counter offer"
  | "取消"
  | "公司拒絕";

export type Insurer = string;
export type Currency = "HKD" | "USD";
export type Gender = "Male" | "Female";
export type YesNo = "Yes" | "No";

export interface Account {
  id: AccountId;
  name: AccountId;
  role: UserRole;
}

export interface ClientRecord {
  id: string;
  owner: SalesRepId;
  status: PipelineStatus;
  anticipatedClosingMonth: string;
  clientName: string;
  dateOfFirstMet: string;
  gender: Gender | "";
  age: number | "";
  occupation: string;
  insurer: Insurer | "";
  policyNo: string;
  planName: string;
  paymentTermYears: number | "";
  currency: Currency | "";
  premiums: number | "";
  signerService: YesNo | "";
  signDate: string;
  submitDate: string;
  updatedAt: string;
}

export type ClientFormValues = Omit<ClientRecord, "id" | "owner" | "updatedAt">;

export function isUserRole(value: string): value is UserRole {
  return value === "Sales Rep" || value === "CEO" || value === "Staff";
}

/** CEO and Staff can see every sales rep's records */
export function canViewAllRecords(role: UserRole | null | undefined): boolean {
  return role === "CEO" || role === "Staff";
}

/** Staff can manage insurers/plans and create sales accounts */
export function canManagePlans(role: UserRole | null | undefined): boolean {
  return role === "Staff";
}

export function canManageSalesAccounts(role: UserRole | null | undefined): boolean {
  return role === "Staff";
}

export function isSalesRepRole(role: UserRole | null | undefined): boolean {
  return role === "Sales Rep";
}

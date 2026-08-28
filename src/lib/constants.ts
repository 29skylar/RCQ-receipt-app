import type { Currency, PipelineStatus } from "./types";

export const PIPELINE_STATUSES: PipelineStatus[] = [
  "初次接觸",
  "了解客戶",
  "簽署SESG",
  "FNA",
  "向客提出建議",
  "申請表格簽署",
  "申請待審批",
  "申請簽發",
  "費用代收",
  "Counter offer",
  "拒絕counter offer",
  "取消",
  "公司拒絕",
];

export const CURRENCIES: Currency[] = ["HKD", "USD"];

export const EXCHANGE_RATES: Record<Currency, number> = {
  HKD: 1,
  USD: 7.8,
};

export const STORAGE_KEYS = {
  staffTopFunction: "broker-crm-staff-top-function",
  staffShowBoth: "broker-crm-staff-show-both",
} as const;

export type StaffFunctionId = "clients" | "plans" | "sales-accounts";

export const STAFF_FUNCTIONS: { id: StaffFunctionId; label: string; description: string }[] = [
  {
    id: "clients",
    label: "Client records",
    description: "View and update all sales pipeline records",
  },
  {
    id: "plans",
    label: "Insurers & plans",
    description: "Add insurers, bulk-add plans, archive or delete plans",
  },
  {
    id: "sales-accounts",
    label: "Sales accounts",
    description: "Create new sales rep accounts in Supabase",
  },
];

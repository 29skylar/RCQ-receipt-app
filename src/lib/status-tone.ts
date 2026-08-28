import type { PipelineStatus } from "./types";

export function statusTone(status: PipelineStatus): string {
  switch (status) {
    case "初次接觸":
    case "了解客戶":
      return "bg-sky-50 text-sky-800 ring-sky-200";
    case "簽署SESG":
    case "FNA":
    case "向客提出建議":
      return "bg-indigo-50 text-indigo-800 ring-indigo-200";
    case "申請表格簽署":
    case "申請待審批":
    case "申請簽發":
    case "費用代收":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "Counter offer":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "拒絕counter offer":
    case "取消":
    case "公司拒絕":
      return "bg-rose-50 text-rose-800 ring-rose-200";
    default:
      return "bg-slate-50 text-slate-700 ring-slate-200";
  }
}

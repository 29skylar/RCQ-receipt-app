"use client";

import { useCrm } from "@/lib/crm-context";

export function AccountSwitcher() {
  const { currentUser, currentRole, userEmail, visibleRecords, canViewAll, signOut } = useCrm();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-sm font-bold text-white">
            IB
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-slate-900">Insurance Broker CRM</p>
            <p className="text-xs text-slate-500">Pipeline, applications, and client records</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {canViewAll
              ? `${visibleRecords.length} total record${visibleRecords.length === 1 ? "" : "s"}`
              : `${visibleRecords.length} assigned record${visibleRecords.length === 1 ? "" : "s"}`}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <p className="text-sm font-semibold text-slate-900">{currentUser || "—"}</p>
            <p className="text-xs text-slate-500">
              {userEmail ?? "—"}
              {currentRole ? ` · ${currentRole}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}

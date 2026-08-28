"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { STORAGE_KEYS, type StaffFunctionId } from "@/lib/constants";
import { useCrm } from "@/lib/crm-context";
import { calculateHkdPremium, formatCurrency } from "@/lib/format";
import type { ClientFormValues, ClientRecord, PipelineStatus } from "@/lib/types";
import { AccountSwitcher } from "./AccountSwitcher";
import { CeoPremiumSummary } from "./CeoPremiumSummary";
import { ClientFormModal } from "./ClientFormModal";
import { ClientList } from "./ClientList";
import { PlanCatalogPanel } from "./PlanCatalogPanel";
import { SalesAccountsPanel } from "./SalesAccountsPanel";
import { SearchFilters } from "./SearchFilters";
import { StaffWorkspaceSwitcher } from "./StaffWorkspaceSwitcher";
import { StatusUpdateModal } from "./StatusUpdateModal";

function isStaffFunctionId(value: string | null): value is StaffFunctionId {
  return value === "clients" || value === "plans" || value === "sales-accounts";
}

export function Dashboard() {
  const {
    currentUser,
    canViewAll,
    canManagePlanCatalog,
    canManageSalesAccountsCatalog,
    canAddClients,
    isCeo,
    isStaff,
    visibleRecords,
    loading,
    saving,
    error,
    addRecord,
    updateRecord,
    updateStatus,
    refreshRecords,
  } = useCrm();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<PipelineStatus | "all">("all");
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<ClientRecord | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [staffTopFunction, setStaffTopFunction] = useState<StaffFunctionId>("clients");
  const [staffShowOthers, setStaffShowOthers] = useState(true);

  const isStaffWorkspace = canManagePlanCatalog || canManageSalesAccountsCatalog;

  useEffect(() => {
    if (!isStaffWorkspace) return;
    const storedTop = window.localStorage.getItem(STORAGE_KEYS.staffTopFunction);
    const storedOthers = window.localStorage.getItem(STORAGE_KEYS.staffShowBoth);
    if (isStaffFunctionId(storedTop)) setStaffTopFunction(storedTop);
    if (storedOthers === "true" || storedOthers === "false") {
      setStaffShowOthers(storedOthers === "true");
    }
  }, [isStaffWorkspace]);

  useEffect(() => {
    if (!isStaffWorkspace) return;
    window.localStorage.setItem(STORAGE_KEYS.staffTopFunction, staffTopFunction);
    window.localStorage.setItem(STORAGE_KEYS.staffShowBoth, String(staffShowOthers));
  }, [isStaffWorkspace, staffShowOthers, staffTopFunction]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return visibleRecords.filter((record) => {
      const matchesStatus = status === "all" || record.status === status;
      const matchesQuery =
        !needle ||
        record.clientName.toLowerCase().includes(needle) ||
        record.policyNo.toLowerCase().includes(needle);
      return matchesStatus && matchesQuery;
    });
  }, [visibleRecords, query, status]);

  const pipelineValue = filtered.reduce(
    (sum, record) => sum + calculateHkdPremium(record.premiums, record.currency),
    0,
  );

  function openCreate() {
    setSelected(null);
    setFormMode("create");
    setFormOpen(true);
  }

  function openEdit(record: ClientRecord) {
    setSelected(record);
    setFormMode("edit");
    setFormOpen(true);
  }

  async function handleFormSubmit(values: ClientFormValues) {
    if (formMode === "edit" && selected) {
      await updateRecord(selected.id, values);
    } else {
      await addRecord(values);
    }
    setFormOpen(false);
    setSelected(null);
  }

  const subtitle = isStaffWorkspace
    ? "Staff view: pick which function sits at the top. You can show one or all sections."
    : canViewAll
      ? "CEO view: all sales rep records are visible. Record owners are unchanged when editing."
      : `Only records owned by ${currentUser} are shown. New clients are assigned to this account automatically.`;

  const showClients = !isStaffWorkspace || staffShowOthers || staffTopFunction === "clients";
  const showPlans =
    canManagePlanCatalog && (staffShowOthers || staffTopFunction === "plans");
  const showSalesAccounts =
    canManageSalesAccountsCatalog &&
    (staffShowOthers || staffTopFunction === "sales-accounts");

  const clientsSection = showClients ? (
    <section key="clients">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Client records</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refreshRecords()}
            disabled={loading || saving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Refresh
          </button>
          {canAddClients ? (
            <button
              type="button"
              onClick={openCreate}
              disabled={loading || saving}
              className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
            >
              Add New Client
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <p className="font-medium">Supabase error</p>
          <p className="mt-1">{error}</p>
          <p className="mt-2 text-xs text-rose-700">
            If this mentions RLS or permission denied, run{" "}
            <code className="rounded bg-rose-100 px-1">supabase/rls-prototype.sql</code> and{" "}
            <code className="rounded bg-rose-100 px-1">supabase/add-staff-account.sql</code> in the
            Supabase SQL Editor.
          </p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <StatCard
          label={canViewAll ? "All records" : "My records"}
          value={loading ? "…" : String(visibleRecords.length)}
        />
        <StatCard label="Showing" value={loading ? "…" : String(filtered.length)} />
        <StatCard
          label="HKD premium (shown)"
          value={loading ? "…" : formatCurrency(pipelineValue)}
        />
      </div>

      <div className="mt-6">
        <SearchFilters
          query={query}
          status={status}
          onQueryChange={setQuery}
          onStatusChange={setStatus}
        />
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
            <p className="text-sm font-medium text-slate-800">Loading...</p>
            <p className="mt-1 text-sm text-slate-500">Fetching client records from Supabase.</p>
          </div>
        ) : (
          <ClientList
            records={filtered}
            showOwner={canViewAll}
            onEdit={openEdit}
            onUpdateStatus={(record) => {
              setSelected(record);
              setStatusOpen(true);
            }}
          />
        )}
      </div>

      {isStaff ? (
        <p className="mt-3 text-xs text-slate-500">
          Tip: create sales accounts under Sales accounts so new reps can log records under their
          own name.
        </p>
      ) : null}
    </section>
  ) : null;

  const plansSection = showPlans ? <PlanCatalogPanel key="plans" /> : null;
  const salesAccountsSection = showSalesAccounts ? (
    <SalesAccountsPanel key="sales-accounts" />
  ) : null;

  const orderedSections = (() => {
    const sections: Record<StaffFunctionId, ReactNode> = {
      clients: clientsSection,
      plans: plansSection,
      "sales-accounts": salesAccountsSection,
    };
    const order: StaffFunctionId[] = ["clients", "plans", "sales-accounts"];
    const rest = order.filter((id) => id !== staffTopFunction);
    return [sections[staffTopFunction], ...rest.map((id) => sections[id])].filter(Boolean);
  })();

  return (
    <div className="min-h-screen bg-slate-50">
      <AccountSwitcher />
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6">
        {isStaffWorkspace ? (
          <StaffWorkspaceSwitcher
            topFunction={staffTopFunction}
            showOthers={staffShowOthers}
            onTopFunctionChange={setStaffTopFunction}
            onShowOthersChange={setStaffShowOthers}
          />
        ) : null}

        {isCeo ? <CeoPremiumSummary records={visibleRecords} loading={loading} /> : null}

        {isStaffWorkspace ? orderedSections : clientsSection}
      </main>

      <ClientFormModal
        open={formOpen}
        mode={formMode}
        record={formMode === "edit" ? selected : null}
        saving={saving}
        onClose={() => setFormOpen(false)}
        onSubmit={handleFormSubmit}
      />
      <StatusUpdateModal
        open={statusOpen}
        record={selected}
        saving={saving}
        onClose={() => setStatusOpen(false)}
        onSubmit={async (nextStatus) => {
          if (selected) await updateStatus(selected.id, nextStatus);
          setStatusOpen(false);
        }}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

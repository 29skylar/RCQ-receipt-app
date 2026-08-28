"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  addInsurancePlans,
  addInsurer,
  deleteInsurancePlan,
  fetchActiveInsurers,
  fetchAllPlans,
  setPlanActive,
} from "@/lib/supabase/client-records";
import type { InsurancePlanRow, InsurerRow } from "@/lib/supabase/db-types";

function parsePlanLines(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ];
}

export function PlanCatalogPanel() {
  const [insurers, setInsurers] = useState<InsurerRow[]>([]);
  const [plans, setPlans] = useState<InsurancePlanRow[]>([]);
  const [filterInsurer, setFilterInsurer] = useState("");
  const [newInsurerCode, setNewInsurerCode] = useState("");
  const [newInsurerName, setNewInsurerName] = useState("");
  const [planInsurer, setPlanInsurer] = useState("");
  const [planLines, setPlanLines] = useState("");
  const [showArchived, setShowArchived] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const parsedPlanCount = useMemo(() => parsePlanLines(planLines).length, [planLines]);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [insurerRows, planRows] = await Promise.all([
        fetchActiveInsurers(),
        fetchAllPlans(filterInsurer || undefined),
      ]);
      setInsurers(insurerRows);
      setPlans(planRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load plan catalog");
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, [filterInsurer]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const visiblePlans = useMemo(
    () => (showArchived ? plans : plans.filter((plan) => plan.is_active)),
    [plans, showArchived],
  );

  async function handleAddInsurer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newInsurerCode.trim()) return;

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const created = await addInsurer(newInsurerCode, newInsurerName || newInsurerCode);
      setNewInsurerCode("");
      setNewInsurerName("");
      setPlanInsurer(created.code);
      setMessage(`Insurer “${created.code}” added. You can add plans for it below.`);
      await loadCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add insurer");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddPlans(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const names = parsePlanLines(planLines);
    if (!planInsurer || names.length === 0) return;

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const created = await addInsurancePlans(planInsurer, names);
      setPlanLines("");
      setMessage(
        created.length === 1
          ? "1 plan added. It will appear in sales forms immediately."
          : `${created.length} plans added. They will appear in sales forms immediately.`,
      );
      await loadCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add plans");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveToggle(plan: InsurancePlanRow) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const nextActive = !plan.is_active;
      await setPlanActive(plan.id, nextActive);
      setMessage(
        nextActive
          ? `Restored “${plan.plan_name}” to the active list.`
          : `Archived “${plan.plan_name}”. Existing client records keep this plan name.`,
      );
      await loadCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update plan");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePlan(plan: InsurancePlanRow) {
    const confirmed = window.confirm(
      `Delete “${plan.plan_name}” permanently from the catalog?\n\n` +
        "This cannot be undone. Existing client records will keep the plan name text, " +
        "but it will no longer appear in dropdowns.\n\n" +
        "Prefer Archive if you only want to hide it for now.",
    );
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await deleteInsurancePlan(plan.id);
      setMessage(`Deleted “${plan.plan_name}” from the catalog.`);
      await loadCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Insurer & plan catalog</h2>
          <p className="mt-1 text-sm text-slate-500">
            Staff can add insurers, bulk-add plans, archive, or permanently delete plans. Archive
            hides a plan from sales dropdowns; Delete removes it from the catalog. Existing client
            records keep their saved plan name either way.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadCatalog()}
          disabled={loading || saving}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Refresh catalog
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <form
          onSubmit={handleAddInsurer}
          className="rounded-xl border border-slate-100 bg-slate-50 p-4"
        >
          <h3 className="text-sm font-semibold text-slate-800">Add insurer</h3>
          <p className="mt-1 text-xs text-slate-500">
            Code is used in the dropdown (e.g. AIA). Display name is optional.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-slate-700">Code *</span>
              <input
                required
                value={newInsurerCode}
                onChange={(event) => setNewInsurerCode(event.target.value)}
                placeholder="e.g. Prudential"
                className={inputClass}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-slate-700">Display name</span>
              <input
                value={newInsurerName}
                onChange={(event) => setNewInsurerName(event.target.value)}
                placeholder="Optional"
                className={inputClass}
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving || !newInsurerCode.trim()}
            className="mt-3 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add insurer"}
          </button>
        </form>

        <form
          onSubmit={handleAddPlans}
          className="rounded-xl border border-slate-100 bg-slate-50 p-4"
        >
          <h3 className="text-sm font-semibold text-slate-800">Add plans (bulk)</h3>
          <p className="mt-1 text-xs text-slate-500">
            Choose an insurer, then enter one plan name per line.
          </p>
          <label className="mt-3 block text-sm">
            <span className="mb-1.5 block font-medium text-slate-700">Insurer *</span>
            <select
              required
              value={planInsurer}
              onChange={(event) => setPlanInsurer(event.target.value)}
              className={inputClass}
            >
              <option value="">Select insurer</option>
              {insurers.map((insurer) => (
                <option key={insurer.code} value={insurer.code}>
                  {insurer.name || insurer.code}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-3 block text-sm">
            <span className="mb-1.5 flex items-baseline justify-between font-medium text-slate-700">
              Plan names *
              <span className="text-xs font-normal text-slate-400">
                {parsedPlanCount} plan{parsedPlanCount === 1 ? "" : "s"} detected
              </span>
            </span>
            <textarea
              required
              rows={5}
              value={planLines}
              onChange={(event) => setPlanLines(event.target.value)}
              placeholder={"AIA 環宇盈活儲蓄保險計劃-整付\nAIA 盈御多元貨幣計劃3-5年繳\nAIA 新計劃示例"}
              className={`${inputClass} resize-y`}
            />
          </label>
          <button
            type="submit"
            disabled={saving || !planInsurer || parsedPlanCount === 0}
            className="mt-3 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : parsedPlanCount > 1
                ? `Add ${parsedPlanCount} plans`
                : "Add plan"}
          </button>
        </form>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span className="font-medium text-slate-700">Filter</span>
          <select
            value={filterInsurer}
            onChange={(event) => setFilterInsurer(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
          >
            <option value="">All insurers</option>
            {insurers.map((insurer) => (
              <option key={insurer.code} value={insurer.code}>
                {insurer.code}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
            className="rounded border-slate-300"
          />
          Show archived plans
        </label>
      </div>

      {error ? (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Loading plans...</p>
        ) : visiblePlans.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">No plans found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Insurer</th>
                  <th className="px-4 py-3 font-medium">Plan name</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visiblePlans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-800">{plan.insurer_code}</td>
                    <td className="px-4 py-3 text-slate-700">{plan.plan_name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                          plan.is_active
                            ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                            : "bg-slate-100 text-slate-600 ring-slate-200"
                        }`}
                      >
                        {plan.is_active ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleArchiveToggle(plan)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                        >
                          {plan.is_active ? "Archive" : "Restore"}
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleDeletePlan(plan)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-teal-500/30 focus:border-teal-500 focus:ring-4";

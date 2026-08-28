"use client";

import { useMemo } from "react";
import { calculateHkdPremium, formatCurrency } from "@/lib/format";
import type { ClientRecord } from "@/lib/types";

interface PremiumRow {
  label: string;
  total: number;
  count: number;
}

function aggregateBy(
  records: ClientRecord[],
  getKey: (record: ClientRecord) => string,
): PremiumRow[] {
  const totals = new Map<string, { total: number; count: number }>();

  for (const record of records) {
    const key = getKey(record);
    const premium = calculateHkdPremium(record.premiums, record.currency);
    const existing = totals.get(key) ?? { total: 0, count: 0 };
    totals.set(key, {
      total: existing.total + premium,
      count: existing.count + 1,
    });
  }

  return [...totals.entries()]
    .map(([label, { total, count }]) => ({ label, total, count }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

function SummaryTable({
  title,
  rows,
  loading,
}: {
  title: string;
  rows: PremiumRow[];
  loading: boolean;
}) {
  const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          HKD premium total: {loading ? "…" : formatCurrency(grandTotal)}
        </p>
      </div>
      {loading ? (
        <p className="px-4 py-6 text-sm text-slate-500 sm:px-5">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-slate-500 sm:px-5">No records yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-medium sm:px-5">Name</th>
                <th className="px-4 py-2.5 font-medium text-right sm:px-5">Records</th>
                <th className="px-4 py-2.5 font-medium text-right sm:px-5">HKD premium</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.label} className="hover:bg-slate-50/80">
                  <td className="px-4 py-2.5 font-medium text-slate-900 sm:px-5">{row.label}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600 sm:px-5">{row.count}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-900 sm:px-5">
                    {formatCurrency(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function CeoPremiumSummary({
  records,
  loading,
}: {
  records: ClientRecord[];
  loading: boolean;
}) {
  const byInsurer = useMemo(
    () => aggregateBy(records, (record) => record.insurer || "No insurer"),
    [records],
  );

  const bySalesRep = useMemo(
    () => aggregateBy(records, (record) => record.owner),
    [records],
  );

  const totalPremium = useMemo(
    () =>
      records.reduce(
        (sum, record) => sum + calculateHkdPremium(record.premiums, record.currency),
        0,
      ),
    [records],
  );

  return (
    <section className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50/80 via-white to-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Premium overview</h2>
          <p className="mt-1 text-sm text-slate-500">
            Pipeline progress across all sales reps and insurers.
          </p>
        </div>
        <div className="rounded-xl border border-teal-200 bg-white px-4 py-3 text-right shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total HKD premium</p>
          <p className="mt-0.5 text-xl font-semibold text-teal-800">
            {loading ? "…" : formatCurrency(totalPremium)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SummaryTable title="By insurer" rows={byInsurer} loading={loading} />
        <SummaryTable title="By sales rep" rows={bySalesRep} loading={loading} />
      </div>
    </section>
  );
}

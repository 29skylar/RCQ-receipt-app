"use client";

import { calculateHkdPremium, formatCurrency, formatIsoDateToDisplay, formatMonthYear } from "@/lib/format";
import { statusTone } from "@/lib/status-tone";
import type { ClientRecord } from "@/lib/types";

interface ClientListProps {
  records: ClientRecord[];
  showOwner?: boolean;
  onEdit: (record: ClientRecord) => void;
  onUpdateStatus: (record: ClientRecord) => void;
}

export function ClientList({ records, showOwner = false, onEdit, onUpdateStatus }: ClientListProps) {
  if (records.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
        <p className="text-sm font-medium text-slate-800">No matching client records</p>
        <p className="mt-1 text-sm text-slate-500">Try another search, or add a new client for this account.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {records.map((record) => (
          <article key={record.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-900">{record.clientName}</h3>
                <p className="text-xs text-slate-500">
                  {record.policyNo || "No policy no."} · {record.insurer || "No insurer"}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${statusTone(record.status)}`}>
                {record.status}
              </span>
            </div>
            <p className="mt-3 line-clamp-2 text-sm text-slate-600">{record.planName || "Plan not selected"}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
              <div>
                <dt>Close</dt>
                <dd className="font-medium text-slate-800">{formatMonthYear(record.anticipatedClosingMonth)}</dd>
              </div>
              <div>
                <dt>HKD Premium</dt>
                <dd className="font-medium text-slate-800">
                  {record.premiums === "" || !record.currency
                    ? "—"
                    : formatCurrency(calculateHkdPremium(record.premiums, record.currency))}
                </dd>
              </div>
              <div>
                <dt>First met</dt>
                <dd className="font-medium text-slate-800">{formatIsoDateToDisplay(record.dateOfFirstMet)}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd className="font-medium text-slate-800">{record.owner}</dd>
              </div>
            </dl>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => onEdit(record)}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
              >
                Edit Record
              </button>
              <button
                type="button"
                onClick={() => onUpdateStatus(record)}
                className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white"
              >
                Update Status
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Client</th>
                {showOwner ? <th className="px-4 py-3 font-medium">Owner</th> : null}
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Close</th>
                <th className="px-4 py-3 font-medium">Policy No.</th>
                <th className="px-4 py-3 font-medium">Insurer / Plan</th>
                <th className="px-4 py-3 font-medium">HKD Premium</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{record.clientName}</div>
                    <div className="text-xs text-slate-500">
                      {[record.gender || null, record.age !== "" ? record.age : null]
                        .filter(Boolean)
                        .join(" · ") || "Details pending"}
                      {" · first met "}
                      {formatIsoDateToDisplay(record.dateOfFirstMet)}
                    </div>
                  </td>
                  {showOwner ? (
                    <td className="px-4 py-3 text-slate-700">{record.owner}</td>
                  ) : null}
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusTone(record.status)}`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{formatMonthYear(record.anticipatedClosingMonth)}</td>
                  <td className="px-4 py-3 text-slate-700">{record.policyNo || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{record.insurer || "—"}</div>
                    <div className="max-w-[240px] truncate text-xs text-slate-500">{record.planName || "—"}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {record.premiums === "" || !record.currency
                      ? "—"
                      : formatCurrency(calculateHkdPremium(record.premiums, record.currency))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(record)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
                      >
                        Edit Record
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateStatus(record)}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                      >
                        Update Status
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

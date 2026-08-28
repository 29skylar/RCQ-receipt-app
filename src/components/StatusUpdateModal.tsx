"use client";

import { FormEvent, useEffect, useState } from "react";
import { PIPELINE_STATUSES } from "@/lib/constants";
import type { ClientRecord, PipelineStatus } from "@/lib/types";

interface StatusUpdateModalProps {
  open: boolean;
  record?: ClientRecord | null;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (status: PipelineStatus) => Promise<void>;
}

export function StatusUpdateModal({
  open,
  record,
  saving = false,
  onClose,
  onSubmit,
}: StatusUpdateModalProps) {
  const [status, setStatus] = useState<PipelineStatus>("初次接觸");
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (open && record) {
      setStatus(record.status);
      setSubmitError(null);
    }
  }, [open, record]);

  if (!open || !record) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSubmitError(null);
    try {
      await onSubmit(status);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6"
      >
        <h2 className="text-lg font-semibold text-slate-900">Update Status</h2>
        <p className="mt-1 text-sm text-slate-500">
          {record.clientName}
          {record.policyNo ? ` · ${record.policyNo}` : ""}
        </p>
        <label className="mt-5 block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">Pipeline status</span>
          <select
            value={status}
            disabled={saving}
            onChange={(event) => setStatus(event.target.value as PipelineStatus)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-teal-500/30 focus:border-teal-500 focus:ring-4 disabled:opacity-50"
          >
            {PIPELINE_STATUSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        {submitError ? (
          <p className="mt-3 text-sm text-rose-600">{submitError}</p>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Update Status"}
          </button>
        </div>
      </form>
    </div>
  );
}

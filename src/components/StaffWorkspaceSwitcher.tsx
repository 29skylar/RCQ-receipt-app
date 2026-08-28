"use client";

import { STAFF_FUNCTIONS, type StaffFunctionId } from "@/lib/constants";

interface StaffWorkspaceSwitcherProps {
  topFunction: StaffFunctionId;
  showOthers: boolean;
  onTopFunctionChange: (value: StaffFunctionId) => void;
  onShowOthersChange: (value: boolean) => void;
}

export function StaffWorkspaceSwitcher({
  topFunction,
  showOthers,
  onTopFunctionChange,
  onShowOthersChange,
}: StaffWorkspaceSwitcherProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Staff workspace</p>
          <p className="mt-0.5 text-sm text-slate-500">
            Choose which function appears at the top of the page.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showOthers}
            onChange={(event) => onShowOthersChange(event.target.checked)}
            className="rounded border-slate-300"
          />
          Also show the other sections below
        </label>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {STAFF_FUNCTIONS.map((item) => {
          const selected = topFunction === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTopFunctionChange(item.id)}
              className={`rounded-xl border px-4 py-3 text-left transition ${
                selected
                  ? "border-teal-500 bg-teal-50 ring-4 ring-teal-500/15"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900">{item.label}</span>
                {selected ? (
                  <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[11px] font-medium text-white">
                    Top
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-slate-500">{item.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { PIPELINE_STATUSES } from "@/lib/constants";
import type { PipelineStatus } from "@/lib/types";

interface SearchFiltersProps {
  query: string;
  status: PipelineStatus | "all";
  onQueryChange: (value: string) => void;
  onStatusChange: (value: PipelineStatus | "all") => void;
}

export function SearchFilters({
  query,
  status,
  onQueryChange,
  onStatusChange,
}: SearchFiltersProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
      <label className="relative block">
        <span className="sr-only">Search by client name or policy number</span>
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search by client name or policy no."
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-teal-500/30 placeholder:text-slate-400 focus:border-teal-500 focus:ring-4"
        />
      </label>
      <label>
        <span className="sr-only">Filter by status</span>
        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value as PipelineStatus | "all")}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-teal-500/30 focus:border-teal-500 focus:ring-4"
        >
          <option value="all">All statuses</option>
          {PIPELINE_STATUSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

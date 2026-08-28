"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import { CURRENCIES, PIPELINE_STATUSES } from "@/lib/constants";
import { calculateHkdPremium, formatCurrency, formatExchangeRate } from "@/lib/format";
import {
  fetchActiveInsurers,
  fetchActivePlansByInsurer,
} from "@/lib/supabase/client-records";
import type { InsurerRow } from "@/lib/supabase/db-types";
import type { ClientFormValues, ClientRecord, Currency, Gender, YesNo } from "@/lib/types";

const EMPTY_FORM: ClientFormValues = {
  status: "初次接觸",
  anticipatedClosingMonth: "",
  clientName: "",
  dateOfFirstMet: "",
  gender: "",
  age: "",
  occupation: "",
  insurer: "",
  policyNo: "",
  planName: "",
  paymentTermYears: "",
  currency: "",
  premiums: "",
  signerService: "",
  signDate: "",
  submitDate: "",
};

interface ClientFormModalProps {
  open: boolean;
  mode: "create" | "edit";
  record?: ClientRecord | null;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (values: ClientFormValues) => Promise<void>;
}

function toFormValues(record: ClientRecord): ClientFormValues {
  return {
    status: record.status,
    anticipatedClosingMonth: record.anticipatedClosingMonth,
    clientName: record.clientName,
    dateOfFirstMet: record.dateOfFirstMet,
    gender: record.gender,
    age: record.age,
    occupation: record.occupation,
    insurer: record.insurer,
    policyNo: record.policyNo,
    planName: record.planName,
    paymentTermYears: record.paymentTermYears,
    currency: record.currency,
    premiums: record.premiums,
    signerService: record.signerService,
    signDate: record.signDate,
    submitDate: record.submitDate,
  };
}

export function ClientFormModal({
  open,
  mode,
  record,
  saving = false,
  onClose,
  onSubmit,
}: ClientFormModalProps) {
  const [values, setValues] = useState<ClientFormValues>(EMPTY_FORM);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [insurers, setInsurers] = useState<InsurerRow[]>([]);
  const [planOptions, setPlanOptions] = useState<string[]>([]);
  const [loadingInsurers, setLoadingInsurers] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Reset form values when modal opens
  useEffect(() => {
    if (!open) return;
    setValues(record ? toFormValues(record) : EMPTY_FORM);
    setSubmitError(null);
    setCatalogError(null);
    setPlanOptions([]);
  }, [open, record]);

  // 1) Fetch active insurers when the form loads
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    async function loadInsurers() {
      setLoadingInsurers(true);
      setCatalogError(null);
      try {
        const rows = await fetchActiveInsurers();
        if (!cancelled) setInsurers(rows);
      } catch (err) {
        if (!cancelled) {
          setInsurers([]);
          setCatalogError(err instanceof Error ? err.message : "Failed to load insurers");
        }
      } finally {
        if (!cancelled) setLoadingInsurers(false);
      }
    }

    void loadInsurers();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // 2) When insurer is selected (or edit opens with an insurer), fetch matching plans
  useEffect(() => {
    if (!open) return;

    const insurerCode = values.insurer;
    if (!insurerCode) {
      setPlanOptions([]);
      setLoadingPlans(false);
      return;
    }

    let cancelled = false;
    async function loadPlans() {
      setLoadingPlans(true);
      setCatalogError(null);
      try {
        const rows = await fetchActivePlansByInsurer(insurerCode);
        if (cancelled) return;

        const names = rows.map((row) => row.plan_name);
        const currentPlan = values.planName;
        setPlanOptions(
          currentPlan && !names.includes(currentPlan) ? [currentPlan, ...names] : names,
        );
      } catch (err) {
        if (!cancelled) {
          setPlanOptions((prev) => (values.planName ? [values.planName] : prev));
          setCatalogError(err instanceof Error ? err.message : "Failed to load plans");
        }
      } finally {
        if (!cancelled) setLoadingPlans(false);
      }
    }

    void loadPlans();
    return () => {
      cancelled = true;
    };
    // Fetch only when insurer changes — not when the user picks a plan
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [open, values.insurer]);

  const exRate = formatExchangeRate(values.currency);
  const hkdPremium = useMemo(
    () => calculateHkdPremium(values.premiums, values.currency),
    [values.currency, values.premiums],
  );

  if (!open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!values.status || !values.clientName.trim() || !values.dateOfFirstMet) return;
    setSubmitError(null);
    try {
      await onSubmit({
        ...values,
        clientName: values.clientName.trim(),
        occupation: values.occupation.trim(),
        policyNo: values.policyNo.trim(),
      });
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save to Supabase");
    }
  }

  function update<K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleInsurerChange(next: string) {
    setValues((prev) => ({ ...prev, insurer: next, planName: "" }));
    setPlanOptions([]);
  }

  const planPlaceholder = !values.insurer
    ? "Select an insurer first"
    : loadingPlans
      ? "Loading plans..."
      : planOptions.length
        ? "Select plan name"
        : "No active plans for this insurer";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {mode === "create" ? "Add New Client" : "Edit Record"}
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Insurer and plan lists load from Supabase. Only status, client name, and first met date are required.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-5 py-5 sm:px-6">
          <section className="space-y-4">
            <SectionTitle>Pipeline Status & Timing</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Status" required>
                <select
                  required
                  value={values.status}
                  onChange={(event) => update("status", event.target.value as ClientFormValues["status"])}
                  className={inputClass}
                >
                  {PIPELINE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Anticipated Closing Month" hint="Optional · Jan 2026">
                <input
                  type="month"
                  value={values.anticipatedClosingMonth}
                  onChange={(event) => update("anticipatedClosingMonth", event.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </section>

          <section className="mt-8 space-y-4">
            <SectionTitle>Client Information</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name of client" required className="sm:col-span-2">
                <input
                  required
                  value={values.clientName}
                  onChange={(event) => update("clientName", event.target.value)}
                  className={inputClass}
                  placeholder="e.g. Chan Tai Man"
                />
              </Field>
              <Field label="Date of first met" required hint="DD/MM/YYYY">
                <input
                  type="date"
                  required
                  value={values.dateOfFirstMet}
                  onChange={(event) => update("dateOfFirstMet", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Gender">
                <select
                  value={values.gender}
                  onChange={(event) => update("gender", event.target.value as Gender | "")}
                  className={inputClass}
                >
                  <option value="">—</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </Field>
              <Field label="Age">
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={values.age}
                  onChange={(event) =>
                    update("age", event.target.value === "" ? "" : Number(event.target.value))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Occupation">
                <input
                  value={values.occupation}
                  onChange={(event) => update("occupation", event.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </section>

          <section className="mt-8 space-y-4">
            <SectionTitle>Application Information</SectionTitle>
            {catalogError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {catalogError}
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Policy No.">
                <input
                  value={values.policyNo}
                  onChange={(event) => update("policyNo", event.target.value)}
                  className={inputClass}
                  placeholder="Optional until issued"
                />
              </Field>
              <Field label="Insurer">
                <select
                  value={values.insurer}
                  disabled={loadingInsurers}
                  onChange={(event) => handleInsurerChange(event.target.value)}
                  className={`${inputClass} disabled:cursor-not-allowed disabled:bg-slate-50`}
                >
                  <option value="">
                    {loadingInsurers ? "Loading insurers..." : "Select insurer"}
                  </option>
                  {insurers.map((insurer) => (
                    <option key={insurer.code} value={insurer.code}>
                      {insurer.name || insurer.code}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Plan Name" className="sm:col-span-2">
                <select
                  disabled={!values.insurer || loadingPlans}
                  value={values.planName}
                  onChange={(event) => update("planName", event.target.value)}
                  className={`${inputClass} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`}
                >
                  <option value="">{planPlaceholder}</option>
                  {planOptions.map((plan) => (
                    <option key={plan} value={plan}>
                      {plan}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Payment Term (Years)">
                <input
                  type="number"
                  min={1}
                  value={values.paymentTermYears}
                  onChange={(event) =>
                    update(
                      "paymentTermYears",
                      event.target.value === "" ? "" : Number(event.target.value),
                    )
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Currency">
                <select
                  value={values.currency}
                  onChange={(event) => update("currency", event.target.value as Currency | "")}
                  className={inputClass}
                >
                  <option value="">—</option>
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ex Rate">
                <input readOnly value={exRate} className={`${inputClass} bg-slate-50 text-slate-600`} />
              </Field>
              <Field label="Premiums (Original Currency)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={values.premiums}
                  onChange={(event) =>
                    update("premiums", event.target.value === "" ? "" : Number(event.target.value))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="HKD Premium" className="sm:col-span-2">
                <input
                  readOnly
                  value={
                    values.currency && values.premiums !== ""
                      ? formatCurrency(hkdPremium, "HKD")
                      : "—"
                  }
                  className={`${inputClass} bg-teal-50 font-semibold text-teal-800`}
                />
              </Field>
              <Field label="簽單員服務 (Y/N)" className="sm:col-span-2">
                <div className="flex gap-3">
                  {(["", "Yes", "No"] as const).map((option) => (
                    <label
                      key={option || "blank"}
                      className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium ${
                        values.signerService === option
                          ? "border-teal-500 bg-teal-50 text-teal-800"
                          : "border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      <input
                        type="radio"
                        name="signerService"
                        className="sr-only"
                        checked={values.signerService === option}
                        onChange={() => update("signerService", option as YesNo | "")}
                      />
                      {option || "—"}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Sign date" hint="DD/MM/YYYY">
                <input
                  type="date"
                  value={values.signDate}
                  onChange={(event) => update("signDate", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Submit date" hint="DD/MM/YYYY">
                <input
                  type="date"
                  value={values.submitDate}
                  onChange={(event) => update("submitDate", event.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          </section>

          {submitError ? (
            <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {submitError}
            </div>
          ) : null}

          <div className="mt-8 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
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
              className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : mode === "create" ? "Save Client" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <h3 className="text-sm font-semibold tracking-wide text-slate-800">{children}</h3>;
}

function Field({
  label,
  hint,
  required,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-slate-700">
        <span>
          {label}
          {required ? <span className="ml-1 text-rose-500">*</span> : null}
        </span>
        {hint ? <span className="text-xs font-normal text-slate-400">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-teal-500/30 focus:border-teal-500 focus:ring-4";

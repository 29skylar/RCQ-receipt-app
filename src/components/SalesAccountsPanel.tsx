"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useCrm } from "@/lib/crm-context";
import { fetchAllAccounts, setSalesAccountActive } from "@/lib/supabase/client-records";
import type { AccountRow } from "@/lib/supabase/db-types";

interface EditFormState {
  displayName: string;
  email: string;
  password: string;
}

export function SalesAccountsPanel() {
  const { refreshRecords } = useCrm();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editingAccount, setEditingAccount] = useState<AccountRow | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    displayName: "",
    email: "",
    password: "",
  });

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchAllAccounts();
      setAccounts(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const salesAccounts = useMemo(
    () =>
      accounts
        .filter((account) => account.role === "Sales Rep")
        .filter((account) => showInactive || account.is_active),
    [accounts, showInactive],
  );

  function openEdit(account: AccountRow) {
    setEditingAccount(account);
    setEditForm({
      displayName: account.display_name,
      email: account.email ?? "",
      password: "",
    });
    setError(null);
    setMessage(null);
  }

  function closeEdit() {
    setEditingAccount(null);
    setEditForm({ displayName: "", email: "", password: "" });
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!displayName.trim() || !email.trim() || !password) return;

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          email: email.trim(),
          password,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        account?: AccountRow;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create sales account");
      }

      setDisplayName("");
      setEmail("");
      setPassword("");
      setMessage(
        `Sales account “${payload.account?.display_name ?? displayName}” created. They can sign in with their email and password.`,
      );
      await Promise.all([loadAccounts(), refreshRecords()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create sales account");
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAccount || !editForm.displayName.trim() || !editForm.email.trim()) return;

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/accounts/${editingAccount.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: editForm.displayName.trim(),
          email: editForm.email.trim(),
          ...(editForm.password ? { password: editForm.password } : {}),
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        account?: AccountRow;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to update sales account");
      }

      closeEdit();
      setMessage(`Sales account “${payload.account?.display_name ?? editForm.displayName}” updated.`);
      await Promise.all([loadAccounts(), refreshRecords()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update sales account");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(account: AccountRow) {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const next = !account.is_active;
      await setSalesAccountActive(account.id, next);
      setMessage(
        next
          ? `Reactivated “${account.display_name}”.`
          : `Deactivated “${account.display_name}”. They can no longer sign in to the CRM.`,
      );
      await Promise.all([loadAccounts(), refreshRecords()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update account");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Sales accounts</h2>
          <p className="mt-1 text-sm text-slate-500">
            Create and edit sales rep logins. Each account has a name, email, and password for sign-in.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadAccounts()}
          disabled={loading || saving}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Refresh accounts
        </button>
      </div>

      <form
        onSubmit={handleCreate}
        className="mt-5 grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2"
      >
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-700">Name *</span>
          <input
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="e.g. TR-Michael Chan"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-teal-500/30 focus:border-teal-500 focus:ring-4"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium text-slate-700">Email *</span>
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="michael.chan@company.com"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-teal-500/30 focus:border-teal-500 focus:ring-4"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1.5 block font-medium text-slate-700">Password *</span>
          <input
            required
            type="password"
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 6 characters"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-teal-500/30 focus:border-teal-500 focus:ring-4"
          />
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={saving || !displayName.trim() || !email.trim() || !password}
            className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Create sales account"}
          </button>
        </div>
      </form>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          {salesAccounts.length} sales account{salesAccounts.length === 1 ? "" : "s"}
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(event) => setShowInactive(event.target.checked)}
            className="rounded border-slate-300"
          />
          Show deactivated
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
          <p className="px-4 py-8 text-center text-sm text-slate-500">Loading accounts...</p>
        ) : salesAccounts.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">No sales accounts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-medium text-slate-900">{account.display_name}</td>
                    <td className="px-4 py-3 text-slate-600">{account.email ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                          account.is_active
                            ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                            : "bg-slate-100 text-slate-600 ring-slate-200"
                        }`}
                      >
                        {account.is_active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => openEdit(account)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void handleToggleActive(account)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-50"
                        >
                          {account.is_active ? "Deactivate" : "Reactivate"}
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

      {editingAccount ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Edit sales account</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Update name, email, or password for {editingAccount.display_name}.
                </p>
              </div>
              <button
                type="button"
                onClick={closeEdit}
                className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-500 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleEdit} className="space-y-4">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-slate-700">Name *</span>
                <input
                  required
                  value={editForm.displayName}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, displayName: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-teal-500/30 focus:border-teal-500 focus:ring-4"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-slate-700">Email *</span>
                <input
                  required
                  type="email"
                  value={editForm.email}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-teal-500/30 focus:border-teal-500 focus:ring-4"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1.5 block font-medium text-slate-700">New password</span>
                <input
                  type="password"
                  minLength={6}
                  value={editForm.password}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                  placeholder="Leave blank to keep current password"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-teal-500/30 focus:border-teal-500 focus:ring-4"
                />
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !editForm.displayName.trim() || !editForm.email.trim()}
                  className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

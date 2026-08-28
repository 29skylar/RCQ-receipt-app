"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import type {
  AccountId,
  ClientFormValues,
  ClientRecord,
  PipelineStatus,
  UserRole,
} from "./types";
import {
  canManagePlans,
  canManageSalesAccounts,
  canViewAllRecords,
  isSalesRepRole,
  isUserRole,
} from "./types";
import { createClient } from "./supabase/browser";
import {
  fetchAccountByAuthUserId,
  fetchClientRecords,
  insertClientRecord,
  updateClientRecord,
  updateClientStatus,
} from "./supabase/client-records";
import type { AccountRow } from "./supabase/db-types";

interface CrmContextValue {
  currentUser: AccountId;
  currentRole: UserRole | null;
  userEmail: string | null;
  isCeo: boolean;
  isStaff: boolean;
  canViewAll: boolean;
  canManagePlanCatalog: boolean;
  canManageSalesAccountsCatalog: boolean;
  canAddClients: boolean;
  records: ClientRecord[];
  visibleRecords: ClientRecord[];
  ready: boolean;
  loading: boolean;
  saving: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  refreshRecords: () => Promise<void>;
  addRecord: (values: ClientFormValues) => Promise<void>;
  updateRecord: (id: string, values: ClientFormValues) => Promise<void>;
  updateStatus: (id: string, status: PipelineStatus) => Promise<void>;
}

const CrmContext = createContext<CrmContextValue | null>(null);

function canManageRecord(
  ownerDisplayName: AccountId,
  role: UserRole | null,
  record: ClientRecord,
): boolean {
  return canViewAllRecords(role) || record.owner === ownerDisplayName;
}

export function CrmProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [account, setAccount] = useState<AccountRow | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [records, setRecords] = useState<ClientRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadForAuthUser = useCallback(async (authUserId: string, email: string | null) => {
    setLoading(true);
    setError(null);
    setUserEmail(email);

    try {
      const accountRow = await fetchAccountByAuthUserId(authUserId);
      if (!accountRow || !accountRow.is_active) {
        setAccount(null);
        setRecords([]);
        setError(
          "Your login is not linked to an active CRM account. Ask Staff to set up your account.",
        );
        return;
      }

      if (!isUserRole(accountRow.role)) {
        setAccount(null);
        setRecords([]);
        setError("Your CRM account has an invalid role.");
        return;
      }

      setAccount(accountRow);
      const viewAll = canViewAllRecords(accountRow.role as UserRole);
      const clientRows = await fetchClientRecords(accountRow.id, viewAll);
      setRecords(clientRows);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load records from Supabase";
      setError(message);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        await loadForAuthUser(session.user.id, session.user.email ?? null);
      } else {
        setLoading(false);
      }
      setReady(true);
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void loadForAuthUser(session.user.id, session.user.email ?? null);
      } else {
        setAccount(null);
        setUserEmail(null);
        setRecords([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadForAuthUser]);

  const currentUser = account?.display_name ?? "";
  const currentRole = account && isUserRole(account.role) ? (account.role as UserRole) : null;

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setAccount(null);
    setUserEmail(null);
    setRecords([]);
    router.push("/login");
    router.refresh();
  }, [router]);

  const refreshRecords = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await loadForAuthUser(user.id, user.email ?? null);
    }
  }, [loadForAuthUser]);

  const isCeo = currentRole === "CEO";
  const isStaff = currentRole === "Staff";
  const canViewAll = canViewAllRecords(currentRole);
  const canManagePlanCatalog = canManagePlans(currentRole);
  const canManageSalesAccountsCatalog = canManageSalesAccounts(currentRole);
  const canAddClients = isSalesRepRole(currentRole);

  const addRecord = useCallback(
    async (values: ClientFormValues) => {
      if (!isSalesRepRole(currentRole) || !account) {
        throw new Error("Only sales reps can add new client records.");
      }

      setSaving(true);
      setError(null);
      try {
        const created = await insertClientRecord(values, account.display_name, account.id);
        setRecords((prev) => [created, ...prev]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save client record";
        setError(message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [account, currentRole],
  );

  const updateRecord = useCallback(
    async (id: string, values: ClientFormValues) => {
      const existing = records.find((record) => record.id === id);
      if (!existing || !canManageRecord(currentUser, currentRole, existing)) {
        throw new Error("You do not have permission to edit this record.");
      }

      setSaving(true);
      setError(null);
      try {
        const updated = await updateClientRecord(id, values);
        setRecords((prev) => prev.map((record) => (record.id === id ? updated : record)));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update client record";
        setError(message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [currentRole, currentUser, records],
  );

  const updateStatus = useCallback(
    async (id: string, status: PipelineStatus) => {
      const existing = records.find((record) => record.id === id);
      if (!existing || !canManageRecord(currentUser, currentRole, existing)) {
        throw new Error("You do not have permission to update this record.");
      }

      setSaving(true);
      setError(null);
      try {
        const updated = await updateClientStatus(id, status);
        setRecords((prev) => prev.map((record) => (record.id === id ? updated : record)));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update status";
        setError(message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [currentRole, currentUser, records],
  );

  const visibleRecords = records;

  const value = useMemo(
    () => ({
      currentUser,
      currentRole,
      userEmail,
      isCeo,
      isStaff,
      canViewAll,
      canManagePlanCatalog,
      canManageSalesAccountsCatalog,
      canAddClients,
      records,
      visibleRecords,
      ready,
      loading,
      saving,
      error,
      signOut,
      refreshRecords,
      addRecord,
      updateRecord,
      updateStatus,
    }),
    [
      addRecord,
      canAddClients,
      canManagePlanCatalog,
      canManageSalesAccountsCatalog,
      canViewAll,
      currentRole,
      currentUser,
      error,
      isCeo,
      isStaff,
      loading,
      ready,
      records,
      refreshRecords,
      saving,
      signOut,
      updateRecord,
      updateStatus,
      userEmail,
      visibleRecords,
    ],
  );

  return <CrmContext.Provider value={value}>{children}</CrmContext.Provider>;
}

export function useCrm() {
  const context = useContext(CrmContext);
  if (!context) {
    throw new Error("useCrm must be used within CrmProvider");
  }
  return context;
}

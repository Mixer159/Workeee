"use client";

import {
  createContext,
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  readStoredOrganizationId,
  storeOrganizationId,
  subscribeStoredOrganization,
} from "@/lib/current-organization";

export type OrganizationSummary = {
  _id: Id<"organizations">;
  name: string;
  role: "owner" | "admin" | "member";
  access: "full" | "limited";
};

export type OrganizationContextValue = {
  /** `undefined` while the membership list is loading. */
  organizations: OrganizationSummary[] | undefined;
  organization: OrganizationSummary | null;
  organizationId: Id<"organizations"> | null;
  isLoading: boolean;
  canManage: boolean;
  setOrganizationId: (organizationId: Id<"organizations">) => void;
};

export const OrganizationContext =
  createContext<OrganizationContextValue | null>(null);

function serverSnapshot(): string | null {
  return null;
}

/**
 * Tenant context for the whole app shell.
 *
 * The stored id is only a preference: the current organization is always one
 * the server actually returned a membership for, so a stale id — a left or
 * deleted organization — silently falls back to the first one.
 */
export function OrganizationProvider({ children }: { children: ReactNode }) {
  const organizations = useQuery(api.organizations.listForUser);
  const storedId = useSyncExternalStore(
    subscribeStoredOrganization,
    readStoredOrganizationId,
    serverSnapshot,
  );

  const setOrganizationId = useCallback((organizationId: Id<"organizations">) => {
    storeOrganizationId(organizationId);
  }, []);

  const value = useMemo<OrganizationContextValue>(() => {
    const organization =
      organizations?.find((item) => item._id === storedId) ??
      organizations?.[0] ??
      null;
    return {
      organizations,
      organization,
      organizationId: organization?._id ?? null,
      isLoading: organizations === undefined,
      canManage:
        organization?.role === "owner" || organization?.role === "admin",
      setOrganizationId,
    };
  }, [organizations, storedId, setOrganizationId]);

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

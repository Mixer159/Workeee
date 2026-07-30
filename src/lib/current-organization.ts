"use client";

/**
 * The organization the user is currently looking at, remembered across
 * sessions. Kept in `localStorage` rather than the URL: the sidebar, not the
 * route, owns the tenant context.
 */
export const ORGANIZATION_STORAGE_KEY = "workeee-org";

const listeners = new Set<() => void>();

export function readStoredOrganizationId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(ORGANIZATION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeOrganizationId(organizationId: string | null): void {
  try {
    if (organizationId === null) {
      window.localStorage.removeItem(ORGANIZATION_STORAGE_KEY);
    } else {
      window.localStorage.setItem(ORGANIZATION_STORAGE_KEY, organizationId);
    }
  } catch {
    // Storage unavailable (private mode) — the switch still applies in memory
    // for this tab through the listeners below.
  }
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeStoredOrganization(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

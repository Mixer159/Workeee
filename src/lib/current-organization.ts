"use client";

/** Each tab owns its selection; localStorage only supplies the initial default. */
export const ORGANIZATION_STORAGE_KEY = "workeee-org";

const listeners = new Set<() => void>();
let selectedOrganizationId: string | null | undefined;

export function readStoredOrganizationId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  if (selectedOrganizationId !== undefined) {
    return selectedOrganizationId;
  }
  try {
    selectedOrganizationId = window.sessionStorage.getItem(
      ORGANIZATION_STORAGE_KEY,
    );
  } catch {
    // The in-memory selection still works when browser storage is blocked.
  }
  if (selectedOrganizationId == null) {
    try {
      selectedOrganizationId = window.localStorage.getItem(
        ORGANIZATION_STORAGE_KEY,
      );
    } catch {
      selectedOrganizationId = null;
    }
  }
  return selectedOrganizationId;
}

export function storeOrganizationId(organizationId: string | null): void {
  selectedOrganizationId = organizationId;
  for (const storageName of ["sessionStorage", "localStorage"] as const) {
    try {
      const storage = window[storageName];
      if (organizationId === null) {
        storage.removeItem(ORGANIZATION_STORAGE_KEY);
      } else {
        storage.setItem(ORGANIZATION_STORAGE_KEY, organizationId);
      }
    } catch {
      // Persistence is optional; listeners always see the in-memory selection.
    }
  }
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeStoredOrganization(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

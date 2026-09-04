// @vitest-environment happy-dom

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const key = "workeee-org";

beforeEach(() => {
  vi.resetModules();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => vi.restoreAllMocks());

describe("tab organization selection", () => {
  it("uses the last saved organization as a new tab's default", async () => {
    window.localStorage.setItem(key, "org-a");
    const store = await import("./current-organization");
    expect(store.readStoredOrganizationId()).toBe("org-a");
  });

  it("keeps the tab's choice on reload after another tab changes the default", async () => {
    const store = await import("./current-organization");
    store.storeOrganizationId("org-b");
    window.localStorage.setItem(key, "org-a");
    vi.resetModules();
    const reloaded = await import("./current-organization");
    expect(reloaded.readStoredOrganizationId()).toBe("org-b");
  });

  it("switches in memory when both storage writes are blocked", async () => {
    const store = await import("./current-organization");
    const listener = vi.fn();
    const unsubscribe = store.subscribeStoredOrganization(listener);
    for (const name of ["localStorage", "sessionStorage"] as const) {
      vi.spyOn(window, name, "get").mockImplementation(() => {
        throw new DOMException("Storage blocked", "SecurityError");
      });
    }
    store.storeOrganizationId("org-b");
    expect(store.readStoredOrganizationId()).toBe("org-b");
    expect(listener).toHaveBeenCalledOnce();
    unsubscribe();
  });

  it("does not notify or change selection when another tab writes storage", async () => {
    const store = await import("./current-organization");
    store.storeOrganizationId("org-b");
    const listener = vi.fn();
    const unsubscribe = store.subscribeStoredOrganization(listener);
    window.localStorage.setItem(key, "org-a");
    window.dispatchEvent(new StorageEvent("storage", { key, newValue: "org-a" }));
    expect(store.readStoredOrganizationId()).toBe("org-b");
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});

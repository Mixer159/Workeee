// @vitest-environment happy-dom

import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import {
  OrganizationProvider,
  type OrganizationSummary,
} from "@/components/providers/organization-provider";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useProjectOrganization } from "@/hooks/use-project-organization";
import {
  ORGANIZATION_STORAGE_KEY,
  readStoredOrganizationId,
  storeOrganizationId,
} from "@/lib/current-organization";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("convex/react", () => ({ useQuery: () => organizations }));

const orgA = "org-a" as Id<"organizations">;
const orgB = "org-b" as Id<"organizations">;
const memberships: OrganizationSummary[] = [orgA, orgB].map((_id) => ({
  _id,
  name: _id,
  role: "owner",
  access: "full",
}));
let organizations: OrganizationSummary[] | undefined;
let root: Root;
let container: HTMLDivElement;

function Project({ organizationId }: { organizationId?: Id<"organizations"> }) {
  useProjectOrganization(organizationId);
  const { organizationId: selectedId, setOrganizationId } = useCurrentOrganization();
  return createElement(
    "button",
    { onClick: () => setOrganizationId(orgB) },
    selectedId,
  );
}

async function renderProject(organizationId?: Id<"organizations">, key = "project-a") {
  await act(async () => {
    root.render(
      createElement(
        StrictMode,
        null,
        createElement(
          OrganizationProvider,
          null,
          createElement(Project, { organizationId, key }),
        ),
      ),
    );
  });
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  router.replace.mockClear();
  organizations = memberships;
  window.localStorage.clear();
  storeOrganizationId(orgA);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("project organization navigation", () => {
  it("keeps a switch from an open project and leaves for the overview", async () => {
    await renderProject(orgA);
    await act(async () => container.querySelector("button")?.click());

    expect(readStoredOrganizationId()).toBe(orgB);
    expect(container.textContent).toBe(orgB);
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("adopts a linked project's organization without leaving the project", async () => {
    await renderProject();
    await renderProject(orgB);

    expect(readStoredOrganizationId()).toBe(orgB);
    expect(container.textContent).toBe(orgB);
    expect(router.replace).not.toHaveBeenCalled();

    await act(async () => storeOrganizationId(orgA));
    expect(readStoredOrganizationId()).toBe(orgA);
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("keeps a new selection when the old project resolves late", async () => {
    await renderProject();
    await act(async () => container.querySelector("button")?.click());
    expect(router.replace).toHaveBeenCalledWith("/");

    await renderProject(orgA);
    expect(readStoredOrganizationId()).toBe(orgB);
    expect(container.textContent).toBe(orgB);
  });

  it("does not write back against another browser tab's selection", async () => {
    await renderProject(orgA);
    await act(async () => {
      window.localStorage.setItem(ORGANIZATION_STORAGE_KEY, orgB);
      window.dispatchEvent(new StorageEvent("storage", {
        key: ORGANIZATION_STORAGE_KEY,
        oldValue: orgA,
        newValue: orgB,
        storageArea: window.localStorage,
      }));
    });

    expect(readStoredOrganizationId()).toBe(orgB);
    expect(container.textContent).toBe(orgB);
    expect(router.replace).toHaveBeenCalledWith("/");

    await renderProject(orgA);
    expect(readStoredOrganizationId()).toBe(orgB);
  });

  it("stays on the project when the selected organization is unchanged", async () => {
    await renderProject(orgB);
    await act(async () => container.querySelector("button")?.click());
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("opens another project's organization after a keyed navigation", async () => {
    await renderProject(orgA);
    await renderProject(orgB, "project-b");
    expect(readStoredOrganizationId()).toBe(orgB);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("adopts the link when there is no saved organization and memberships load later", async () => {
    window.localStorage.clear();
    organizations = undefined;
    await renderProject();
    organizations = memberships;
    await renderProject(orgB);

    expect(readStoredOrganizationId()).toBe(orgB);
    expect(container.textContent).toBe(orgB);
    expect(router.replace).not.toHaveBeenCalled();
  });
});

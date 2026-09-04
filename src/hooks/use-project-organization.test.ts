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
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import {
  ORGANIZATION_STORAGE_KEY,
  readStoredOrganizationId,
  storeOrganizationId,
} from "@/lib/current-organization";

const router = vi.hoisted(() => ({ replace: vi.fn(), pathname: "/projekt/project-a" }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => router.pathname }));
vi.mock("@/components/organizations/create-organization-dialog", () => ({ CreateOrganizationDialog: () => null }));
vi.mock("@/components/organizations/join-organization-dialog", () => ({ JoinOrganizationDialog: () => null }));
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
  const { organizationId: selectedId } = useCurrentOrganization();
  return createElement(
    "div",
    null,
    createElement(OrganizationSwitcher),
    createElement("output", null, selectedId),
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

async function selectOrganization(id: string) {
  await act(async () => {
    container.querySelector("button")!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  });
  const item = [...document.querySelectorAll("[role=menuitem]")].find((element) => element.textContent === id);
  expect(item).toBeDefined();
  await act(async () => item!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  router.replace.mockClear();
  router.pathname = "/projekt/project-a";
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
    await selectOrganization(orgB);

    expect(readStoredOrganizationId()).toBe(orgB);
    expect(container.querySelector("output")?.textContent).toBe(orgB);
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("adopts a linked project's organization without leaving the project", async () => {
    await renderProject();
    await renderProject(orgB);

    expect(readStoredOrganizationId()).toBe(orgB);
    expect(container.querySelector("output")?.textContent).toBe(orgB);
    expect(router.replace).not.toHaveBeenCalled();

    await act(async () => storeOrganizationId(orgA));
    expect(readStoredOrganizationId()).toBe(orgA);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("keeps a new selection when the old project resolves late", async () => {
    await renderProject();
    await selectOrganization(orgB);
    expect(router.replace).toHaveBeenCalledWith("/");

    await renderProject(orgA);
    expect(readStoredOrganizationId()).toBe(orgB);
    expect(container.querySelector("output")?.textContent).toBe(orgB);
  });

  it("ignores another tab restoring the previous organization after a switch", async () => {
    await renderProject(orgA);
    await selectOrganization(orgB);
    await renderProject(orgB, "project-b");
    router.replace.mockClear();
    await act(async () => {
      window.localStorage.setItem(ORGANIZATION_STORAGE_KEY, orgA);
      window.dispatchEvent(new StorageEvent("storage", {
        key: ORGANIZATION_STORAGE_KEY,
        oldValue: orgB,
        newValue: orgA,
        storageArea: window.localStorage,
      }));
    });
    await renderProject(orgB, "project-b");
    expect(readStoredOrganizationId()).toBe(orgB);
    expect(container.querySelector("output")?.textContent).toBe(orgB);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("keeps the current section when switching from Team", async () => {
    router.pathname = "/tym";
    await renderProject();
    await selectOrganization(orgB);
    expect(readStoredOrganizationId()).toBe(orgB);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("stays on the project when the selected organization is unchanged", async () => {
    await renderProject(orgB);
    await selectOrganization(orgB);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("opens another project's organization after a keyed navigation", async () => {
    await renderProject(orgA);
    await renderProject(orgB, "project-b");
    expect(readStoredOrganizationId()).toBe(orgB);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("adopts the link when there is no saved organization and memberships load later", async () => {
    storeOrganizationId(null);
    organizations = undefined;
    await renderProject();
    organizations = memberships;
    await renderProject(orgB);

    expect(readStoredOrganizationId()).toBe(orgB);
    expect(container.querySelector("output")?.textContent).toBe(orgB);
    expect(router.replace).not.toHaveBeenCalled();
  });
});

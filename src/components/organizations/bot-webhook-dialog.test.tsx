// @vitest-environment happy-dom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import {
  BotWebhookDialog,
  type BotWebhookConfig,
} from "@/components/organizations/bot-webhook-dialog";
import { MembersTable } from "@/components/organizations/members-table";

const convex = vi.hoisted(() => ({
  mutations: new Map<string, ReturnType<typeof vi.fn>>(),
  queries: new Map<string, unknown>(),
  asked: [] as string[],
}));
vi.mock("convex/react", () => ({
  useMutation: (fn: unknown) => {
    const name = getFunctionName(fn as never);
    if (!convex.mutations.has(name)) {
      convex.mutations.set(name, vi.fn(async () => undefined));
    }
    return convex.mutations.get(name);
  },
  useQuery: (fn: unknown, args: unknown) => {
    if (args === "skip") {
      return undefined;
    }
    const name = getFunctionName(fn as never);
    convex.asked.push(name);
    return convex.queries.get(name);
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const organizationId = "org" as Id<"organizations">;
const botId = "bot" as Id<"users">;
const stored: BotWebhookConfig = {
  url: "https://codie.example.com/hook",
  hasSecret: true,
  headerName: "X-Secret",
};

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  convex.mutations.clear();
  convex.queries.clear();
  convex.asked = [];
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = "";
});

async function render(element: React.ReactElement) {
  await act(async () => root.render(element));
}

function field(id: string): HTMLInputElement {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`missing #${id}`);
  }
  return input;
}

function button(label: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll("button")].find(
    (candidate) =>
      candidate.textContent?.trim() === label ||
      candidate.getAttribute("aria-label") === label,
  );
}

async function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submit() {
  await act(async () => {
    button("Uložit")?.click();
  });
}

function dialog(webhook: BotWebhookConfig | null) {
  return createElement(BotWebhookDialog, {
    organizationId,
    bot: { userId: botId, name: "Codie" },
    webhook,
    onOpenChange: () => {},
  });
}

describe("BotWebhookDialog", () => {
  it("never shows a stored key, and an empty key keeps it", async () => {
    await render(dialog(stored));

    expect(field("bot-webhook-url").value).toBe(stored.url);
    expect(field("bot-webhook-header").value).toBe("X-Secret");
    expect(field("bot-webhook-secret").value).toBe("");
    expect(field("bot-webhook-secret").type).toBe("password");
    expect(field("bot-webhook-secret").placeholder).toBe("uložen — ponechte prázdné");

    await submit();

    const set = convex.mutations.get("botWebhooks:set");
    expect(set).toHaveBeenCalledWith({
      organizationId,
      botId,
      url: stored.url,
      headerName: "X-Secret",
    });
  });

  it("asks for a key before the first save and offers no removal", async () => {
    await render(dialog(null));

    expect(button("Odebrat")).toBeUndefined();
    await type(field("bot-webhook-url"), "https://example.com/hook");
    expect(button("Uložit")?.disabled).toBe(true);

    await type(field("bot-webhook-secret"), "0123456789abcdef");
    expect(button("Uložit")?.disabled).toBe(false);
    await submit();

    expect(convex.mutations.get("botWebhooks:set")).toHaveBeenCalledWith({
      organizationId,
      botId,
      url: "https://example.com/hook",
      headerName: "",
      secret: "0123456789abcdef",
    });
  });

  it("removes a configured webhook", async () => {
    await render(dialog(stored));
    await act(async () => {
      button("Odebrat")?.click();
    });
    expect(convex.mutations.get("botWebhooks:clear")).toHaveBeenCalledWith({
      organizationId,
      botId,
    });
  });
});

describe("MembersTable webhooks", () => {
  const members = [
    {
      membershipId: "m1",
      userId: "owner",
      name: "Jana",
      email: "jana@example.com",
      role: "owner",
      access: "full",
      projects: [],
      isBot: false,
    },
    {
      membershipId: "m2",
      userId: botId,
      name: "Codie",
      email: "",
      ownerName: "Jana",
      role: "member",
      access: "full",
      projects: [],
      isBot: true,
    },
  ];

  it("gives the owner a webhook button and marks a configured bot", async () => {
    convex.queries.set("organizations:members", members);
    convex.queries.set("botWebhooks:list", [{ botId, ...stored, updatedAt: 1 }]);
    await render(
      createElement(MembersTable, { organizationId, canManage: true, viewerRole: "owner" }),
    );

    expect(button("Webhook: Codie")).toBeDefined();
    expect(container.textContent).toContain("Webhook");
  });

  it("shows nothing new to an admin and does not ask for webhooks", async () => {
    convex.queries.set("organizations:members", members);
    await render(
      createElement(MembersTable, { organizationId, canManage: true, viewerRole: "admin" }),
    );

    expect(button("Webhook: Codie")).toBeUndefined();
    expect(container.textContent).not.toContain("Webhook");
    expect(convex.asked).not.toContain("botWebhooks:list");
  });
});

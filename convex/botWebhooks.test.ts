import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { hashApiToken } from "./lib/apiTokens";
import { createComment } from "./lib/commentActions";
import { serializeCommentBody, type CommentSegment } from "./lib/commentBody";
import schema from "./schema";

declare global {
  // `import.meta.glob` is a Vite feature. The repo has no direct dependency on
  // `vite/client` types, so declare exactly the piece `convex-test` needs.
  interface ImportMeta {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>;
  }
}

const modules = import.meta.glob("./**/*.ts");

function setup() {
  return convexTest(schema, modules);
}

type Harness = ReturnType<typeof setup>;
type Identity = ReturnType<Harness["withIdentity"]>;

const SECRET = "tajny-klic-pro-codie-0123456789";
const WEBHOOK_URL = "https://hooks.example.com/codie?k=1";

/**
 * Nothing runs until a test asks for it, and `fetch` is a spy: a delivery is
 * asserted on what it would have sent, and nothing leaves the test.
 */
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("SITE_URL", "https://workeee.example.com/");
  fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

async function createUser(t: Harness, name: string, email: string) {
  const authId = `auth_${email}`;
  const userId = await t.run(
    async (ctx) => await ctx.db.insert("users", { authId, name, email }),
  );
  return { userId, as: t.withIdentity({ subject: authId, name, email }) };
}

/** Somebody accepts an organization invite, then gets `role`. */
async function addMember(
  t: Harness,
  owner: { as: Identity },
  organizationId: Id<"organizations">,
  name: string,
  email: string,
  role: "admin" | "member" = "member",
) {
  const { code } = await owner.as.mutation(api.invites.create, {
    organizationId,
    expiry: "7d",
  });
  const user = await createUser(t, name, email);
  await user.as.mutation(api.invites.accept, { code });
  if (role === "admin") {
    await owner.as.mutation(api.organizations.updateMemberRole, {
      organizationId,
      userId: user.userId,
      role,
    });
  }
  return user;
}

/**
 * Jana owns Studio with one project, Petr is a member there, and Jana's bot
 * Codie is a full member — with a webhook unless `webhook: false`.
 */
async function studio(t: Harness, options: { webhook?: boolean } = {}) {
  const owner = await createUser(t, "Jana Nováková", "jana@example.com");
  const { organizationId } = await owner.as.mutation(api.organizations.create, {
    name: "Studio",
  });
  const { projectId } = await owner.as.mutation(api.projects.create, {
    organizationId,
    name: "Web",
  });
  const petr = await addMember(t, owner, organizationId, "Petr Malý", "petr@example.com");

  const { token } = await owner.as.action(api.apiTokens.create, { name: "Grok" });
  const tokenHash = await hashApiToken(token);
  const { botId } = await t.mutation(internal.bots.syncIdentity, {
    tokenHash,
    name: "Codie",
  });
  await owner.as.mutation(api.bots.addToOrganization, {
    organizationId,
    botId,
    access: "full",
  });
  if (options.webhook !== false) {
    await owner.as.mutation(api.botWebhooks.set, {
      organizationId,
      botId,
      url: WEBHOOK_URL,
      secret: SECRET,
      headerName: "X-Codie-Key",
    });
  }

  const statusId = await t.run(async (ctx) => {
    const statuses = await ctx.db
      .query("taskStatuses")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    return statuses.find((status) => status.kind === "todo")!._id;
  });
  const { taskId } = await owner.as.mutation(api.tasks.create, {
    projectId,
    statusId,
    title: "Opravit fakturaci",
  });

  return { owner, petr, organizationId, projectId, taskId, tokenHash, botId };
}

function mentionBody(userId: Id<"users">, name: string): string {
  const segments: CommentSegment[] = [
    { type: "text", text: "Mrkni na to, " },
    { type: "mention", userId, name },
  ];
  return serializeCommentBody(segments);
}

async function pendingDeliveries(t: Harness) {
  return await t.run(async (ctx) =>
    (await ctx.db.system.query("_scheduled_functions").collect()).filter(
      (job) => job.name.includes("botWebhooks") && job.state.kind === "pending",
    ),
  );
}

/** Every POST the spy saw, decoded. */
function sentRequests() {
  return fetchMock.mock.calls.map(([url, init]) => {
    const request = init as RequestInit;
    return {
      url: url as string,
      headers: request.headers as Record<string, string>,
      body: JSON.parse(request.body as string),
    };
  });
}

describe("configuring a webhook", () => {
  test("only the organization owner may set or clear it", async () => {
    const t = setup();
    const { owner, organizationId, botId } = await studio(t, { webhook: false });
    const admin = await addMember(
      t,
      owner,
      organizationId,
      "Eva Dvořáková",
      "eva@example.com",
      "admin",
    );
    const outsider = await createUser(t, "Karel Cizí", "karel@example.com");
    const args = { organizationId, botId, url: WEBHOOK_URL, secret: SECRET };

    await expect(admin.as.mutation(api.botWebhooks.set, args)).rejects.toThrow(
      /jen vlastník organizace/,
    );
    await expect(outsider.as.mutation(api.botWebhooks.set, args)).rejects.toThrow(
      /Nemáte přístup k této organizaci/,
    );

    await owner.as.mutation(api.botWebhooks.set, args);
    await expect(
      admin.as.mutation(api.botWebhooks.clear, { organizationId, botId }),
    ).rejects.toThrow(/jen vlastník organizace/);
    expect(await admin.as.query(api.botWebhooks.list, { organizationId })).toEqual([]);
    expect(
      await admin.as.query(api.botWebhooks.get, { organizationId, botId }),
    ).toBeNull();

    await owner.as.mutation(api.botWebhooks.clear, { organizationId, botId });
    expect(
      await owner.as.query(api.botWebhooks.get, { organizationId, botId }),
    ).toBeNull();
  });

  test("refuses non-bots, non-members, plain http and bad secrets or headers", async () => {
    const t = setup();
    const { owner, petr, organizationId, botId } = await studio(t, { webhook: false });
    const base = { organizationId, botId, url: WEBHOOK_URL, secret: SECRET };

    await expect(
      owner.as.mutation(api.botWebhooks.set, { ...base, botId: petr.userId }),
    ).rejects.toThrow(/Tento bot v organizaci není/);
    for (const url of [
      "http://hooks.example.com/codie",
      "ftp://hooks.example.com",
      "https://user:pass@hooks.example.com/",
      "není adresa",
      `https://example.com/${"a".repeat(2100)}`,
    ]) {
      await expect(
        owner.as.mutation(api.botWebhooks.set, { ...base, url }),
      ).rejects.toThrow(/Webhook musí být na adrese https|není platná|příliš dlouhá/);
    }
    await expect(
      owner.as.mutation(api.botWebhooks.set, { ...base, secret: "kratky" }),
    ).rejects.toThrow(/16 až 256 znaků/);
    await expect(
      owner.as.mutation(api.botWebhooks.set, { ...base, secret: "s mezerou uprostred!" }),
    ).rejects.toThrow(/viditelné znaky ASCII/);
    await expect(
      owner.as.mutation(api.botWebhooks.set, { ...base, secret: undefined }),
    ).rejects.toThrow(/Zadejte tajný klíč/);
    for (const headerName of ["Authorization", "content-type", "X Bad", "X:Key"]) {
      await expect(
        owner.as.mutation(api.botWebhooks.set, { ...base, headerName }),
      ).rejects.toThrow(/Hlavičku|Název hlavičky/);
    }

    // A bot removed from the organization takes its webhook with it.
    await owner.as.mutation(api.botWebhooks.set, base);
    await owner.as.mutation(api.organizations.removeMember, {
      organizationId,
      userId: botId,
    });
    const rows = await t.run(async (ctx) => await ctx.db.query("botWebhooks").collect());
    expect(rows).toHaveLength(0);
  });

  test("the secret is never returned, and an empty one keeps the stored one", async () => {
    const t = setup();
    const { owner, organizationId, projectId, botId } = await studio(t);

    const one = await owner.as.query(api.botWebhooks.get, { organizationId, botId });
    expect(one).toEqual({ url: WEBHOOK_URL, hasSecret: true, headerName: "X-Codie-Key" });
    const list = await owner.as.query(api.botWebhooks.list, { organizationId });
    expect(list).toEqual([
      expect.objectContaining({ botId, url: WEBHOOK_URL, hasSecret: true }),
    ]);

    // Every public read that resolves the bot, checked for the value itself.
    const reads = [
      one,
      list,
      await owner.as.query(api.bots.listMine, { organizationId }),
      await owner.as.query(api.organizations.members, { organizationId }),
      await owner.as.query(api.projects.assignableMembers, { projectId }),
    ];
    expect(JSON.stringify(reads)).not.toContain(SECRET);

    // Re-saved with no secret and no header: the secret stays, the header goes.
    await owner.as.mutation(api.botWebhooks.set, {
      organizationId,
      botId,
      url: "https://hooks.example.com/novy",
      secret: "",
    });
    const stored = await t.run(async (ctx) => await ctx.db.query("botWebhooks").unique());
    expect(stored).toMatchObject({
      url: "https://hooks.example.com/novy",
      secret: SECRET,
    });
    expect(stored?.headerName).toBeUndefined();
  });
});

describe("mentions", () => {
  test("a comment naming the bot posts the mention with both headers", async () => {
    const t = setup();
    const { petr, organizationId, projectId, taskId, botId } = await studio(t);

    // The bot is a valid mention target, like any project member.
    const members = await petr.as.query(api.projects.assignableMembers, { projectId });
    expect(members.find((member) => member._id === botId)?.isBot).toBe(true);

    const { commentId } = await petr.as.mutation(api.comments.create, {
      taskId,
      body: mentionBody(botId, "Codie"),
    });
    expect(await pendingDeliveries(t)).toHaveLength(1);

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const sent = sentRequests();
    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe(WEBHOOK_URL);
    expect(sent[0].headers).toEqual({
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET}`,
      "X-Codie-Key": SECRET,
    });
    expect(sent[0].body).toEqual({
      event: "mention",
      taskId,
      taskTitle: "Opravit fakturaci",
      projectId,
      organizationId,
      commentId,
      commentText: "Mrkni na to, @Codie",
      author: { id: petr.userId, name: "Petr Malý" },
      url: `https://workeee.example.com/projekt/${projectId}?ukol=${taskId}`,
    });
  });

  test("a comment naming only people schedules nothing", async () => {
    const t = setup();
    const { owner, petr, taskId } = await studio(t);

    await petr.as.mutation(api.comments.create, {
      taskId,
      body: mentionBody(owner.userId, "Jana Nováková"),
    });
    await petr.as.mutation(api.comments.create, {
      taskId,
      body: serializeCommentBody([{ type: "text", text: "@Codie bez zmínky" }]),
    });

    expect(await pendingDeliveries(t)).toHaveLength(0);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("a bot without a webhook is skipped", async () => {
    const t = setup();
    const { petr, taskId, botId } = await studio(t, { webhook: false });

    await petr.as.mutation(api.comments.create, {
      taskId,
      body: mentionBody(botId, "Codie"),
    });
    expect(await pendingDeliveries(t)).toHaveLength(0);
  });

  test("the bot's own comment never calls the bot", async () => {
    const t = setup();
    const { taskId, botId } = await studio(t);

    // `add_comment` is plain text, so drive the shared action directly to
    // prove the rule even for a body that does name the bot itself.
    await t.run(async (ctx) => {
      await createComment(ctx, botId, { taskId, body: mentionBody(botId, "Codie") });
    });
    expect(await pendingDeliveries(t)).toHaveLength(0);
  });
});

describe("assignments", () => {
  test("handing a task to the bot posts `assigned`", async () => {
    const t = setup();
    const { owner, organizationId, projectId, taskId, botId } = await studio(t);

    await owner.as.mutation(api.tasks.setAssignee, { taskId, assigneeId: botId });
    // Re-picking the same assignee is not a handover.
    await owner.as.mutation(api.tasks.setAssignee, { taskId, assigneeId: botId });
    expect(await pendingDeliveries(t)).toHaveLength(1);

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const sent = sentRequests();
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toEqual({
      event: "assigned",
      taskId,
      taskTitle: "Opravit fakturaci",
      projectId,
      organizationId,
      commentId: null,
      commentText: null,
      author: { id: owner.userId, name: "Jana Nováková" },
      url: `https://workeee.example.com/projekt/${projectId}?ukol=${taskId}`,
    });
  });

  test("a bot assigning itself over MCP calls nobody", async () => {
    const t = setup();
    const { taskId, tokenHash, botId } = await studio(t);

    await t.mutation(internal.mcpTools.assignTaskTool, {
      tokenHash,
      taskId,
      assigneeId: botId,
    });
    expect(await pendingDeliveries(t)).toHaveLength(0);
  });

  test("an assignment undone before the send is dropped", async () => {
    const t = setup();
    const { owner, taskId, botId } = await studio(t);

    await owner.as.mutation(api.tasks.setAssignee, { taskId, assigneeId: botId });
    await owner.as.mutation(api.tasks.setAssignee, { taskId, assigneeId: undefined });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("delivery", () => {
  test("retries a 5xx up to three attempts and never logs the secret", async () => {
    const t = setup();
    const { owner, taskId, botId } = await studio(t);
    fetchMock.mockImplementation(async () => new Response(null, { status: 503 }));
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await owner.as.mutation(api.tasks.setAssignee, { taskId, assigneeId: botId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(errors).toHaveBeenCalledTimes(3);
    const logged = JSON.stringify(errors.mock.calls);
    expect(logged).not.toContain(SECRET);
    expect(logged).not.toContain("k=1");
    expect(logged).toContain("hooks.example.com");
  });

  test("a network error is retried, a plain 4xx is not", async () => {
    const t = setup();
    const { owner, taskId, botId } = await studio(t);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    fetchMock
      .mockImplementationOnce(async () => {
        throw new TypeError("fetch failed");
      })
      .mockImplementationOnce(async () => new Response(null, { status: 200 }));
    await owner.as.mutation(api.tasks.setAssignee, { taskId, assigneeId: botId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response(null, { status: 404 }));
    await owner.as.mutation(api.tasks.setAssignee, { taskId, assigneeId: undefined });
    await owner.as.mutation(api.tasks.setAssignee, { taskId, assigneeId: botId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("a webhook cleared before the send sends nothing", async () => {
    const t = setup();
    const { owner, petr, organizationId, taskId, botId } = await studio(t);

    await petr.as.mutation(api.comments.create, {
      taskId,
      body: mentionBody(botId, "Codie"),
    });
    await owner.as.mutation(api.botWebhooks.clear, { organizationId, botId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("a failing receiver never fails the comment", async () => {
    const t = setup();
    const { petr, taskId, botId } = await studio(t);
    fetchMock.mockImplementation(async () => {
      throw new TypeError("fetch failed");
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { commentId } = await petr.as.mutation(api.comments.create, {
      taskId,
      body: mentionBody(botId, "Codie"),
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const comment = await t.run(async (ctx) => await ctx.db.get(commentId));
    expect(comment).not.toBeNull();
  });
});

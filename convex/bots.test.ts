import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { hashApiToken } from "./lib/apiTokens";
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

async function createUser(t: Harness, name: string, email: string) {
  const authId = `auth_${email}`;
  const userId = await t.run(
    async (ctx) => await ctx.db.insert("users", { authId, name, email }),
  );
  return { userId, as: t.withIdentity({ subject: authId, name, email }) };
}

/** Mint a token the way the settings page does, and hash it the way `/mcp` does. */
async function mintToken(user: { as: Identity }, name = "Grok") {
  const { token } = await user.as.action(api.apiTokens.create, { name });
  return { token, tokenHash: await hashApiToken(token) };
}

/** Jana owns an organization with two projects and a bot called Codie. */
async function connectedBot(t: Harness) {
  const owner = await createUser(t, "Jana Nováková", "jana@example.com");
  const { organizationId } = await owner.as.mutation(api.organizations.create, {
    name: "Studio",
  });
  const { projectId } = await owner.as.mutation(api.projects.create, {
    organizationId,
    name: "Web",
  });
  const { projectId: otherProjectId } = await owner.as.mutation(
    api.projects.create,
    { organizationId, name: "Aplikace" },
  );
  const { tokenHash } = await mintToken(owner);
  const { botId } = await t.mutation(internal.bots.syncIdentity, {
    tokenHash,
    name: "Codie",
  });
  return { owner, organizationId, projectId, otherProjectId, tokenHash, botId };
}

async function todoStatusId(t: Harness, projectId: Id<"projects">) {
  return await t.run(async (ctx) => {
    const statuses = await ctx.db
      .query("taskStatuses")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    return statuses.find((status) => status.kind === "todo")!._id;
  });
}

describe("API tokens", () => {
  test("only the hash is stored, and the list never shows the secret", async () => {
    const t = setup();
    const owner = await createUser(t, "Jana Nováková", "jana@example.com");
    const { token, tokenHash } = await mintToken(owner, "Codie v Groku");

    expect(token).toMatch(/^wrk_[A-Za-z0-9_-]{43}$/);
    const rows = await t.run(async (ctx) => await ctx.db.query("apiTokens").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(tokenHash);
    expect(JSON.stringify(rows[0])).not.toContain(token);
    expect(token.startsWith(rows[0].tokenPrefix)).toBe(true);

    const list = await owner.as.query(api.apiTokens.list, {});
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe("Codie v Groku");
    expect(JSON.stringify(list)).not.toContain(token);
  });

  test("authenticate accepts a live hash and refuses unknown or revoked ones", async () => {
    const t = setup();
    const owner = await createUser(t, "Jana Nováková", "jana@example.com");
    const { tokenHash } = await mintToken(owner);

    expect(
      await t.mutation(internal.mcpTools.authenticate, { tokenHash }),
    ).toEqual({ hasBot: false });
    expect(
      await t.mutation(internal.mcpTools.authenticate, {
        tokenHash: await hashApiToken("wrk_neexistuje"),
      }),
    ).toBeNull();

    const [row] = await owner.as.query(api.apiTokens.list, {});
    await owner.as.mutation(api.apiTokens.revoke, { tokenId: row._id });
    expect(
      await t.mutation(internal.mcpTools.authenticate, { tokenHash }),
    ).toBeNull();
    await expect(
      t.mutation(internal.bots.syncIdentity, { tokenHash, name: "Codie" }),
    ).rejects.toThrow(/Neplatný nebo zrušený API token/);
  });

  test("nobody else can revoke a token", async () => {
    const t = setup();
    const owner = await createUser(t, "Jana Nováková", "jana@example.com");
    const other = await createUser(t, "Petr Malý", "petr@example.com");
    await mintToken(owner);
    const [row] = await owner.as.query(api.apiTokens.list, {});

    await expect(
      other.as.mutation(api.apiTokens.revoke, { tokenId: row._id }),
    ).rejects.toThrow(/Tento token neexistuje/);
  });
});

describe("sync_bot_identity", () => {
  test("creates a bot owned by the token's human, then updates it", async () => {
    const t = setup();
    const owner = await createUser(t, "Jana Nováková", "jana@example.com");
    const { tokenHash } = await mintToken(owner);

    const first = await t.mutation(internal.bots.syncIdentity, {
      tokenHash,
      name: "Codie",
      avatarUrl: "https://example.com/codie.png",
    });
    expect(first.ownerName).toBe("Jana Nováková");

    const second = await t.mutation(internal.bots.syncIdentity, {
      tokenHash,
      name: "Codie 2",
    });
    expect(second.botId).toBe(first.botId);

    const bot = await t.run(async (ctx) => await ctx.db.get(first.botId));
    expect(bot).toMatchObject({
      kind: "bot",
      ownerId: owner.userId,
      name: "Codie 2",
      // Omitted on the second sync, so kept.
      image: "https://example.com/codie.png",
      email: "",
    });
    expect(bot?.lastSyncedAt).toBeTypeOf("number");

    const mine = await owner.as.query(api.bots.listMine, {});
    expect(mine.map((row) => row.name)).toEqual(["Codie 2"]);
  });

  test("a bot is never a session user", async () => {
    const t = setup();
    const owner = await createUser(t, "Jana Nováková", "jana@example.com");
    const { tokenHash } = await mintToken(owner);
    const { botId } = await t.mutation(internal.bots.syncIdentity, {
      tokenHash,
      name: "Codie",
    });
    const authId = await t.run(async (ctx) => (await ctx.db.get(botId))!.authId);

    const asBot = t.withIdentity({ subject: authId });
    expect(await asBot.query(api.users.currentUser, {})).toBeNull();
  });

  test("refuses avatars that are not https", async () => {
    const t = setup();
    const owner = await createUser(t, "Jana Nováková", "jana@example.com");
    const { tokenHash } = await mintToken(owner);

    for (const avatarUrl of [
      "http://example.com/a.png",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "https://user:secret@example.com/a.png",
    ]) {
      await expect(
        t.mutation(internal.bots.syncIdentity, { tokenHash, name: "Codie", avatarUrl }),
      ).rejects.toThrow(/Avatar musí být na adrese https/);
    }
  });

  test("a new token with the same name reconnects the existing bot", async () => {
    const t = setup();
    const { owner, botId } = await connectedBot(t);
    const { tokenHash } = await mintToken(owner, "Nový token");

    const again = await t.mutation(internal.bots.syncIdentity, {
      tokenHash,
      name: "codie",
    });
    expect(again.botId).toBe(botId);
  });

  test("two tokens are two bots for one human", async () => {
    const t = setup();
    const { owner, botId } = await connectedBot(t);
    const { tokenHash } = await mintToken(owner, "Jerry");

    const jerry = await t.mutation(internal.bots.syncIdentity, {
      tokenHash,
      name: "Jerry",
    });
    expect(jerry.botId).not.toBe(botId);
    const mine = await owner.as.query(api.bots.listMine, {});
    expect(mine.map((row) => row.name)).toEqual(["Codie", "Jerry"]);
  });

  test("another human's token never reaches somebody else's bot", async () => {
    const t = setup();
    const { botId, organizationId } = await connectedBot(t);
    const other = await createUser(t, "Petr Malý", "petr@example.com");
    const { tokenHash } = await mintToken(other);

    // Same name, different owner: Petr gets a bot of his own.
    const petrsBot = await t.mutation(internal.bots.syncIdentity, {
      tokenHash,
      name: "Codie",
    });
    expect(petrsBot.botId).not.toBe(botId);

    // And he cannot put Jana's bot anywhere.
    const { organizationId: petrsOrg } = await other.as.mutation(
      api.organizations.create,
      { name: "Petrova firma" },
    );
    await expect(
      other.as.mutation(api.bots.addToOrganization, {
        organizationId: petrsOrg,
        botId,
        access: "full",
      }),
    ).rejects.toThrow(/Tohoto bota nevlastníte/);
    await expect(
      other.as.mutation(api.bots.addToOrganization, {
        organizationId,
        botId: petrsBot.botId,
        access: "full",
      }),
    ).rejects.toThrow(/Nemáte přístup k této organizaci/);
  });
});

describe("what a bot may do", () => {
  test("every tool refuses a token that has not synced an identity", async () => {
    const t = setup();
    const owner = await createUser(t, "Jana Nováková", "jana@example.com");
    const { tokenHash } = await mintToken(owner);

    await expect(
      t.query(internal.mcpTools.listOrganizations, { tokenHash }),
    ).rejects.toThrow(/sync_bot_identity/);
  });

  test("without a membership the bot sees nothing, even though its owner does", async () => {
    const t = setup();
    const { organizationId, projectId, tokenHash } = await connectedBot(t);

    expect(
      await t.query(internal.mcpTools.listOrganizations, { tokenHash }),
    ).toEqual({ organizations: [] });
    await expect(
      t.query(internal.mcpTools.listProjects, { tokenHash, organizationId }),
    ).rejects.toThrow(/Nemáte přístup k této organizaci/);
    await expect(
      t.query(internal.mcpTools.listTasks, { tokenHash, projectId }),
    ).rejects.toThrow(/Nemáte přístup k tomuto projektu/);
    await expect(
      t.mutation(internal.mcpTools.createTaskTool, {
        tokenHash,
        projectId,
        title: "Nesmí vzniknout",
      }),
    ).rejects.toThrow(/Nemáte přístup k tomuto projektu/);

    const tasks = await t.run(async (ctx) => await ctx.db.query("tasks").collect());
    expect(tasks).toHaveLength(0);
  });

  test("a full bot creates, moves, assigns and comments as itself", async () => {
    const t = setup();
    const { owner, organizationId, projectId, tokenHash, botId } =
      await connectedBot(t);
    await owner.as.mutation(api.bots.addToOrganization, {
      organizationId,
      botId,
      access: "full",
    });

    const organizations = await t.query(internal.mcpTools.listOrganizations, {
      tokenHash,
    });
    expect(organizations.organizations).toEqual([
      { organizationId, name: "Studio", access: "full" },
    ]);

    const created = await t.mutation(internal.mcpTools.createTaskTool, {
      tokenHash,
      projectId,
      title: "Opravit fakturaci",
    });
    expect(created.status?.kind).toBe("todo");
    const task = await t.run(async (ctx) => await ctx.db.get(created.taskId));
    expect(task?.createdBy).toBe(botId);

    const board = await t.query(internal.mcpTools.listTasks, { tokenHash, projectId });
    const done = board.statuses.find((status) => status.kind === "done")!;
    const moved = await t.mutation(internal.mcpTools.moveTaskTool, {
      tokenHash,
      taskId: created.taskId,
      statusId: done.statusId,
    });
    expect(moved.status?.kind).toBe("done");

    const assigned = await t.mutation(internal.mcpTools.assignTaskTool, {
      tokenHash,
      taskId: created.taskId,
      assigneeId: botId,
    });
    expect(assigned.assignee).toEqual({
      userId: botId,
      name: "Codie",
      isBot: true,
    });

    await t.mutation(internal.mcpTools.addComment, {
      tokenHash,
      taskId: created.taskId,
      text: "Hotovo, @Jana zkontroluj.",
    });
    const { comments } = await t.query(internal.mcpTools.listComments, {
      tokenHash,
      taskId: created.taskId,
    });
    expect(comments).toHaveLength(1);
    expect(comments[0].text).toBe("Hotovo, @Jana zkontroluj.");
    expect(comments[0].author?.isBot).toBe(true);

    // The UI reads the same rows: the comment is the bot's, by name.
    const stream = await owner.as.query(api.comments.listByTask, {
      taskId: created.taskId,
    });
    expect(stream[0].author?.name).toBe("Codie");

    const found = await t.query(internal.mcpTools.search, {
      tokenHash,
      query: "fakturac",
    });
    expect(found.tasks.map((row) => row.taskId)).toEqual([created.taskId]);
  });

  test("a bot is never notified, and never mailed", async () => {
    const t = setup();
    const { owner, organizationId, projectId, tokenHash, botId } =
      await connectedBot(t);
    await owner.as.mutation(api.bots.addToOrganization, {
      organizationId,
      botId,
      access: "full",
    });

    // Jana creates a task (the feed tells every project member) and hands it
    // to the bot (the feed and the e-mail queue tell the assignee).
    const { taskId } = await owner.as.mutation(api.tasks.create, {
      projectId,
      statusId: await todoStatusId(t, projectId),
      title: "Pro bota",
    });
    await owner.as.mutation(api.tasks.setAssignee, { taskId, assigneeId: botId });

    const items = await t.run(
      async (ctx) => await ctx.db.query("notificationItems").collect(),
    );
    const events = await t.run(
      async (ctx) => await ctx.db.query("notificationEvents").collect(),
    );
    expect(items.filter((item) => item.userId === botId)).toHaveLength(0);
    expect(events.filter((event) => event.userId === botId)).toHaveLength(0);

    // And the bot's own work still notifies people, as anybody's would.
    await t.mutation(internal.mcpTools.createTaskTool, {
      tokenHash,
      projectId,
      title: "Od bota",
    });
    const janasItems = await t.run(
      async (ctx) =>
        await ctx.db
          .query("notificationItems")
          .withIndex("by_user_org", (q) =>
            q.eq("userId", owner.userId).eq("organizationId", organizationId),
          )
          .collect(),
    );
    expect(janasItems.map((item) => item.actorId)).toContain(botId);
  });

  test("a limited bot sees only the projects it was given", async () => {
    const t = setup();
    const { owner, organizationId, projectId, otherProjectId, tokenHash, botId } =
      await connectedBot(t);
    await owner.as.mutation(api.bots.addToOrganization, {
      organizationId,
      botId,
      access: "limited",
      projectIds: [projectId],
    });

    const { projects } = await t.query(internal.mcpTools.listProjects, {
      tokenHash,
      organizationId,
    });
    expect(projects.map((project) => project.projectId)).toEqual([projectId]);

    await expect(
      t.query(internal.mcpTools.listTasks, { tokenHash, projectId: otherProjectId }),
    ).rejects.toThrow(/Nemáte přístup k tomuto projektu/);
    await expect(
      t.mutation(internal.mcpTools.createTaskTool, {
        tokenHash,
        projectId: otherProjectId,
        title: "Mimo",
      }),
    ).rejects.toThrow(/Nemáte přístup k tomuto projektu/);
    await t.mutation(internal.mcpTools.createTaskTool, {
      tokenHash,
      projectId,
      title: "Uvnitř",
    });
  });

  test("a bot never outlives its owner's access", async () => {
    const t = setup();
    const { owner, organizationId, projectId } = await connectedBot(t);
    // Petr joins Jana's organization as an admin and connects his own bot.
    const { code } = await owner.as.mutation(api.invites.create, {
      organizationId,
      expiry: "7d",
    });
    const petr = await createUser(t, "Petr Malý", "petr@example.com");
    await petr.as.mutation(api.invites.accept, { code });
    await owner.as.mutation(api.organizations.updateMemberRole, {
      organizationId,
      userId: petr.userId,
      role: "admin",
    });
    const { tokenHash } = await mintToken(petr);
    const { botId } = await t.mutation(internal.bots.syncIdentity, {
      tokenHash,
      name: "Jerry",
    });
    await petr.as.mutation(api.bots.addToOrganization, {
      organizationId,
      botId,
      access: "full",
    });
    await t.query(internal.mcpTools.listTasks, { tokenHash, projectId });

    // Petr leaves; Jerry's membership row is still there, but useless.
    await owner.as.mutation(api.organizations.removeMember, {
      organizationId,
      userId: petr.userId,
    });
    await expect(
      t.query(internal.mcpTools.listTasks, { tokenHash, projectId }),
    ).rejects.toThrow(/Nemáte přístup k tomuto projektu/);
    expect(
      await t.query(internal.mcpTools.listOrganizations, { tokenHash }),
    ).toEqual({ organizations: [] });
  });

  test("a limited manager cannot hand a bot more than they have", async () => {
    const t = setup();
    const { owner, organizationId, projectId, otherProjectId } =
      await connectedBot(t);
    const { code } = await owner.as.mutation(api.invites.create, {
      organizationId,
      projectId,
      expiry: "7d",
    });
    const petr = await createUser(t, "Petr Malý", "petr@example.com");
    await petr.as.mutation(api.invites.accept, { code });
    await owner.as.mutation(api.organizations.updateMemberRole, {
      organizationId,
      userId: petr.userId,
      role: "admin",
    });
    const { tokenHash } = await mintToken(petr);
    const { botId } = await t.mutation(internal.bots.syncIdentity, {
      tokenHash,
      name: "Jerry",
    });

    await expect(
      petr.as.mutation(api.bots.addToOrganization, {
        organizationId,
        botId,
        access: "full",
      }),
    ).rejects.toThrow(/širší přístup/);
    await expect(
      petr.as.mutation(api.bots.addToOrganization, {
        organizationId,
        botId,
        access: "limited",
        projectIds: [otherProjectId],
      }),
    ).rejects.toThrow(/Nemáte přístup k tomuto projektu/);
    await petr.as.mutation(api.bots.addToOrganization, {
      organizationId,
      botId,
      access: "limited",
      projectIds: [projectId],
    });
  });

  test("members see the bot with its owner, and its role cannot change", async () => {
    const t = setup();
    const { owner, organizationId, botId } = await connectedBot(t);
    await owner.as.mutation(api.bots.addToOrganization, {
      organizationId,
      botId,
      access: "full",
    });

    const members = await owner.as.query(api.organizations.members, {
      organizationId,
    });
    const bot = members.find((member) => member.userId === botId);
    expect(bot).toMatchObject({
      isBot: true,
      ownerName: "Jana Nováková",
      role: "member",
    });

    await expect(
      owner.as.mutation(api.organizations.updateMemberRole, {
        organizationId,
        userId: botId,
        role: "admin",
      }),
    ).rejects.toThrow(/Botovi nejde měnit roli/);

    // A manager can still remove it, like any member.
    await owner.as.mutation(api.organizations.removeMember, {
      organizationId,
      userId: botId,
    });
    const mine = await owner.as.query(api.bots.listMine, { organizationId });
    expect(mine[0].inOrganization).toBe(false);
  });

  test("ids a model made up are refused with a sentence", async () => {
    const t = setup();
    const { tokenHash } = await connectedBot(t);

    await expect(
      t.query(internal.mcpTools.getTask, { tokenHash, taskId: "neexistuje" }),
    ).rejects.toThrow(/Neplatné id/);
  });
});

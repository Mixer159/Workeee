import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { hashApiToken } from "./lib/apiTokens";
import { serializeCommentBody } from "./lib/commentBody";
import { notifyComment } from "./lib/notifications";
import schema from "./schema";

declare global {
  // `import.meta.glob` is a Vite feature. The repo has no direct dependency on
  // `vite/client` types, so declare exactly the piece `convex-test` needs.
  interface ImportMeta {
    glob: (pattern: string) => Record<string, () => Promise<unknown>>;
  }
}

const modules = import.meta.glob("./**/*.ts");

/**
 * Hidden tasks: for anybody in `tasks.hiddenFrom` the task must not exist —
 * not on a board, not in a count, not in a feed, not in an e-mail, not through
 * their bot. Each test names one road in and shows that it is closed.
 *
 * Timers are faked, as in `notifications.test.ts`: queued e-mail schedules a
 * flush with `scheduler.runAt`, and nothing here should race a real clock.
 */

function setup() {
  return convexTest(schema, modules);
}

type Harness = ReturnType<typeof setup>;
type Identity = ReturnType<Harness["withIdentity"]>;
type Person = { userId: Id<"users">; as: Identity };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

async function createUser(t: Harness, name: string, email: string) {
  const authId = `auth_${email}`;
  const userId = await t.run(
    async (ctx) => await ctx.db.insert("users", { authId, name, email }),
  );
  return { userId, as: t.withIdentity({ subject: authId, name, email }) };
}

async function addFullMember(
  t: Harness,
  owner: Person,
  organizationId: Id<"organizations">,
  name: string,
  email: string,
) {
  const member = await createUser(t, name, email);
  const { code } = await owner.as.mutation(api.invites.create, {
    organizationId,
    expiry: "7d",
  });
  await member.as.mutation(api.invites.accept, { code });
  return member;
}

/**
 * Jana owns the organization, Petr and Eva are ordinary members who see every
 * project. Eva is the one things get hidden from.
 */
async function team(t: Harness) {
  const jana = await createUser(t, "Jana Nováková", "jana@example.com");
  const { organizationId } = await jana.as.mutation(api.organizations.create, {
    name: "Studio",
  });
  const { projectId } = await jana.as.mutation(api.projects.create, {
    organizationId,
    name: "Web",
  });
  const petr = await addFullMember(t, jana, organizationId, "Petr Malý", "petr@example.com");
  const eva = await addFullMember(t, jana, organizationId, "Eva Dvořáková", "eva@example.com");
  const statuses = await jana.as.query(api.taskStatuses.list, { projectId });
  return { jana, petr, eva, organizationId, projectId, statusId: statuses[0]._id };
}

async function addTask(
  author: Person,
  projectId: Id<"projects">,
  statusId: Id<"taskStatuses">,
  title: string,
  hiddenFrom?: Id<"users">[],
) {
  const { taskId } = await author.as.mutation(api.tasks.create, {
    projectId,
    statusId,
    title,
    hiddenFrom,
  });
  return taskId;
}

function mention(userId: Id<"users">, name: string, before = "Mrkni ") {
  return serializeCommentBody([
    { type: "text", text: before },
    { type: "mention", userId, name },
  ]);
}

function queuedFor(t: Harness, userId: Id<"users">) {
  return t.run(async (ctx) =>
    await ctx.db
      .query("notificationEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
  );
}

function feedRowsFor(t: Harness, userId: Id<"users">) {
  return t.run(async (ctx) =>
    (await ctx.db.query("notificationItems").collect()).filter(
      (row) => row.userId === userId,
    ),
  );
}

describe("what a hidden person cannot read", () => {
  test("the board, the detail and everything hanging off the task", async () => {
    const t = setup();
    const { jana, petr, eva, organizationId, projectId, statusId } = await team(t);
    await addTask(jana, projectId, statusId, "Viditelný");
    const secret = await addTask(jana, projectId, statusId, "Dárek pro Evu", [
      eva.userId,
    ]);
    await jana.as.mutation(api.taskContent.save, {
      taskId: secret,
      content: JSON.stringify([
        { id: "a", type: "paragraph", props: {}, content: [], children: [] },
      ]),
    });
    const storageId = await t.run(
      async (ctx) => await ctx.storage.store(new Blob([new Uint8Array([1, 2, 3])])),
    );
    const registered = await jana.as.mutation(api.files.register, {
      taskId: secret,
      storageId,
      fileName: "seznam.txt",
      mimeType: "text/plain",
      context: "attachment",
    });
    expect(registered.ok).toBe(true);
    await jana.as.mutation(api.comments.create, {
      taskId: secret,
      body: mention(petr.userId, "Petr Malý"),
    });

    const evaBoard = await eva.as.query(api.tasks.listByProject, { projectId });
    expect(evaBoard.map((task) => task.title)).toEqual(["Viditelný"]);
    expect(evaBoard[0].restricted).toBe(false);
    const petrBoard = await petr.as.query(api.tasks.listByProject, { projectId });
    expect(petrBoard.find((task) => task._id === secret)?.restricted).toBe(true);

    expect(await eva.as.query(api.tasks.get, { taskId: secret })).toBeNull();
    expect(await eva.as.query(api.taskContent.get, { taskId: secret })).toBeNull();
    expect(await eva.as.query(api.files.listByTask, { taskId: secret })).toEqual([]);
    expect(await eva.as.query(api.comments.listByTask, { taskId: secret })).toEqual([]);

    const workspace = await eva.as.query(api.workspace.listTasks, {});
    expect(workspace.items.map((item) => item.title)).toEqual(["Viditelný"]);

    // The counts would give it away just as well as the title.
    const unread = await eva.as.query(api.taskSeen.unreadByProject, { projectId });
    expect(unread.map((entry) => entry.taskId)).not.toContain(secret);
    expect(unread).toHaveLength(1);
    expect(
      await eva.as.query(api.taskSeen.unreadByOrganization, { organizationId }),
    ).toEqual([{ projectId, count: 1 }]);

    const evaFeed = await eva.as.query(api.notificationItems.list, { organizationId });
    expect(evaFeed.map((item) => item.taskTitle)).toEqual(["Viditelný"]);
    expect(
      await eva.as.query(api.notificationItems.unreadCount, { organizationId }),
    ).toBe(1);

    // Everybody else sees it, and who it is hidden from.
    const forPetr = await petr.as.query(api.tasks.get, { taskId: secret });
    expect(forPetr?.hiddenFrom).toEqual([eva.userId]);
    expect(forPetr?.canEditVisibility).toBe(false);
    expect((await jana.as.query(api.tasks.get, { taskId: secret }))?.canEditVisibility).toBe(true);
  });

  test("every write refuses with the sentence of a deleted task", async () => {
    const t = setup();
    const { jana, eva, projectId, statusId } = await team(t);
    const secret = await addTask(jana, projectId, statusId, "Tajný", [eva.userId]);
    const { commentId } = await jana.as.mutation(api.comments.create, {
      taskId: secret,
      body: serializeCommentBody([{ type: "text", text: "Psst" }]),
    });
    const storageId = await t.run(
      async (ctx) => await ctx.storage.store(new Blob([new Uint8Array([4, 5])])),
    );
    const registered = await jana.as.mutation(api.files.register, {
      taskId: secret,
      storageId,
      fileName: "plan.txt",
      mimeType: "text/plain",
      context: "attachment",
    });
    if (!registered.ok) {
      throw new Error(registered.error);
    }
    const fileId = registered.file._id;

    // What the same calls answer for a task that really was deleted —
    // with its comment and its file, which go with it.
    const deleted = await addTask(jana, projectId, statusId, "Smazaný");
    const { commentId: deletedComment } = await jana.as.mutation(api.comments.create, {
      taskId: deleted,
      body: serializeCommentBody([{ type: "text", text: "Pryč" }]),
    });
    await jana.as.mutation(api.tasks.remove, { taskId: deleted });
    await expect(
      eva.as.mutation(api.tasks.updateTitle, { taskId: deleted, title: "x" }),
    ).rejects.toThrow("Tento úkol už neexistuje.");
    await expect(
      eva.as.mutation(api.comments.remove, { commentId: deletedComment }),
    ).rejects.toThrow("Tento komentář už neexistuje.");

    // Thunks, so each rejection is awaited where it happens.
    const byTask = [
      () => eva.as.mutation(api.tasks.updateTitle, { taskId: secret, title: "Moje" }),
      () => eva.as.mutation(api.tasks.move, { taskId: secret, statusId }),
      () => eva.as.mutation(api.tasks.setAssignee, { taskId: secret, assigneeId: eva.userId }),
      () => eva.as.mutation(api.tasks.remove, { taskId: secret }),
      () =>
        eva.as.mutation(api.tasks.setHiddenFrom, {
          taskId: secret,
          userId: eva.userId,
          hidden: false,
        }),
      () => eva.as.mutation(api.taskContent.save, { taskId: secret, content: "[]" }),
      () => eva.as.mutation(api.files.generateUploadUrl, { taskId: secret }),
      () =>
        eva.as.mutation(api.comments.create, {
          taskId: secret,
          body: serializeCommentBody([{ type: "text", text: "Ahoj" }]),
        }),
      () => eva.as.mutation(api.taskSeen.markSeen, { taskId: secret }),
    ];
    for (const attempt of byTask) {
      await expect(attempt()).rejects.toThrow("Tento úkol už neexistuje.");
    }
    const byComment = [
      () =>
        eva.as.mutation(api.comments.update, {
          commentId,
          body: serializeCommentBody([{ type: "text", text: "Přepsáno" }]),
        }),
      () => eva.as.mutation(api.comments.remove, { commentId }),
      () => eva.as.mutation(api.commentReactions.toggle, { commentId, emoji: "👍" }),
    ];
    for (const attempt of byComment) {
      await expect(attempt()).rejects.toThrow("Tento komentář už neexistuje.");
    }
    await expect(
      eva.as.mutation(api.files.remove, { fileId }),
    ).rejects.toThrow("Tento soubor už neexistuje.");

    const task = await jana.as.query(api.tasks.get, { taskId: secret });
    expect(task?.title).toBe("Tajný");
    expect(await jana.as.query(api.comments.listByTask, { taskId: secret })).toHaveLength(1);
    expect(await jana.as.query(api.files.listByTask, { taskId: secret })).toHaveLength(1);
  });

  test("a hidden task is no neighbour to drop a card next to", async () => {
    const t = setup();
    const { jana, eva, projectId, statusId } = await team(t);
    const statuses = await jana.as.query(api.taskStatuses.list, { projectId });
    const done = statuses[2]._id;
    const first = await addTask(jana, projectId, statusId, "První");
    const secret = await addTask(jana, projectId, statusId, "Tajný", [eva.userId]);
    await addTask(jana, projectId, statusId, "Poslední");
    const mine = await addTask(eva, projectId, done, "Evin");

    // Eva remembers the hidden id and drops her card "after" it. Honoured,
    // that would land it mid-column and say where the hidden task is.
    await eva.as.mutation(api.tasks.move, {
      taskId: mine,
      statusId,
      previousTaskId: secret,
    });
    const board = await jana.as.query(api.tasks.listByProject, { projectId });
    expect(board.filter((task) => task.statusId === statusId).map((task) => task.title)).toEqual([
      "První",
      "Tajný",
      "Poslední",
      "Evin",
    ]);

    // A visible neighbour still places it exactly.
    await eva.as.mutation(api.tasks.move, {
      taskId: mine,
      statusId,
      previousTaskId: first,
    });
    const evaBoard = await eva.as.query(api.tasks.listByProject, { projectId });
    expect(evaBoard.map((task) => task.title)).toEqual(["První", "Evin", "Poslední"]);
    expect(evaBoard[0]).not.toHaveProperty("order");
  });

  test("deleting a status does not count the tasks hidden from the caller", async () => {
    const t = setup();
    const { jana, eva, projectId, statusId } = await team(t);
    const { statusId: review } = await jana.as.mutation(api.taskStatuses.create, {
      projectId,
      name: "Revize",
      color: "amber",
    });
    await addTask(jana, projectId, review, "Viditelný");
    const secret = await addTask(jana, projectId, review, "Tajný", [eva.userId]);

    const result = await eva.as.mutation(api.taskStatuses.remove, {
      statusId: review,
      moveTasksToStatusId: statusId,
    });
    expect(result).toEqual({ movedTasks: 1 });
    // The hidden task still moved with its column: never orphaned.
    const moved = await jana.as.query(api.tasks.get, { taskId: secret });
    expect(moved?.statusId).toBe(statusId);
  });

  test("the workspace fills its page past tasks hidden from the caller", async () => {
    const t = setup();
    const { jana, eva, projectId, statusId } = await team(t);
    for (const title of ["Starší 1", "Starší 2", "Starší 3"]) {
      await addTask(jana, projectId, statusId, title);
      vi.advanceTimersByTime(1);
    }
    for (let index = 0; index < 5; index += 1) {
      await addTask(jana, projectId, statusId, `Tajný ${index}`, [eva.userId]);
      vi.advanceTimersByTime(1);
    }

    const page = await eva.as.query(api.workspace.listTasks, { limit: 2 });
    expect(page.items.map((item) => item.title)).toEqual(["Starší 3", "Starší 2"]);
    expect(page.hasMore).toBe(true);

    const all = await eva.as.query(api.workspace.listTasks, { limit: 10 });
    expect(all.items).toHaveLength(3);
    expect(all.hasMore).toBe(false);

    const forJana = await jana.as.query(api.workspace.listTasks, { limit: 10 });
    expect(forJana.items).toHaveLength(8);
    expect(forJana.items[0].restricted).toBe(true);
  });
});

describe("who decides, and who can be hidden", () => {
  test("the author and project managers, nobody else", async () => {
    const t = setup();
    const { jana, petr, eva, projectId, statusId } = await team(t);
    const petrsTask = await addTask(petr, projectId, statusId, "Petrův");

    await expect(
      eva.as.mutation(api.tasks.setHiddenFrom, {
        taskId: petrsTask,
        userId: jana.userId,
        hidden: true,
      }),
    ).rejects.toThrow(/jen jeho autor nebo správce projektu/);

    await petr.as.mutation(api.tasks.setHiddenFrom, {
      taskId: petrsTask,
      userId: eva.userId,
      hidden: true,
    });
    // Hiding twice is not an error, and not a second list entry.
    await petr.as.mutation(api.tasks.setHiddenFrom, {
      taskId: petrsTask,
      userId: eva.userId,
      hidden: true,
    });
    expect((await petr.as.query(api.tasks.get, { taskId: petrsTask }))?.hiddenFrom).toEqual([
      eva.userId,
    ]);

    // A manager may undo it — even on somebody else's task.
    await jana.as.mutation(api.tasks.setHiddenFrom, {
      taskId: petrsTask,
      userId: eva.userId,
      hidden: false,
    });
    expect((await eva.as.query(api.tasks.get, { taskId: petrsTask }))?.title).toBe("Petrův");

    const logs = await t.run(async (ctx) =>
      (await ctx.db.query("activityLogs").collect()).filter(
        (row) => row.type === "task_visibility_changed",
      ),
    );
    expect(logs.map((row) => row.meta.hidden)).toEqual([true, false]);
  });

  test("never yourself, never the author, never the řešitel, never an outsider", async () => {
    const t = setup();
    const { jana, petr, eva, projectId, statusId } = await team(t);
    const outsider = await createUser(t, "Cizí Člověk", "cizi@example.com");
    const petrsTask = await addTask(petr, projectId, statusId, "Petrův");

    await expect(
      jana.as.mutation(api.tasks.setHiddenFrom, {
        taskId: petrsTask,
        userId: jana.userId,
        hidden: true,
      }),
    ).rejects.toThrow(/Sami před sebou/);
    await expect(
      jana.as.mutation(api.tasks.setHiddenFrom, {
        taskId: petrsTask,
        userId: petr.userId,
        hidden: true,
      }),
    ).rejects.toThrow(/Před autorem/);

    await petr.as.mutation(api.tasks.setAssignee, {
      taskId: petrsTask,
      assigneeId: eva.userId,
    });
    await expect(
      petr.as.mutation(api.tasks.setHiddenFrom, {
        taskId: petrsTask,
        userId: eva.userId,
        hidden: true,
      }),
    ).rejects.toThrow(/Před řešitelem/);

    await expect(
      petr.as.mutation(api.tasks.setHiddenFrom, {
        taskId: petrsTask,
        userId: outsider.userId,
        hidden: true,
      }),
    ).rejects.toThrow(/nemá přístup k projektu/);

    await expect(
      addTask(petr, projectId, statusId, "Před sebou", [petr.userId]),
    ).rejects.toThrow(/Sami před sebou/);
    await expect(
      addTask(petr, projectId, statusId, "Cizímu", [outsider.userId]),
    ).rejects.toThrow(/nemá přístup k projektu/);
    // A refused create leaves nothing behind.
    const board = await jana.as.query(api.tasks.listByProject, { projectId });
    expect(board.map((task) => task.title)).toEqual(["Petrův"]);
  });

  test("a hidden person cannot be made řešitel or be mentioned", async () => {
    const t = setup();
    const { jana, eva, projectId, statusId } = await team(t);
    const taskId = await addTask(jana, projectId, statusId, "Tajný", [eva.userId]);

    await expect(
      jana.as.mutation(api.tasks.setAssignee, { taskId, assigneeId: eva.userId }),
    ).rejects.toThrow(/Před tímto člověkem je úkol skrytý/);
    await expect(
      jana.as.mutation(api.comments.create, {
        taskId,
        body: mention(eva.userId, "Eva Dvořáková"),
      }),
    ).rejects.toThrow(/Před zmíněným člověkem je úkol skrytý/);
    expect(await queuedFor(t, eva.userId)).toEqual([]);
    expect(await feedRowsFor(t, eva.userId)).toEqual([]);
  });

  test("an old mention does not block editing the comment that holds it", async () => {
    const t = setup();
    const { jana, eva, projectId, statusId } = await team(t);
    const taskId = await addTask(jana, projectId, statusId, "Úkol");
    const { commentId } = await jana.as.mutation(api.comments.create, {
      taskId,
      body: mention(eva.userId, "Eva Dvořáková"),
    });
    await jana.as.mutation(api.tasks.setHiddenFrom, {
      taskId,
      userId: eva.userId,
      hidden: true,
    });

    await jana.as.mutation(api.comments.update, {
      commentId,
      body: mention(eva.userId, "Eva Dvořáková", "Opraveno, "),
    });
    // Editing queues nothing, so nothing reached her.
    expect(await queuedFor(t, eva.userId)).toEqual([]);
  });
});

describe("notifications about a hidden task", () => {
  test("a task created hidden reaches everybody's feed but theirs", async () => {
    const t = setup();
    const { jana, petr, eva, projectId, statusId } = await team(t);
    await addTask(jana, projectId, statusId, "Tajný", [eva.userId]);

    expect(await feedRowsFor(t, eva.userId)).toEqual([]);
    expect((await feedRowsFor(t, petr.userId)).map((row) => row.kind)).toEqual([
      "task_created",
    ]);
  });

  test("hiding clears the queued e-mail, the feed rows and the read state", async () => {
    const t = setup();
    const { jana, eva, organizationId, projectId, statusId } = await team(t);
    const taskId = await addTask(jana, projectId, statusId, "Zatím veřejný");
    const other = await addTask(jana, projectId, statusId, "Jiný");
    await jana.as.mutation(api.tasks.setAssignee, { taskId: other, assigneeId: eva.userId });
    await jana.as.mutation(api.comments.create, {
      taskId,
      body: mention(eva.userId, "Eva Dvořáková"),
    });
    await eva.as.mutation(api.taskSeen.markSeen, { taskId: other });

    expect(
      (await queuedFor(t, eva.userId)).map((row) => row.taskId).sort(),
    ).toEqual([taskId, other].sort());
    expect(
      (await feedRowsFor(t, eva.userId)).some((row) => row.taskId === taskId),
    ).toBe(true);

    await jana.as.mutation(api.tasks.setHiddenFrom, {
      taskId,
      userId: eva.userId,
      hidden: true,
    });

    // Only the hidden task's rows went; the other task is untouched.
    expect((await queuedFor(t, eva.userId)).map((row) => row.taskId)).toEqual([other]);
    expect(
      (await feedRowsFor(t, eva.userId)).every((row) => row.taskId === other),
    ).toBe(true);

    const digest = await t.mutation(internal.notifications.claim, {
      userId: eva.userId,
    });
    expect(digest?.total).toBe(1);
    expect(JSON.stringify(digest)).not.toContain("Zatím veřejný");
    expect(
      await eva.as.query(api.notificationItems.list, { organizationId }),
    ).not.toContainEqual(expect.objectContaining({ taskId }));
  });

  test("the send-time check drops a queued row the task is now hidden behind", async () => {
    const t = setup();
    const { jana, eva, projectId, statusId } = await team(t);
    const taskId = await addTask(jana, projectId, statusId, "Úkol");
    await jana.as.mutation(api.tasks.setAssignee, { taskId, assigneeId: eva.userId });
    expect(await queuedFor(t, eva.userId)).toHaveLength(1);

    // Hidden behind every writer's back, straight in the database.
    await t.run(async (ctx) => {
      await ctx.db.patch(taskId, { assigneeId: undefined, hiddenFrom: [eva.userId] });
    });
    expect(await queuedFor(t, eva.userId)).toHaveLength(1);
    expect(
      await t.mutation(internal.notifications.claim, { userId: eva.userId }),
    ).toBeNull();
  });

  test("the writers skip a hidden recipient even when a caller names one", async () => {
    const t = setup();
    const { jana, eva, projectId, statusId } = await team(t);
    const taskId = await addTask(jana, projectId, statusId, "Tajný", [eva.userId]);
    const { commentId } = await jana.as.mutation(api.comments.create, {
      taskId,
      body: serializeCommentBody([{ type: "text", text: "Ahoj" }]),
    });

    await t.run(async (ctx) => {
      const task = (await ctx.db.get(taskId))!;
      await notifyComment(ctx, task, commentId, [eva.userId], jana.userId);
    });
    expect(await queuedFor(t, eva.userId)).toEqual([]);
    expect(await feedRowsFor(t, eva.userId)).toEqual([]);
  });

  test("shown again, the task comes back as new", async () => {
    const t = setup();
    const { jana, eva, projectId, statusId } = await team(t);
    const taskId = await addTask(jana, projectId, statusId, "Překvapení", [eva.userId]);

    await jana.as.mutation(api.tasks.setHiddenFrom, {
      taskId,
      userId: eva.userId,
      hidden: false,
    });
    expect((await jana.as.query(api.tasks.get, { taskId }))?.hiddenFrom).toEqual([]);
    const board = await eva.as.query(api.tasks.listByProject, { projectId });
    expect(board.map((task) => task.title)).toEqual(["Překvapení"]);
    const unread = await eva.as.query(api.taskSeen.unreadByProject, { projectId });
    expect(unread).toEqual([{ taskId, unreadComments: 0, isNew: true }]);
  });
});

describe("bots", () => {
  /** Jana's bot Codie is a full member; Petr is the one hiding things. */
  async function withBot(t: Harness) {
    const base = await team(t);
    const { token } = await base.jana.as.action(api.apiTokens.create, { name: "Grok" });
    const tokenHash = await hashApiToken(token);
    const { botId } = await t.mutation(internal.bots.syncIdentity, {
      tokenHash,
      name: "Codie",
    });
    await base.jana.as.mutation(api.bots.addToOrganization, {
      organizationId: base.organizationId,
      botId,
      access: "full",
    });
    return { ...base, tokenHash, botId };
  }

  test("a task hidden from the owner is hidden from their bot", async () => {
    const t = setup();
    const { jana, petr, projectId, statusId, tokenHash, botId } = await withBot(t);
    await addTask(petr, projectId, statusId, "Viditelný");
    const secret = await addTask(petr, projectId, statusId, "Dárek pro Janu", [
      jana.userId,
    ]);

    const board = await t.query(internal.mcpTools.listTasks, { tokenHash, projectId });
    expect(board.tasks.map((task) => task.title)).toEqual(["Viditelný"]);
    const found = await t.query(internal.mcpTools.search, { tokenHash, query: "dárek" });
    expect(found.tasks).toEqual([]);
    await expect(
      t.query(internal.mcpTools.getTask, { tokenHash, taskId: secret }),
    ).rejects.toThrow("Tento úkol už neexistuje.");
    await expect(
      t.mutation(internal.mcpTools.addComment, { tokenHash, taskId: secret, text: "Ahoj" }),
    ).rejects.toThrow("Tento úkol už neexistuje.");

    // And it cannot be handed the task its owner may not see.
    await expect(
      petr.as.mutation(api.tasks.setAssignee, { taskId: secret, assigneeId: botId }),
    ).rejects.toThrow(/Před tímto člověkem je úkol skrytý/);
  });

  test("a task hidden from the bot itself is hidden from it", async () => {
    const t = setup();
    const { petr, projectId, statusId, tokenHash, botId } = await withBot(t);
    const secret = await addTask(petr, projectId, statusId, "Bez bota", [botId]);

    const board = await t.query(internal.mcpTools.listTasks, { tokenHash, projectId });
    expect(board.tasks).toEqual([]);
    await expect(
      t.query(internal.mcpTools.getTask, { tokenHash, taskId: secret }),
    ).rejects.toThrow("Tento úkol už neexistuje.");
  });

  test("the owner of the řešitel bot cannot be hidden", async () => {
    const t = setup();
    const { jana, petr, projectId, statusId, botId } = await withBot(t);
    const taskId = await addTask(petr, projectId, statusId, "Pro Codieho");
    await petr.as.mutation(api.tasks.setAssignee, { taskId, assigneeId: botId });

    await expect(
      petr.as.mutation(api.tasks.setHiddenFrom, {
        taskId,
        userId: jana.userId,
        hidden: true,
      }),
    ).rejects.toThrow(/Řešitelem úkolu je bot tohoto člověka/);
  });

  test("a bot that can see the task is told who it is hidden from", async () => {
    const t = setup();
    const { petr, eva, projectId, statusId, tokenHash } = await withBot(t);
    const secret = await addTask(petr, projectId, statusId, "Tajný", [eva.userId]);

    const task = await t.query(internal.mcpTools.getTask, { tokenHash, taskId: secret });
    expect(task.hiddenFrom).toEqual([
      { userId: eva.userId, name: "Eva Dvořáková", isBot: false },
    ]);
    const board = await t.query(internal.mcpTools.listTasks, { tokenHash, projectId });
    expect(board.tasks[0].hidden).toBe(true);
  });
});

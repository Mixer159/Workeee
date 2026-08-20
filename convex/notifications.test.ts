import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { MAX_WAIT_MS, QUIET_MS } from "./lib/notifications";
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
 * Batching, and the checks that run again at send time.
 *
 * Timers are faked throughout. `scheduleFlush` schedules with
 * `scheduler.runAt`, so with a real clock "did the second task schedule a
 * second e-mail?" is a race rather than an assertion — and the sliding window
 * is measured in minutes, which no test is going to wait out. `vi.setSystemTime`
 * moves `Date.now()` forward **without** firing anything, which is exactly what
 * a test of the window needs.
 *
 * Nothing here reaches the network: `sendTransactionalEmail` returns early
 * without `BREVO_API_KEY`, so even the flush action is safe to run.
 */

function setup() {
  return convexTest(schema, modules);
}

type Harness = ReturnType<typeof setup>;
/** A signed-in view of the harness — what `t.withIdentity` hands back. */
type Identity = ReturnType<Harness["withIdentity"]>;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * The app `users` table is normally written by the Better Auth triggers. Tests
 * insert the mirror row directly and sign in as `authId`, which is what
 * `getAuthUserId` resolves through.
 */
async function createUser(t: Harness, name: string, email: string) {
  const authId = `auth_${email}`;
  const userId = await t.run(
    async (ctx) => await ctx.db.insert("users", { authId, name, email }),
  );
  return { userId, as: t.withIdentity({ subject: authId, name, email }) };
}

/** An owner, their organization and one project with its seeded board. */
async function createWorkspace(t: Harness) {
  const owner = await createUser(t, "Jana Nováková", "jana@example.com");
  const { organizationId } = await owner.as.mutation(api.organizations.create, {
    name: "Studio",
  });
  const { projectId } = await owner.as.mutation(api.projects.create, {
    organizationId,
    name: "Web",
  });
  const statuses = await owner.as.query(api.taskStatuses.list, { projectId });
  return { owner, organizationId, projectId, statusId: statuses[0]._id };
}

/** A second person inside the same organization, seeing every project. */
async function addFullMember(
  t: Harness,
  owner: { as: Identity },
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

function pendingFor(t: Harness, userId: Id<"users">) {
  return t.run(async (ctx) =>
    await ctx.db
      .query("notificationEvents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect(),
  );
}

function windowFor(t: Harness, userId: Id<"users">) {
  return t.run(async (ctx) =>
    await ctx.db
      .query("notificationBatches")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique(),
  );
}

async function addTask(
  owner: { as: Identity },
  projectId: Id<"projects">,
  statusId: Id<"taskStatuses">,
  title: string,
) {
  const { taskId } = await owner.as.mutation(api.tasks.create, {
    projectId,
    statusId,
    title,
  });
  return taskId;
}

/**
 * A task handed to somebody, which is what puts a task line in their e-mail
 * queue — creating one no longer does, it only writes the in-app feed.
 */
async function addAssignedTask(
  owner: { as: Identity },
  projectId: Id<"projects">,
  statusId: Id<"taskStatuses">,
  title: string,
  assigneeId: Id<"users">,
) {
  const taskId = await addTask(owner, projectId, statusId, title);
  await owner.as.mutation(api.tasks.setAssignee, { taskId, assigneeId });
  return taskId;
}

describe("who gets queued", () => {
  test("a new task queues no e-mail for anybody", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );

    await addTask(owner, projectId, statusId, "Opravit fakturaci");

    expect(await pendingFor(t, petr.userId)).toHaveLength(0);
    expect(await pendingFor(t, owner.userId)).toHaveLength(0);

    // Only the inbox got quieter: the feed still tells everybody who can open
    // the project that the task exists.
    const items = await t.run(async (ctx) =>
      await ctx.db
        .query("notificationItems")
        .withIndex("by_user_org", (q) =>
          q.eq("userId", petr.userId).eq("organizationId", organizationId),
        )
        .collect(),
    );
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("task_created");
  });

  test("somebody who cannot open the project hears nothing", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);

    // A second project, and a `limited` member invited only to that one.
    const other = await owner.as.mutation(api.projects.create, {
      organizationId,
      name: "Mobil",
    });
    const outsider = await createUser(t, "Eva Dvořáková", "eva@example.com");
    const { code } = await owner.as.mutation(api.invites.create, {
      organizationId,
      projectId: other.projectId,
      expiry: "7d",
    });
    await outsider.as.mutation(api.invites.accept, { code });

    const taskId = await addTask(owner, projectId, statusId, "Opravit fakturaci");

    // The two things that do mail are both refused for her: she cannot be
    // handed a task she cannot open, and she cannot be named under one.
    await expect(
      owner.as.mutation(api.tasks.setAssignee, {
        taskId,
        assigneeId: outsider.userId,
      }),
    ).rejects.toThrow();
    await expect(
      owner.as.mutation(api.comments.create, {
        taskId,
        body: JSON.stringify([
          { type: "text", text: "Mrkni na to " },
          {
            type: "mention",
            userId: outsider.userId,
            name: "Eva Dvořáková",
          },
        ]),
      }),
    ).rejects.toThrow();

    expect(await pendingFor(t, outsider.userId)).toHaveLength(0);
  });

  test("assigning notifies the řešitel, not the person doing the assigning", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );
    const taskId = await addTask(owner, projectId, statusId, "Opravit fakturaci");

    await owner.as.mutation(api.tasks.setAssignee, {
      taskId,
      assigneeId: petr.userId,
    });

    const pending = await pendingFor(t, petr.userId);
    expect(pending).toHaveLength(1);
    expect(pending[0].kind).toBe("task_assigned");
    expect(await pendingFor(t, owner.userId)).toHaveLength(0);
  });

  test("taking a task yourself notifies nobody", async () => {
    const t = setup();
    const { owner, projectId, statusId } = await createWorkspace(t);
    const taskId = await addTask(owner, projectId, statusId, "Opravit fakturaci");

    await owner.as.mutation(api.tasks.setAssignee, {
      taskId,
      assigneeId: owner.userId,
    });

    expect(await pendingFor(t, owner.userId)).toHaveLength(0);
  });

  test("assigned twice inside one window is one line, not two", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );

    const taskId = await addAssignedTask(
      owner,
      projectId,
      statusId,
      "Opravit fakturaci",
      petr.userId,
    );
    // Handed away and handed back: two notifications about one task.
    await owner.as.mutation(api.tasks.setAssignee, {
      taskId,
      assigneeId: owner.userId,
    });
    await owner.as.mutation(api.tasks.setAssignee, {
      taskId,
      assigneeId: petr.userId,
    });

    const pending = await pendingFor(t, petr.userId);
    expect(pending).toHaveLength(1);
    expect(pending[0].kind).toBe("task_assigned");
  });
});

describe("comments", () => {
  /** The composer's wire format: plain text, plus a real mention segment. */
  function body(text: string, mention?: { userId: Id<"users">; name: string }) {
    const segments: unknown[] = [{ type: "text", text }];
    if (mention) {
      segments.push({ type: "mention", ...mention });
    }
    return JSON.stringify(segments);
  }

  test("a mention reaches the person named, and nobody else", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );
    const eva = await addFullMember(
      t,
      owner,
      organizationId,
      "Eva Dvořáková",
      "eva@example.com",
    );

    const taskId = await addTask(owner, projectId, statusId, "Opravit fakturaci");

    await owner.as.mutation(api.comments.create, {
      taskId,
      body: body("Mrkni na to ", { userId: petr.userId, name: "Petr Svoboda" }),
    });

    const pending = await pendingFor(t, petr.userId);
    expect(pending).toHaveLength(1);
    expect(pending[0].kind).toBe("comment_mention");
    // Eva can see the project, but the comment is not about her.
    expect(await pendingFor(t, eva.userId)).toHaveLength(0);
  });

  test("the řešitel hears about a comment on their task", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );

    const taskId = await addTask(owner, projectId, statusId, "Opravit fakturaci");
    await owner.as.mutation(api.tasks.setAssignee, {
      taskId,
      assigneeId: petr.userId,
    });
    await t.mutation(internal.notifications.claim, { userId: petr.userId });

    await owner.as.mutation(api.comments.create, {
      taskId,
      body: body("Tohle je potřeba do pátku."),
    });

    const pending = await pendingFor(t, petr.userId);
    expect(pending).toHaveLength(1);
    expect(pending[0].kind).toBe("comment_added");
  });

  test("your own comment never notifies you", async () => {
    const t = setup();
    const { owner, projectId, statusId } = await createWorkspace(t);
    const taskId = await addTask(owner, projectId, statusId, "Opravit fakturaci");
    await owner.as.mutation(api.tasks.setAssignee, {
      taskId,
      assigneeId: owner.userId,
    });

    await owner.as.mutation(api.comments.create, {
      taskId,
      body: body("Poznámka pro sebe."),
    });

    expect(await pendingFor(t, owner.userId)).toHaveLength(0);
  });

  test("a comment does not overwrite the task it was written under", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );

    const taskId = await addAssignedTask(
      owner,
      projectId,
      statusId,
      "Opravit fakturaci",
      petr.userId,
    );
    await owner.as.mutation(api.comments.create, {
      taskId,
      body: body("Hned k tomu ", { userId: petr.userId, name: "Petr Svoboda" }),
    });

    // Two rows: one per category. Without the split the comment would have
    // replaced the notification about the assignment itself.
    const pending = await pendingFor(t, petr.userId);
    expect(pending).toHaveLength(2);
    expect(pending.map((event) => event.kind).sort()).toEqual([
      "comment_mention",
      "task_assigned",
    ]);

    const digest = await t.mutation(internal.notifications.claim, {
      userId: petr.userId,
    });
    expect(digest!.taskCount).toBe(1);
    expect(digest!.commentCount).toBe(1);
  });

  test("ten replies are one line with a count, not ten lines", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );

    const taskId = await addTask(owner, projectId, statusId, "Opravit fakturaci");
    await owner.as.mutation(api.tasks.setAssignee, {
      taskId,
      assigneeId: petr.userId,
    });
    await t.mutation(internal.notifications.claim, { userId: petr.userId });

    for (let index = 0; index < 10; index += 1) {
      await owner.as.mutation(api.comments.create, {
        taskId,
        body: body(`Zpráva ${index + 1}`),
      });
    }

    expect(await pendingFor(t, petr.userId)).toHaveLength(1);

    const digest = await t.mutation(internal.notifications.claim, {
      userId: petr.userId,
    });
    const item = digest!.projects[0].items[0];
    expect(item.type).toBe("comment");
    expect(item).toMatchObject({ count: 10, preview: "Zpráva 10" });
  });

  test("a mention keeps its own quote when unrelated chatter follows", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );

    const taskId = await addTask(owner, projectId, statusId, "Opravit fakturaci");
    await owner.as.mutation(api.tasks.setAssignee, {
      taskId,
      assigneeId: petr.userId,
    });
    await t.mutation(internal.notifications.claim, { userId: petr.userId });

    await owner.as.mutation(api.comments.create, {
      taskId,
      body: body("Tohle je na tebe ", {
        userId: petr.userId,
        name: "Petr Svoboda",
      }),
    });
    await owner.as.mutation(api.comments.create, {
      taskId,
      body: body("Ještě něco nesouvisejícího."),
    });

    const digest = await t.mutation(internal.notifications.claim, {
      userId: petr.userId,
    });
    const item = digest!.projects[0].items[0];
    // The sentence that named him survives; the chatter only bumps the count.
    expect(item).toMatchObject({
      kind: "comment_mention",
      count: 2,
      preview: "Tohle je na tebe @Petr Svoboda",
    });
  });

  test("a comment deleted inside the window drops its line", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );

    const taskId = await addTask(owner, projectId, statusId, "Opravit fakturaci");
    await owner.as.mutation(api.tasks.setAssignee, {
      taskId,
      assigneeId: petr.userId,
    });
    await t.mutation(internal.notifications.claim, { userId: petr.userId });

    const { commentId } = await owner.as.mutation(api.comments.create, {
      taskId,
      body: body("Omyl, mažu."),
    });
    await owner.as.mutation(api.comments.remove, { commentId });

    expect(
      await t.mutation(internal.notifications.claim, { userId: petr.userId }),
    ).toBeNull();
  });

  test("editing a comment notifies nobody a second time", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );

    const taskId = await addTask(owner, projectId, statusId, "Opravit fakturaci");
    await owner.as.mutation(api.tasks.setAssignee, {
      taskId,
      assigneeId: petr.userId,
    });
    const { commentId } = await owner.as.mutation(api.comments.create, {
      taskId,
      body: body("Původní znění."),
    });
    await t.mutation(internal.notifications.claim, { userId: petr.userId });

    await owner.as.mutation(api.comments.update, {
      commentId,
      body: body("Opravený překlep."),
    });

    // A typo fix is not news.
    expect(await pendingFor(t, petr.userId)).toHaveLength(0);
  });

  test("the switch turns comments off too", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );

    await petr.as.mutation(api.notifications.setTaskEmails, { enabled: false });
    const taskId = await addTask(owner, projectId, statusId, "Opravit fakturaci");
    await owner.as.mutation(api.comments.create, {
      taskId,
      body: body("Ahoj ", { userId: petr.userId, name: "Petr Svoboda" }),
    });

    expect(await pendingFor(t, petr.userId)).toHaveLength(0);
  });
});

describe("the batching window", () => {
  test("eight tasks queue eight events but schedule exactly one e-mail", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );

    for (let index = 0; index < 8; index += 1) {
      await addAssignedTask(
        owner,
        projectId,
        statusId,
        `Úkol ${index + 1}`,
        petr.userId,
      );
      // Half a minute of typing between tasks.
      vi.setSystemTime(Date.now() + 30_000);
    }

    expect(await pendingFor(t, petr.userId)).toHaveLength(8);

    const windows = await t.run(
      async (ctx) => await ctx.db.query("notificationBatches").collect(),
    );
    expect(windows).toHaveLength(1);
    expect(windows[0].userId).toBe(petr.userId);
  });

  test("each task slides the send further out", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );

    await addAssignedTask(owner, projectId, statusId, "První", petr.userId);
    const first = await windowFor(t, petr.userId);

    vi.setSystemTime(Date.now() + 30_000);
    await addAssignedTask(owner, projectId, statusId, "Druhý", petr.userId);
    const second = await windowFor(t, petr.userId);

    expect(second!._id).toBe(first!._id);
    expect(second!.flushAt).toBe(first!.flushAt + 30_000);
    expect(second!.firstEventAt).toBe(first!.firstEventAt);
  });

  test("but never past the hard cap", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );

    await addAssignedTask(owner, projectId, statusId, "První", petr.userId);
    const opened = (await windowFor(t, petr.userId))!;

    // Somebody who keeps adding tasks all morning must not postpone the digest
    // forever: past `MAX_WAIT_MS` it goes out and the next batch starts.
    for (let index = 0; index < 20; index += 1) {
      vi.setSystemTime(Date.now() + 60_000);
      await addAssignedTask(
        owner,
        projectId,
        statusId,
        `Další ${index}`,
        petr.userId,
      );
    }

    const held = (await windowFor(t, petr.userId))!;
    expect(held.flushAt).toBe(opened.firstEventAt + MAX_WAIT_MS);
    expect(held.flushAt).toBeLessThan(Date.now() + QUIET_MS);
  });
});

describe("the switch", () => {
  test("off means nothing is even queued", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );

    await petr.as.mutation(api.notifications.setTaskEmails, { enabled: false });
    await addAssignedTask(
      owner,
      projectId,
      statusId,
      "Opravit fakturaci",
      petr.userId,
    );

    expect(await pendingFor(t, petr.userId)).toHaveLength(0);
    expect(await windowFor(t, petr.userId)).toBeNull();
  });

  test("on is the default, with no row written", async () => {
    const t = setup();
    const { owner, organizationId } = await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );

    expect(await petr.as.query(api.notifications.settings, {})).toMatchObject({
      taskEmails: true,
      email: "petr@example.com",
    });
    const rows = await t.run(
      async (ctx) => await ctx.db.query("notificationSettings").collect(),
    );
    expect(rows).toHaveLength(0);
  });

  test("turning it off during the window drops the digest that was already queued", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );

    await addAssignedTask(
      owner,
      projectId,
      statusId,
      "Opravit fakturaci",
      petr.userId,
    );
    await petr.as.mutation(api.notifications.setTaskEmails, { enabled: false });

    expect(
      await t.mutation(internal.notifications.claim, { userId: petr.userId }),
    ).toBeNull();
    expect(await pendingFor(t, petr.userId)).toHaveLength(0);
  });
});

describe("what the flush checks again", () => {
  test("the digest names the project, the task and who added it", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );

    await addAssignedTask(
      owner,
      projectId,
      statusId,
      "Opravit fakturaci",
      petr.userId,
    );
    await addAssignedTask(
      owner,
      projectId,
      statusId,
      "Nasadit web",
      petr.userId,
    );

    const digest = await t.mutation(internal.notifications.claim, {
      userId: petr.userId,
    });

    expect(digest).toMatchObject({ email: "petr@example.com", total: 2 });
    expect(digest!.projects).toHaveLength(1);
    expect(digest!.projects[0].projectName).toBe("Web");
    expect(digest!.projects[0].items.map((item) => item.title)).toEqual([
      "Opravit fakturaci",
      "Nasadit web",
    ]);
    expect(digest!.projects[0].items[0].actorName).toBe("Jana Nováková");
  });

  test("the title is read live, so a renamed task arrives under its real name", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );

    const taskId = await addAssignedTask(
      owner,
      projectId,
      statusId,
      "Bez názvu",
      petr.userId,
    );
    await owner.as.mutation(api.tasks.updateTitle, {
      taskId,
      title: "Opravit fakturaci",
    });

    const digest = await t.mutation(internal.notifications.claim, {
      userId: petr.userId,
    });
    expect(digest!.projects[0].items[0].title).toBe("Opravit fakturaci");
  });

  test("a task deleted inside the window drops out instead of linking to nothing", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );

    const taskId = await addAssignedTask(
      owner,
      projectId,
      statusId,
      "Omyl",
      petr.userId,
    );
    await addAssignedTask(
      owner,
      projectId,
      statusId,
      "Opravit fakturaci",
      petr.userId,
    );
    await owner.as.mutation(api.tasks.remove, { taskId });

    const digest = await t.mutation(internal.notifications.claim, {
      userId: petr.userId,
    });
    expect(digest!.total).toBe(1);
    expect(digest!.projects[0].items[0].title).toBe("Opravit fakturaci");
  });

  test("somebody removed from the organization gets nothing, even though it was queued", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );

    await addAssignedTask(
      owner,
      projectId,
      statusId,
      "Opravit fakturaci",
      petr.userId,
    );
    expect(await pendingFor(t, petr.userId)).toHaveLength(1);

    await owner.as.mutation(api.organizations.removeMember, {
      organizationId,
      userId: petr.userId,
    });

    expect(
      await t.mutation(internal.notifications.claim, { userId: petr.userId }),
    ).toBeNull();
  });

  test("claiming empties both tables", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );

    await addAssignedTask(
      owner,
      projectId,
      statusId,
      "Opravit fakturaci",
      petr.userId,
    );
    await t.mutation(internal.notifications.claim, { userId: petr.userId });

    expect(await pendingFor(t, petr.userId)).toHaveLength(0);
    expect(await windowFor(t, petr.userId)).toBeNull();
  });

  test("a row queued as `task_created` before the rule changed is skipped", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );

    const taskId = await addTask(owner, projectId, statusId, "Starý řádek");

    // What the queue used to hold. Nothing writes this kind any more, but a
    // deployment upgraded mid-window still has rows like this one waiting.
    await t.run(async (ctx) => {
      await ctx.db.insert("notificationEvents", {
        userId: petr.userId,
        organizationId,
        projectId,
        taskId,
        kind: "task_created",
        actorId: owner.userId,
      });
    });

    expect(
      await t.mutation(internal.notifications.claim, { userId: petr.userId }),
    ).toBeNull();
    // Skipped, but still claimed — it cannot come back on the next flush.
    expect(await pendingFor(t, petr.userId)).toHaveLength(0);
  });

  test("an empty queue produces no digest at all", async () => {
    const t = setup();
    const { owner, organizationId } = await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );

    expect(
      await t.mutation(internal.notifications.claim, { userId: petr.userId }),
    ).toBeNull();
  });
});

describe("the scheduled flush", () => {
  test("runs end to end and leaves the queue empty", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );

    for (let index = 0; index < 8; index += 1) {
      await addAssignedTask(
        owner,
        projectId,
        statusId,
        `Úkol ${index + 1}`,
        petr.userId,
      );
    }

    // Nothing goes out: `sendTransactionalEmail` has no API key here and says so
    // instead of reaching the network.
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await pendingFor(t, petr.userId)).toHaveLength(0);
    expect(await windowFor(t, petr.userId)).toBeNull();
  });
});

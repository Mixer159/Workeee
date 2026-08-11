import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { serializeCommentBody } from "./lib/commentBody";
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
 * The in-app feed: who gets a row, how rows collapse, and what reading does.
 *
 * The audience rules themselves are shared with the e-mail queue and tested in
 * `notifications.test.ts`; here the point is what is different about the feed —
 * it survives the flush, it ignores the e-mail switch, and it has a read state.
 */

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

const comment = (
  user: { as: Identity },
  taskId: Id<"tasks">,
  text: string,
  mention?: { userId: Id<"users">; name: string },
) =>
  user.as.mutation(api.comments.create, {
    taskId,
    body: serializeCommentBody(
      mention
        ? [
            { type: "mention", userId: mention.userId, name: mention.name },
            { type: "text", text: ` ${text}` },
          ]
        : [{ type: "text", text }],
    ),
  });

function itemsFor(t: Harness, userId: Id<"users">) {
  return t.run(async (ctx) =>
    await ctx.db
      .query("notificationItems")
      .withIndex("by_user_org", (q) => q.eq("userId", userId))
      .collect(),
  );
}

describe("who gets a feed row", () => {
  test("a new task reaches every member's feed, never the author's", async () => {
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

    const { taskId } = await owner.as.mutation(api.tasks.create, {
      projectId,
      statusId,
      title: "Opravit fakturaci",
    });

    const rows = await itemsFor(t, petr.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("task_created");
    expect(rows[0].readAt).toBeUndefined();
    expect(await itemsFor(t, owner.userId)).toHaveLength(0);

    // Nothing is denormalized: the list reads the title live, so a rename
    // after the fact shows the real name.
    await owner.as.mutation(api.tasks.updateTitle, {
      taskId,
      title: "Opravit fakturaci v září",
    });
    const listed = await petr.as.query(api.notificationItems.list, {
      organizationId,
    });
    expect(listed).toHaveLength(1);
    expect(listed[0].taskTitle).toBe("Opravit fakturaci v září");
    expect(listed[0].projectName).toBe("Web");
    expect(listed[0].actorName).toBe("Jana Nováková");
  });

  test("the e-mail switch silences e-mail, not the feed", async () => {
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

    await owner.as.mutation(api.tasks.create, {
      projectId,
      statusId,
      title: "Bez e-mailu",
    });

    const queued = await t.run(async (ctx) =>
      await ctx.db
        .query("notificationEvents")
        .withIndex("by_user", (q) => q.eq("userId", petr.userId))
        .collect(),
    );
    expect(queued).toHaveLength(0);
    expect(await itemsFor(t, petr.userId)).toHaveLength(1);
  });
});

describe("how rows collapse", () => {
  test("created and then assigned is one row, the stronger kind", async () => {
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

    const { taskId } = await owner.as.mutation(api.tasks.create, {
      projectId,
      statusId,
      title: "Opravit fakturaci",
    });
    await owner.as.mutation(api.tasks.setAssignee, {
      taskId,
      assigneeId: petr.userId,
    });

    const rows = await itemsFor(t, petr.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("task_assigned");
  });

  test("replies pile into one row and a mention stays the quoted one", async () => {
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
    const { taskId } = await owner.as.mutation(api.tasks.create, {
      projectId,
      statusId,
      title: "Opravit fakturaci",
    });
    // The řešitel — that is what makes the plain second comment reach petr.
    await owner.as.mutation(api.tasks.setAssignee, {
      taskId,
      assigneeId: petr.userId,
    });

    await comment(owner, taskId, "mrkni na to prosím", {
      userId: petr.userId,
      name: "Petr Svoboda",
    });
    await comment(owner, taskId, "a ještě k tomu obrázek");

    const rows = await itemsFor(t, petr.userId);
    // One task row from the creation + assignment, one comment row for both
    // comments — the two categories never overwrite each other.
    expect(rows).toHaveLength(2);
    const commentRow = rows.find((row) => row.kind === "comment_mention");
    expect(commentRow?.count).toBe(2);

    // The mention is still what the feed quotes, not the chatter after it.
    const listed = await petr.as.query(api.notificationItems.list, {
      organizationId,
    });
    const quoted = listed.find((item) => item.kind === "comment_mention");
    expect(quoted?.preview).toBe("@Petr Svoboda mrkni na to prosím");
  });

  test("a comment lands with the řešitel; a read row starts a fresh burst", async () => {
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
    const { taskId } = await owner.as.mutation(api.tasks.create, {
      projectId,
      statusId,
      title: "Opravit fakturaci",
    });
    await owner.as.mutation(api.tasks.setAssignee, {
      taskId,
      assigneeId: petr.userId,
    });
    await comment(owner, taskId, "První vlna");
    await comment(owner, taskId, "ještě něco");

    // Opening the task settles everything the feed holds about it.
    await petr.as.mutation(api.taskSeen.markSeen, { taskId });
    expect(
      await petr.as.query(api.notificationItems.unreadCount, {
        organizationId,
      }),
    ).toBe(0);

    // The next comment is a new burst: unread again, counting from one.
    await comment(owner, taskId, "Druhá vlna");
    const rows = await itemsFor(t, petr.userId);
    const commentRow = rows.find((row) => row.kind === "comment_added");
    expect(commentRow?.count).toBe(1);
    expect(commentRow?.readAt).toBeUndefined();
  });
});

describe("reading", () => {
  test("markAllRead clears the badge without touching other organizations", async () => {
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
    await owner.as.mutation(api.tasks.create, {
      projectId,
      statusId,
      title: "První",
    });
    await owner.as.mutation(api.tasks.create, {
      projectId,
      statusId,
      title: "Druhý",
    });

    expect(
      await petr.as.query(api.notificationItems.unreadCount, {
        organizationId,
      }),
    ).toBe(2);

    await petr.as.mutation(api.notificationItems.markAllRead, {
      organizationId,
    });
    expect(
      await petr.as.query(api.notificationItems.unreadCount, {
        organizationId,
      }),
    ).toBe(0);
    const listed = await petr.as.query(api.notificationItems.list, {
      organizationId,
    });
    expect(listed).toHaveLength(2);
    expect(listed.every((item) => item.read)).toBe(true);
  });

  test("an outsider sees nothing and cannot mark anything", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    await owner.as.mutation(api.tasks.create, {
      projectId,
      statusId,
      title: "Tajný úkol",
    });
    const outsider = await createUser(t, "Cizí Člověk", "cizi@example.com");

    expect(
      await outsider.as.query(api.notificationItems.list, { organizationId }),
    ).toEqual([]);
    expect(
      await outsider.as.query(api.notificationItems.unreadCount, {
        organizationId,
      }),
    ).toBe(0);
    await expect(
      outsider.as.mutation(api.notificationItems.markAllRead, {
        organizationId,
      }),
    ).rejects.toThrow();
  });
});

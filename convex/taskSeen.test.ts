import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
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
 * Read state and the unread badges counted from it.
 *
 * The rules under test: a task is new until its first visit and never to its
 * author, a comment is unread until the next visit and never to its writer,
 * and everything a task carries — including everyone's read state — dies with
 * the task.
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

const comment = (user: { as: Identity }, taskId: Id<"tasks">, text: string) =>
  user.as.mutation(api.comments.create, {
    taskId,
    body: serializeCommentBody([{ type: "text", text }]),
  });

describe("what counts as unseen", () => {
  test("a task is new to everyone but its author, until the first visit", async () => {
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

    expect(await petr.as.query(api.taskSeen.unreadByProject, { projectId }))
      .toEqual([{ taskId, unreadComments: 0, isNew: true }]);
    expect(await owner.as.query(api.taskSeen.unreadByProject, { projectId }))
      .toEqual([]);

    await petr.as.mutation(api.taskSeen.markSeen, { taskId });
    expect(await petr.as.query(api.taskSeen.unreadByProject, { projectId }))
      .toEqual([]);
  });

  test("somebody else's comment counts as unread, your own never does", async () => {
    vi.useFakeTimers();
    try {
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
      await petr.as.mutation(api.taskSeen.markSeen, { taskId });

      await owner.as.mutation(api.taskSeen.markSeen, { taskId });
      // Unread means strictly newer than `lastSeenAt`. Move the fake clock so
      // the test never depends on whether two transactions share a millisecond.
      vi.setSystemTime(Date.now() + 1);
      await petr.as.mutation(api.comments.create, {
        taskId,
        body: serializeCommentBody([{ type: "text", text: "Mrknu na to." }]),
      });

      // The writer sees nothing; the other person sees one unread comment.
      expect(await petr.as.query(api.taskSeen.unreadByProject, { projectId }))
        .toEqual([]);
      expect(await owner.as.query(api.taskSeen.unreadByProject, { projectId }))
        .toEqual([{ taskId, unreadComments: 1, isNew: false }]);

      // Opening the task clears it, and the next comment starts counting again.
      await owner.as.mutation(api.taskSeen.markSeen, { taskId });
      expect(await owner.as.query(api.taskSeen.unreadByProject, { projectId }))
        .toEqual([]);
      vi.setSystemTime(Date.now() + 1);
      await comment(petr, taskId, "A ještě jedna věc.");
      expect(await owner.as.query(api.taskSeen.unreadByProject, { projectId }))
        .toEqual([{ taskId, unreadComments: 1, isNew: false }]);
    } finally {
      vi.useRealTimers();
    }
  });

  test("the rail counts tasks with something new, not individual events", async () => {
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
      title: "První",
    });
    await owner.as.mutation(api.tasks.create, {
      projectId,
      statusId,
      title: "Druhý",
    });
    await comment(owner, taskId, "Jedna");
    await comment(owner, taskId, "Dvě");
    await comment(owner, taskId, "Tři");

    // Two tasks carry something unseen — three comments on one of them do not
    // make it three entries.
    expect(
      await petr.as.query(api.taskSeen.unreadByOrganization, { organizationId }),
    ).toEqual([{ projectId, count: 2 }]);

    // A quiet organization answers with nothing at all.
    expect(
      await owner.as.query(api.taskSeen.unreadByOrganization, {
        organizationId,
      }),
    ).toEqual([]);
  });
});

describe("security", () => {
  test("an outsider sees no badges and cannot mark anything seen", async () => {
    const t = setup();
    const { owner, organizationId, projectId, statusId } =
      await createWorkspace(t);
    const { taskId } = await owner.as.mutation(api.tasks.create, {
      projectId,
      statusId,
      title: "Tajný úkol",
    });
    const outsider = await createUser(t, "Cizí Člověk", "cizi@example.com");

    expect(
      await outsider.as.query(api.taskSeen.unreadByProject, { projectId }),
    ).toEqual([]);
    expect(
      await outsider.as.query(api.taskSeen.unreadByOrganization, {
        organizationId,
      }),
    ).toEqual([]);
    await expect(
      outsider.as.mutation(api.taskSeen.markSeen, { taskId }),
    ).rejects.toThrow();
  });

  test("read state and feed rows die with the task", async () => {
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
      title: "Krátký život",
    });
    await petr.as.mutation(api.taskSeen.markSeen, { taskId });
    await comment(petr, taskId, "Něco k tomu mám.");

    await owner.as.mutation(api.tasks.remove, { taskId });

    const leftovers = await t.run(async (ctx) => ({
      seen: await ctx.db
        .query("taskSeen")
        .withIndex("by_task", (q) => q.eq("taskId", taskId))
        .collect(),
      items: await ctx.db
        .query("notificationItems")
        .withIndex("by_task", (q) => q.eq("taskId", taskId))
        .collect(),
    }));
    expect(leftovers.seen).toEqual([]);
    expect(leftovers.items).toEqual([]);
  });
});

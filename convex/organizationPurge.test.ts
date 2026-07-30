import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
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

function setup() {
  return convexTest(schema, modules);
}

type Harness = ReturnType<typeof setup>;

async function createUser(t: Harness, name: string, email: string) {
  const authId = `auth_${email}`;
  const userId = await t.run(
    async (ctx) => await ctx.db.insert("users", { authId, name, email }),
  );
  return { userId, as: t.withIdentity({ subject: authId, name, email }) };
}

/**
 * An organization with everything a real one has: an owner, a second member,
 * an open invite, a project with a board, a task carrying a body, an attachment
 * and a comment — one row in every table the purge has to reach.
 */
async function createOrganization(t: Harness) {
  const owner = await createUser(t, "Jana Nováková", "jana@example.com");
  const { organizationId } = await owner.as.mutation(api.organizations.create, {
    name: "Studio",
  });

  const { code } = await owner.as.mutation(api.invites.create, {
    organizationId,
    expiry: "7d",
  });
  const member = await createUser(t, "Petr Malý", "petr@example.com");
  await member.as.mutation(api.invites.accept, { code });

  const { projectId } = await owner.as.mutation(api.projects.create, {
    organizationId,
    name: "Web",
  });
  const statuses = await owner.as.query(api.taskStatuses.list, { projectId });
  const { taskId } = await owner.as.mutation(api.tasks.create, {
    projectId,
    statusId: statuses[0]._id,
    title: "Napsat zadání",
  });
  await owner.as.mutation(api.taskContent.save, {
    taskId,
    content: JSON.stringify([{ type: "paragraph", content: "Ahoj" }]),
  });
  await owner.as.mutation(api.comments.create, {
    taskId,
    body: serializeCommentBody([{ type: "text", text: "Beru si to." }]),
  });

  // The attachment is registered directly: `files.register` trusts the *stored*
  // content type and `convex-test`'s storage records none. The blob is what
  // matters here — the purge has to take it with the row.
  const storageId = await t.run(async (ctx) => {
    const id = await ctx.storage.store(new Blob(["priloha"]));
    await ctx.db.insert("files", {
      taskId,
      projectId,
      organizationId,
      storageId: id,
      fileName: "zadani.pdf",
      mimeType: "application/pdf",
      size: 7,
      context: "attachment",
      uploadedBy: owner.userId,
    });
    return id;
  });

  // A second invite, left open, and a second project with an icon blob.
  await owner.as.mutation(api.invites.create, { organizationId, expiry: "7d" });
  const second = await owner.as.mutation(api.projects.create, {
    organizationId,
    name: "Aplikace",
  });
  const iconStorageId = await t.run(async (ctx) => {
    const id = await ctx.storage.store(new Blob(["ikona"]));
    await ctx.db.patch(second.projectId, { iconStorageId: id });
    return id;
  });

  return {
    owner,
    member,
    organizationId,
    projectId,
    taskId,
    storageId,
    iconStorageId,
  };
}

/** Everything still filed under `organizationId`, table by table. */
async function leftovers(t: Harness, organizationId: Id<"organizations">) {
  return await t.run(async (ctx) => {
    const projects = await ctx.db
      .query("projects")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .collect();
    const counts = {
      organization: (await ctx.db.get(organizationId)) === null ? 0 : 1,
      members: (
        await ctx.db
          .query("organizationMembers")
          .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
          .collect()
      ).length,
      invites: (
        await ctx.db
          .query("invites")
          .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
          .collect()
      ).length,
      activityLogs: (
        await ctx.db
          .query("activityLogs")
          .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
          .collect()
      ).length,
      projects: projects.length,
      projectMembers: 0,
      statuses: 0,
      tasks: 0,
      taskContent: 0,
      files: 0,
      comments: 0,
    };
    for (const project of projects) {
      counts.projectMembers += (
        await ctx.db
          .query("projectMembers")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect()
      ).length;
      counts.statuses += (
        await ctx.db
          .query("taskStatuses")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .collect()
      ).length;
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_project", (q) => q.eq("projectId", project._id))
        .collect();
      counts.tasks += tasks.length;
      for (const task of tasks) {
        counts.taskContent += (
          await ctx.db
            .query("taskContent")
            .withIndex("by_task", (q) => q.eq("taskId", task._id))
            .collect()
        ).length;
        counts.files += (
          await ctx.db
            .query("files")
            .withIndex("by_task", (q) => q.eq("taskId", task._id))
            .collect()
        ).length;
        counts.comments += (
          await ctx.db
            .query("comments")
            .withIndex("by_task", (q) => q.eq("taskId", task._id))
            .collect()
        ).length;
      }
    }
    return counts;
  });
}

describe("deleting an organization", () => {
  /**
   * Fake timers, because the purge is scheduled rather than awaited. Without
   * them the `setTimeout(0)` behind `runAfter(0)` fires at an arbitrary moment
   * and "what is still there right after `remove`" is a race. With them nothing
   * runs until a test asks for it with `finishAllScheduledFunctions`.
   */
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Run the scheduled purge, including every run it reschedules for itself. */
  async function sweep(t: Harness) {
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  }

  test("only the owner may delete it", async () => {
    const t = setup();
    const { owner, member, organizationId } = await createOrganization(t);
    await owner.as.mutation(api.organizations.updateMemberRole, {
      organizationId,
      userId: member.userId,
      role: "admin",
    });

    await expect(
      member.as.mutation(api.organizations.remove, {
        organizationId,
        name: "Studio",
      }),
    ).rejects.toThrow(/vlastník/);
    expect((await leftovers(t, organizationId)).organization).toBe(1);
  });

  test("an outsider cannot delete it", async () => {
    const t = setup();
    const { organizationId } = await createOrganization(t);
    const outsider = await createUser(t, "Cizí Člověk", "cizi@example.com");

    await expect(
      outsider.as.mutation(api.organizations.remove, {
        organizationId,
        name: "Studio",
      }),
    ).rejects.toThrow(/přístup/);
  });

  test("the typed name has to match, spacing and case aside", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrganization(t);

    await expect(
      owner.as.mutation(api.organizations.remove, {
        organizationId,
        name: "studi",
      }),
    ).rejects.toThrow(/nesouhlasí/);
    await owner.as.mutation(api.organizations.remove, {
      organizationId,
      name: "  sTuDio ",
    });
    expect(await owner.as.query(api.organizations.listForUser)).toEqual([]);
  });

  test("access is gone in the same transaction, before anything is swept up", async () => {
    const t = setup();
    const { owner, member, organizationId, projectId } =
      await createOrganization(t);

    await owner.as.mutation(api.organizations.remove, {
      organizationId,
      name: "Studio",
    });

    // No scheduled function has run yet: the contents are still there, and are
    // already unreachable for everybody.
    expect((await leftovers(t, organizationId)).projects).toBe(2);
    expect(await owner.as.query(api.organizations.listForUser)).toEqual([]);
    expect(await member.as.query(api.organizations.listForUser)).toEqual([]);
    expect(
      await owner.as.query(api.organizations.get, { organizationId }),
    ).toBeNull();
    expect(await owner.as.query(api.projects.get, { projectId })).toBeNull();
    await expect(
      owner.as.mutation(api.projects.create, { organizationId, name: "Nový" }),
    ).rejects.toThrow(/přístup/);
  });

  test("an open invite stops working immediately", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrganization(t);
    const { code } = await owner.as.mutation(api.invites.create, {
      organizationId,
      expiry: "7d",
    });

    await owner.as.mutation(api.organizations.remove, {
      organizationId,
      name: "Studio",
    });

    expect(await t.query(api.invites.getByCode, { code })).toBeNull();
    const outsider = await createUser(t, "Cizí Člověk", "cizi@example.com");
    await expect(
      outsider.as.mutation(api.invites.accept, { code }),
    ).rejects.toThrow(/neexistuje/);
  });

  test("the scheduled purge empties every table and both blobs", async () => {
    const t = setup();
    const { owner, organizationId, storageId, iconStorageId } =
      await createOrganization(t);

    await owner.as.mutation(api.organizations.remove, {
      organizationId,
      name: "Studio",
    });
    await sweep(t);

    expect(await leftovers(t, organizationId)).toEqual({
      organization: 0,
      members: 0,
      invites: 0,
      activityLogs: 0,
      projects: 0,
      projectMembers: 0,
      statuses: 0,
      tasks: 0,
      taskContent: 0,
      files: 0,
      comments: 0,
    });
    await t.run(async (ctx) => {
      expect(await ctx.storage.getUrl(storageId)).toBeNull();
      expect(await ctx.storage.getUrl(iconStorageId)).toBeNull();
    });
  });

  test("a purge that runs out of budget reschedules itself until it is done", async () => {
    const t = setup();
    const { organizationId } = await createOrganization(t);

    // One document per run, and nothing else scheduled: finishing the job takes
    // dozens of runs, each one picking up where the previous stopped.
    const first = await t.mutation(internal.organizationPurge.purge, {
      organizationId,
      limit: 1,
    });
    expect(first.done).toBe(false);
    expect(first.deleted).toBeGreaterThan(0);
    expect((await leftovers(t, organizationId)).organization).toBe(1);

    await sweep(t);
    expect(await leftovers(t, organizationId)).toEqual({
      organization: 0,
      members: 0,
      invites: 0,
      activityLogs: 0,
      projects: 0,
      projectMembers: 0,
      statuses: 0,
      tasks: 0,
      taskContent: 0,
      files: 0,
      comments: 0,
    });
  });

  test("another organization is untouched", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrganization(t);
    const neighbour = await createUser(t, "Eva Bílá", "eva@example.com");
    const other = await neighbour.as.mutation(api.organizations.create, {
      name: "Sousedi",
    });
    await neighbour.as.mutation(api.projects.create, {
      organizationId: other.organizationId,
      name: "Jejich projekt",
    });

    await owner.as.mutation(api.organizations.remove, {
      organizationId,
      name: "Studio",
    });
    await sweep(t);

    const rest = await leftovers(t, other.organizationId);
    expect(rest.organization).toBe(1);
    expect(rest.projects).toBe(1);
    expect(rest.statuses).toBe(3);
    expect(
      await neighbour.as.query(api.projects.listVisible, {
        organizationId: other.organizationId,
      }),
    ).toHaveLength(1);
  });

  test("purging an organization that is already gone is a no-op", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrganization(t);
    await owner.as.mutation(api.organizations.remove, {
      organizationId,
      name: "Studio",
    });
    await sweep(t);

    expect(
      await t.mutation(internal.organizationPurge.purge, { organizationId }),
    ).toEqual({ deleted: 0, done: true });
  });
});

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
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

/**
 * An organization with an owner and one project — the starting point of every
 * board test.
 */
async function createProject(t: Harness) {
  const owner = await createUser(t, "Jana Nováková", "jana@example.com");
  const { organizationId } = await owner.as.mutation(api.organizations.create, {
    name: "Studio",
  });
  const { projectId } = await owner.as.mutation(api.projects.create, {
    organizationId,
    name: "Web",
  });
  return { owner, organizationId, projectId };
}

/** Join `organizationId` (optionally only `projectId`) as a fresh user. */
async function addMember(
  t: Harness,
  inviter: { as: Identity },
  organizationId: Id<"organizations">,
  options: { name: string; email: string; projectId?: Id<"projects"> },
) {
  const { code } = await inviter.as.mutation(api.invites.create, {
    organizationId,
    projectId: options.projectId,
    expiry: "7d",
  });
  const user = await createUser(t, options.name, options.email);
  await user.as.mutation(api.invites.accept, { code });
  return user;
}

async function statusesOf(
  user: { as: Identity },
  projectId: Id<"projects">,
) {
  return await user.as.query(api.taskStatuses.list, { projectId });
}

describe("task status seeding", () => {
  test("a new project starts with the three core statuses", async () => {
    const t = setup();
    const { owner, projectId } = await createProject(t);

    const statuses = await statusesOf(owner, projectId);
    expect(statuses.map((status) => [status.name, status.kind])).toEqual([
      ["To-do", "todo"],
      ["V průběhu", "in_progress"],
      ["Hotovo", "done"],
    ]);
    expect(statuses.map((status) => status.color)).toEqual([
      "gray",
      "blue",
      "green",
    ]);
  });

  test("the backfill seeds a project created before statuses existed", async () => {
    const t = setup();
    const { owner, organizationId, projectId } = await createProject(t);
    await t.run(async (ctx) => {
      const statuses = await ctx.db
        .query("taskStatuses")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .collect();
      await Promise.all(statuses.map((status) => ctx.db.delete(status._id)));
      await ctx.db.insert("projects", {
        organizationId,
        name: "Starý projekt",
        createdBy: owner.userId,
      });
    });

    const result = await t.mutation(internal.migrations.seedTaskStatuses, {});
    expect(result).toEqual({ projects: 2, seeded: 2 });
    expect(await statusesOf(owner, projectId)).toHaveLength(3);
  });
});

describe("board visibility", () => {
  test("an outsider sees no statuses and no tasks and cannot write", async () => {
    const t = setup();
    const { owner, projectId } = await createProject(t);
    const [todo] = await statusesOf(owner, projectId);
    await owner.as.mutation(api.tasks.create, {
      projectId,
      statusId: todo._id,
      title: "Tajný úkol",
    });
    const outsider = await createUser(t, "Cizí Člověk", "cizi@example.com");

    expect(await outsider.as.query(api.taskStatuses.list, { projectId })).toEqual(
      [],
    );
    expect(
      await outsider.as.query(api.tasks.listByProject, { projectId }),
    ).toEqual([]);
    await expect(
      outsider.as.mutation(api.tasks.create, {
        projectId,
        statusId: todo._id,
        title: "Cizí úkol",
      }),
    ).rejects.toThrow(/přístup/);
    await expect(
      outsider.as.mutation(api.taskStatuses.create, {
        projectId,
        name: "Cizí stav",
        color: "red",
      }),
    ).rejects.toThrow(/přístup/);
  });

  test("a limited member sees nothing of a project they were not invited to", async () => {
    const t = setup();
    const { owner, organizationId, projectId } = await createProject(t);
    const { projectId: other } = await owner.as.mutation(api.projects.create, {
      organizationId,
      name: "Tajný projekt",
    });
    const member = await addMember(t, owner, organizationId, {
      name: "Petr Malý",
      email: "petr@example.com",
      projectId,
    });
    const [otherTodo] = await statusesOf(owner, other);
    const { taskId } = await owner.as.mutation(api.tasks.create, {
      projectId: other,
      statusId: otherTodo._id,
      title: "Tajný úkol",
    });

    expect(
      await member.as.query(api.taskStatuses.list, { projectId: other }),
    ).toEqual([]);
    expect(
      await member.as.query(api.tasks.listByProject, { projectId: other }),
    ).toEqual([]);
    expect(await member.as.query(api.tasks.get, { taskId })).toBeNull();
    await expect(
      member.as.mutation(api.tasks.updateTitle, { taskId, title: "Změna" }),
    ).rejects.toThrow(/přístup/);
    await expect(
      member.as.mutation(api.tasks.remove, { taskId }),
    ).rejects.toThrow(/přístup/);
    await expect(
      member.as.mutation(api.taskStatuses.reorder, {
        projectId: other,
        statusIds: [otherTodo._id],
      }),
    ).rejects.toThrow(/přístup/);
  });

  test("a limited member works normally on the project they were invited to", async () => {
    const t = setup();
    const { owner, organizationId, projectId } = await createProject(t);
    const member = await addMember(t, owner, organizationId, {
      name: "Petr Malý",
      email: "petr@example.com",
      projectId,
    });
    const [todo] = await statusesOf(member, projectId);

    const { taskId } = await member.as.mutation(api.tasks.create, {
      projectId,
      statusId: todo._id,
      title: "Udělat rozvahu",
    });
    const tasks = await member.as.query(api.tasks.listByProject, { projectId });
    expect(tasks.map((task) => task.title)).toEqual(["Udělat rozvahu"]);
    expect(await member.as.query(api.tasks.get, { taskId })).not.toBeNull();
  });
});

describe("task statuses", () => {
  test("a core status cannot be deleted", async () => {
    const t = setup();
    const { owner, projectId } = await createProject(t);
    const [todo, , done] = await statusesOf(owner, projectId);

    await expect(
      owner.as.mutation(api.taskStatuses.remove, {
        statusId: todo._id,
        moveTasksToStatusId: done._id,
      }),
    ).rejects.toThrow(/Základní stavy/);
    expect(await statusesOf(owner, projectId)).toHaveLength(3);
  });

  test("deleting a custom status moves its tasks to the chosen one", async () => {
    const t = setup();
    const { owner, projectId } = await createProject(t);
    const [todo] = await statusesOf(owner, projectId);
    const { statusId } = await owner.as.mutation(api.taskStatuses.create, {
      projectId,
      name: "Potřeba revize",
      color: "amber",
    });
    await owner.as.mutation(api.tasks.create, {
      projectId,
      statusId,
      title: "K revizi 1",
    });
    await owner.as.mutation(api.tasks.create, {
      projectId,
      statusId,
      title: "K revizi 2",
    });

    const result = await owner.as.mutation(api.taskStatuses.remove, {
      statusId,
      moveTasksToStatusId: todo._id,
    });
    expect(result).toEqual({ movedTasks: 2 });

    const statuses = await statusesOf(owner, projectId);
    expect(statuses).toHaveLength(3);
    const tasks = await owner.as.query(api.tasks.listByProject, { projectId });
    expect(tasks.map((task) => task.title)).toEqual(["K revizi 1", "K revizi 2"]);
    expect(tasks.every((task) => task.statusId === todo._id)).toBe(true);
  });

  test("a status from another project cannot take the tasks", async () => {
    const t = setup();
    const { owner, organizationId, projectId } = await createProject(t);
    const { projectId: other } = await owner.as.mutation(api.projects.create, {
      organizationId,
      name: "Aplikace",
    });
    const { statusId } = await owner.as.mutation(api.taskStatuses.create, {
      projectId,
      name: "Potřeba revize",
      color: "amber",
    });
    const [otherTodo] = await statusesOf(owner, other);

    await expect(
      owner.as.mutation(api.taskStatuses.remove, {
        statusId,
        moveTasksToStatusId: otherTodo._id,
      }),
    ).rejects.toThrow(/nepatří/);
  });

  test("reorder renumbers the columns and keeps the ones it was not told about", async () => {
    const t = setup();
    const { owner, projectId } = await createProject(t);
    const [todo, progress, done] = await statusesOf(owner, projectId);

    await owner.as.mutation(api.taskStatuses.reorder, {
      projectId,
      statusIds: [done._id, todo._id],
    });

    const statuses = await statusesOf(owner, projectId);
    expect(statuses.map((status) => status._id)).toEqual([
      done._id,
      todo._id,
      progress._id,
    ]);
    expect(statuses.map((status) => status.order)).toEqual([1024, 2048, 3072]);
  });
});

describe("tasks", () => {
  test("a task is appended to the end of its column", async () => {
    const t = setup();
    const { owner, projectId } = await createProject(t);
    const [todo] = await statusesOf(owner, projectId);

    for (const title of ["První", "Druhý", "Třetí"]) {
      await owner.as.mutation(api.tasks.create, {
        projectId,
        statusId: todo._id,
        title,
      });
    }

    const tasks = await owner.as.query(api.tasks.listByProject, { projectId });
    expect(tasks.map((task) => task.title)).toEqual(["První", "Druhý", "Třetí"]);
    expect(tasks[0].order).toBeLessThan(tasks[1].order);
    expect(tasks[1].order).toBeLessThan(tasks[2].order);
  });

  test("moving between two cards takes the midpoint of their orders", async () => {
    const t = setup();
    const { owner, projectId } = await createProject(t);
    const [todo] = await statusesOf(owner, projectId);
    const ids: Id<"tasks">[] = [];
    for (const title of ["A", "B", "C"]) {
      const { taskId } = await owner.as.mutation(api.tasks.create, {
        projectId,
        statusId: todo._id,
        title,
      });
      ids.push(taskId);
    }

    await owner.as.mutation(api.tasks.move, {
      taskId: ids[2],
      statusId: todo._id,
      previousTaskId: ids[0],
      nextTaskId: ids[1],
    });

    const tasks = await owner.as.query(api.tasks.listByProject, { projectId });
    expect(tasks.map((task) => task.title)).toEqual(["A", "C", "B"]);
    expect(tasks[1].order).toBeGreaterThan(tasks[0].order);
    expect(tasks[1].order).toBeLessThan(tasks[2].order);
  });

  test("a column with no room left is renumbered instead of colliding", async () => {
    const t = setup();
    const { owner, projectId } = await createProject(t);
    const [todo] = await statusesOf(owner, projectId);
    const ids: Id<"tasks">[] = [];
    for (const title of ["A", "B", "C"]) {
      const { taskId } = await owner.as.mutation(api.tasks.create, {
        projectId,
        statusId: todo._id,
        title,
      });
      ids.push(taskId);
    }
    // Squeeze A and B together until a midpoint is no longer representable.
    await t.run(async (ctx) => {
      await ctx.db.patch(ids[0], { order: 1000 });
      await ctx.db.patch(ids[1], { order: 1000 + 1e-9 });
    });

    await owner.as.mutation(api.tasks.move, {
      taskId: ids[2],
      statusId: todo._id,
      previousTaskId: ids[0],
      nextTaskId: ids[1],
    });

    const tasks = await owner.as.query(api.tasks.listByProject, { projectId });
    expect(tasks.map((task) => task.title)).toEqual(["A", "C", "B"]);
    expect(tasks.map((task) => task.order)).toEqual([1024, 2048, 3072]);
  });

  test("moving to another column appends there and is audited", async () => {
    const t = setup();
    const { owner, organizationId, projectId } = await createProject(t);
    const [todo, , done] = await statusesOf(owner, projectId);
    const { taskId } = await owner.as.mutation(api.tasks.create, {
      projectId,
      statusId: todo._id,
      title: "Hotová věc",
    });

    await owner.as.mutation(api.tasks.move, { taskId, statusId: done._id });

    const tasks = await owner.as.query(api.tasks.listByProject, { projectId });
    expect(tasks[0].statusId).toBe(done._id);

    const logs = await t.run(
      async (ctx) =>
        await ctx.db
          .query("activityLogs")
          .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
          .collect(),
    );
    expect(logs.some((log) => log.type === "task_created")).toBe(true);
    expect(
      logs.find((log) => log.type === "task_status_changed")?.meta,
    ).toEqual({ from: "To-do", to: "Hotovo" });
  });

  test("a task cannot be moved into another project's status", async () => {
    const t = setup();
    const { owner, organizationId, projectId } = await createProject(t);
    const { projectId: other } = await owner.as.mutation(api.projects.create, {
      organizationId,
      name: "Aplikace",
    });
    const [todo] = await statusesOf(owner, projectId);
    const [otherTodo] = await statusesOf(owner, other);
    const { taskId } = await owner.as.mutation(api.tasks.create, {
      projectId,
      statusId: todo._id,
      title: "Úkol",
    });

    await expect(
      owner.as.mutation(api.tasks.move, { taskId, statusId: otherTodo._id }),
    ).rejects.toThrow(/nepatří/);
  });

  test("only the author or a project manager may delete a task", async () => {
    const t = setup();
    const { owner, organizationId, projectId } = await createProject(t);
    const author = await addMember(t, owner, organizationId, {
      name: "Petr Malý",
      email: "petr@example.com",
    });
    const other = await addMember(t, owner, organizationId, {
      name: "Eva Bílá",
      email: "eva@example.com",
    });
    const [todo] = await statusesOf(owner, projectId);

    const mine = await author.as.mutation(api.tasks.create, {
      projectId,
      statusId: todo._id,
      title: "Můj úkol",
    });
    const theirs = await author.as.mutation(api.tasks.create, {
      projectId,
      statusId: todo._id,
      title: "Taky můj úkol",
    });

    await expect(
      other.as.mutation(api.tasks.remove, { taskId: mine.taskId }),
    ).rejects.toThrow(/autor/);
    await author.as.mutation(api.tasks.remove, { taskId: mine.taskId });
    await owner.as.mutation(api.tasks.remove, { taskId: theirs.taskId });

    expect(
      await owner.as.query(api.tasks.listByProject, { projectId }),
    ).toEqual([]);
  });

  test("a task cannot be assigned to someone without access to the project", async () => {
    const t = setup();
    const { owner, organizationId, projectId } = await createProject(t);
    const { projectId: other } = await owner.as.mutation(api.projects.create, {
      organizationId,
      name: "Aplikace",
    });
    const elsewhere = await addMember(t, owner, organizationId, {
      name: "Petr Malý",
      email: "petr@example.com",
      projectId: other,
    });
    const [todo] = await statusesOf(owner, projectId);
    const { taskId } = await owner.as.mutation(api.tasks.create, {
      projectId,
      statusId: todo._id,
      title: "Úkol",
    });

    await expect(
      owner.as.mutation(api.tasks.setAssignee, {
        taskId,
        assigneeId: elsewhere.userId,
      }),
    ).rejects.toThrow(/přístup k projektu/);
    expect(
      await owner.as.query(api.projects.assignableMembers, { projectId }),
    ).toEqual([
      {
        _id: owner.userId,
        name: "Jana Nováková",
        email: "jana@example.com",
        image: undefined,
      },
    ]);

    await owner.as.mutation(api.tasks.setAssignee, {
      taskId,
      assigneeId: owner.userId,
    });
    const tasks = await owner.as.query(api.tasks.listByProject, { projectId });
    expect(tasks[0].assignee?.name).toBe("Jana Nováková");
  });
});

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

async function createProject(
  owner: { as: Identity },
  organizationId: Id<"organizations">,
  name: string,
) {
  const { projectId } = await owner.as.mutation(api.projects.create, {
    organizationId,
    name,
  });
  const [status] = await owner.as.query(api.taskStatuses.list, { projectId });
  return { projectId, statusId: status._id };
}

describe("central workspace", () => {
  test("merges organizations by recent activity and includes the latest comment", async () => {
    const t = setup();
    const owner = await createUser(t, "Jana Nováková", "jana@example.com");
    const { organizationId: studioId } = await owner.as.mutation(
      api.organizations.create,
      { name: "Studio" },
    );
    const { organizationId: agencyId } = await owner.as.mutation(
      api.organizations.create,
      { name: "Agentura" },
    );
    const web = await createProject(owner, studioId, "Web");
    const crm = await createProject(owner, agencyId, "CRM");
    await createProject(owner, studioId, "Briefy");

    const { taskId: olderTaskId } = await owner.as.mutation(api.tasks.create, {
      projectId: web.projectId,
      statusId: web.statusId,
      title: "Připravit texty",
    });
    const { taskId: newerTaskId } = await owner.as.mutation(api.tasks.create, {
      projectId: crm.projectId,
      statusId: crm.statusId,
      title: "Opravit fakturaci",
    });
    await t.run(async (ctx) => {
      await ctx.db.insert("comments", {
        taskId: newerTaskId,
        projectId: crm.projectId,
        organizationId: agencyId,
        authorId: owner.userId,
        body: serializeCommentBody([
          { type: "text", text: "Poslední zpráva z úkolu." },
        ]),
      });
      await ctx.db.patch(olderTaskId, { updatedAt: 100 });
      await ctx.db.patch(newerTaskId, { updatedAt: 200 });
    });

    const result = await owner.as.query(api.workspace.listTasks, { limit: 1 });

    expect(result.hasMore).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      _id: newerTaskId,
      title: "Opravit fakturaci",
      project: { name: "CRM" },
      latestComment: {
        authorName: "Jana Nováková",
        preview: "Poslední zpráva z úkolu.",
      },
    });
    expect(result.projects).toEqual([
      expect.objectContaining({ name: "Briefy", organizationName: "Studio" }),
      expect.objectContaining({ name: "CRM", organizationName: "Agentura" }),
      expect.objectContaining({ name: "Web", organizationName: "Studio" }),
    ]);
  });

  test("a limited member sees only tasks from the invited project", async () => {
    const t = setup();
    const owner = await createUser(t, "Jana Nováková", "jana@example.com");
    const { organizationId } = await owner.as.mutation(api.organizations.create, {
      name: "Studio",
    });
    const visible = await createProject(owner, organizationId, "Web");
    const hidden = await createProject(owner, organizationId, "Interní CRM");
    await owner.as.mutation(api.tasks.create, {
      projectId: visible.projectId,
      statusId: visible.statusId,
      title: "Veřejný úkol",
    });
    await owner.as.mutation(api.tasks.create, {
      projectId: hidden.projectId,
      statusId: hidden.statusId,
      title: "Skrytý úkol",
    });

    const { code } = await owner.as.mutation(api.invites.create, {
      organizationId,
      projectId: visible.projectId,
      expiry: "7d",
    });
    const member = await createUser(t, "Petr Malý", "petr@example.com");
    await member.as.mutation(api.invites.accept, { code });

    const result = await member.as.query(api.workspace.listTasks, {});

    expect(result.items.map((task) => task.title)).toEqual(["Veřejný úkol"]);
    expect(result.projects.map((project) => project.name)).toEqual(["Web"]);
  });
});

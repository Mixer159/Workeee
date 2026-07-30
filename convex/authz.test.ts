import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
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
/** A signed-in view of the harness — what `t.withIdentity` hands back. */
type Identity = ReturnType<Harness["withIdentity"]>;

/**
 * The app `users` table is normally written by the Better Auth triggers. Tests
 * insert the mirror row directly and sign in as `authId`, which is what
 * `getAuthUserId` resolves through.
 */
async function createUser(t: Harness, name: string, email: string) {
  const authId = `auth_${email}`;
  const userId = await t.run(
    async (ctx) =>
      await ctx.db.insert("users", { authId, name, email }),
  );
  return { userId, as: t.withIdentity({ subject: authId, name, email }) };
}

async function createOrgWithOwner(t: Harness, name: string, email: string) {
  const owner = await createUser(t, name, email);
  const { organizationId } = await owner.as.mutation(api.organizations.create, {
    name: "Studio",
  });
  return { owner, organizationId };
}

/** Redeem `code` as `user`, the way the join page does. */
async function join(user: { as: Identity }, code: string) {
  return await user.as.mutation(api.invites.accept, { code });
}

describe("project visibility", () => {
  test("a full member sees every project, including ones created later", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    await owner.as.mutation(api.projects.create, {
      organizationId,
      name: "Web",
    });

    const { code } = await owner.as.mutation(api.invites.create, {
      organizationId,
      expiry: "7d",
    });
    const member = await createUser(t, "Petr Malý", "petr@example.com");
    await join(member, code);

    await owner.as.mutation(api.projects.create, {
      organizationId,
      name: "Aplikace",
    });

    const visible = await member.as.query(api.projects.listVisible, {
      organizationId,
    });
    expect(visible.map((project) => project.name)).toEqual(["Aplikace", "Web"]);
  });

  test("a limited member sees only the project they were invited to", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    const { projectId: invited } = await owner.as.mutation(
      api.projects.create,
      { organizationId, name: "Web" },
    );
    const { projectId: secret } = await owner.as.mutation(api.projects.create, {
      organizationId,
      name: "Tajný projekt",
    });

    const { code } = await owner.as.mutation(api.invites.create, {
      organizationId,
      projectId: invited,
      expiry: "7d",
    });
    const member = await createUser(t, "Petr Malý", "petr@example.com");
    await join(member, code);

    const visible = await member.as.query(api.projects.listVisible, {
      organizationId,
    });
    expect(visible.map((project) => project._id)).toEqual([invited]);

    expect(
      await member.as.query(api.projects.get, { projectId: secret }),
    ).toBeNull();
    expect(
      await member.as.query(api.projects.get, { projectId: invited }),
    ).not.toBeNull();
  });

  test("a limited member cannot create a project", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    const { projectId } = await owner.as.mutation(api.projects.create, {
      organizationId,
      name: "Web",
    });
    const { code } = await owner.as.mutation(api.invites.create, {
      organizationId,
      projectId,
      expiry: "7d",
    });
    const member = await createUser(t, "Petr Malý", "petr@example.com");
    await join(member, code);

    await expect(
      member.as.mutation(api.projects.create, {
        organizationId,
        name: "Vlastní projekt",
      }),
    ).rejects.toThrow(/celé organizaci/);
  });

  test("archived projects drop out of the sidebar but stay readable", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    const { projectId } = await owner.as.mutation(api.projects.create, {
      organizationId,
      name: "Web",
    });
    await owner.as.mutation(api.projects.setArchived, {
      projectId,
      archived: true,
    });

    expect(
      await owner.as.query(api.projects.listVisible, { organizationId }),
    ).toEqual([]);
    const project = await owner.as.query(api.projects.get, { projectId });
    expect(project?.archived).toBe(true);
  });

  test("an outsider sees nothing of another organization", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    const { projectId } = await owner.as.mutation(api.projects.create, {
      organizationId,
      name: "Web",
    });
    const outsider = await createUser(t, "Cizí Člověk", "cizi@example.com");

    expect(
      await outsider.as.query(api.projects.listVisible, { organizationId }),
    ).toEqual([]);
    expect(
      await outsider.as.query(api.projects.get, { projectId }),
    ).toBeNull();
    expect(
      await outsider.as.query(api.organizations.get, { organizationId }),
    ).toBeNull();
  });
});

describe("project icons", () => {
  test("an emoji picked at creation is stored and listed", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    const { projectId } = await owner.as.mutation(api.projects.create, {
      organizationId,
      name: "Web",
      emoji: "🚀",
    });

    const project = await owner.as.query(api.projects.get, { projectId });
    expect(project?.emoji).toBe("🚀");
    const [listed] = await owner.as.query(api.projects.listVisible, {
      organizationId,
    });
    expect(listed.emoji).toBe("🚀");
  });

  test("anything that is not an emoji is refused", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );

    await expect(
      owner.as.mutation(api.projects.create, {
        organizationId,
        name: "Web",
        emoji: "<img src=x onerror=alert(1)>",
      }),
    ).rejects.toThrow(/emoji/);
    await expect(
      owner.as.mutation(api.projects.create, {
        organizationId,
        name: "Web",
        emoji: "W",
      }),
    ).rejects.toThrow(/emoji/);
  });

  test("an emoji replaces an uploaded image, blob included", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    const { projectId } = await owner.as.mutation(api.projects.create, {
      organizationId,
      name: "Web",
    });

    // `setIcon` cannot be driven from here: `convex-test`'s `storage.store`
    // records no content type, and the mutation trusts the *stored* type. The
    // rule under test is the exclusivity, so the image is attached directly.
    const storageId = await t.run(async (ctx) => {
      const id = await ctx.storage.store(new Blob(["icon"]));
      await ctx.db.patch(projectId, { iconStorageId: id });
      return id;
    });

    await owner.as.mutation(api.projects.setEmoji, { projectId, emoji: "📦" });

    const project = await t.run(async (ctx) => await ctx.db.get(projectId));
    expect(project?.emoji).toBe("📦");
    expect(project?.iconStorageId).toBeUndefined();
    expect(await t.run(async (ctx) => await ctx.storage.getUrl(storageId))).toBeNull();
  });

  test("only a project manager may change the icon", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    const { projectId } = await owner.as.mutation(api.projects.create, {
      organizationId,
      name: "Web",
    });
    const { code } = await owner.as.mutation(api.invites.create, {
      organizationId,
      expiry: "7d",
    });
    const member = await createUser(t, "Petr Malý", "petr@example.com");
    await join(member, code);

    await expect(
      member.as.mutation(api.projects.setEmoji, { projectId, emoji: "📦" }),
    ).rejects.toThrow(/oprávnění/);
    await expect(
      member.as.mutation(api.projects.removeIcon, { projectId }),
    ).rejects.toThrow(/oprávnění/);
  });
});

describe("invites", () => {
  test("an organization invite grants full access", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    const { code } = await owner.as.mutation(api.invites.create, {
      organizationId,
      expiry: "7d",
    });
    const member = await createUser(t, "Petr Malý", "petr@example.com");

    const result = await join(member, code);
    expect(result).toEqual({ organizationId, projectId: null });

    const organizations = await member.as.query(api.organizations.listForUser);
    expect(organizations).toHaveLength(1);
    expect(organizations[0].access).toBe("full");
    expect(organizations[0].role).toBe("member");
  });

  test("a project invite grants limited access plus one project grant", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    const { projectId } = await owner.as.mutation(api.projects.create, {
      organizationId,
      name: "Web",
    });
    const { code } = await owner.as.mutation(api.invites.create, {
      organizationId,
      projectId,
      expiry: "7d",
    });
    const member = await createUser(t, "Petr Malý", "petr@example.com");

    const result = await join(member, code);
    expect(result).toEqual({ organizationId, projectId });

    const organizations = await member.as.query(api.organizations.listForUser);
    expect(organizations[0].access).toBe("limited");

    const grants = await t.run(
      async (ctx) =>
        await ctx.db
          .query("projectMembers")
          .withIndex("by_project_user", (q) =>
            q.eq("projectId", projectId).eq("userId", member.userId),
          )
          .collect(),
    );
    expect(grants).toHaveLength(1);
  });

  test("an organization invite upgrades an existing limited member", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    const { projectId } = await owner.as.mutation(api.projects.create, {
      organizationId,
      name: "Web",
    });
    const projectInvite = await owner.as.mutation(api.invites.create, {
      organizationId,
      projectId,
      expiry: "7d",
    });
    const orgInvite = await owner.as.mutation(api.invites.create, {
      organizationId,
      expiry: "7d",
    });
    const member = await createUser(t, "Petr Malý", "petr@example.com");

    await join(member, projectInvite.code);
    await join(member, orgInvite.code);

    const organizations = await member.as.query(api.organizations.listForUser);
    expect(organizations).toHaveLength(1);
    expect(organizations[0].access).toBe("full");
  });

  test("a project invite never downgrades a full member", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    const { projectId } = await owner.as.mutation(api.projects.create, {
      organizationId,
      name: "Web",
    });
    const { code } = await owner.as.mutation(api.invites.create, {
      organizationId,
      projectId,
      expiry: "7d",
    });

    await join(owner, code);

    const organizations = await owner.as.query(api.organizations.listForUser);
    expect(organizations[0].access).toBe("full");
    expect(organizations[0].role).toBe("owner");
  });

  test("an expired invite cannot be accepted", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    const { inviteId, code } = await owner.as.mutation(api.invites.create, {
      organizationId,
      expiry: "6h",
    });
    await t.run(async (ctx) => {
      await ctx.db.patch(inviteId as Id<"invites">, {
        expiresAt: Date.now() - 1000,
      });
    });
    const member = await createUser(t, "Petr Malý", "petr@example.com");

    await expect(join(member, code)).rejects.toThrow(/vypršela/);
    expect(await member.as.query(api.organizations.listForUser)).toEqual([]);
  });

  test("a revoked invite cannot be accepted", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    const { inviteId, code } = await owner.as.mutation(api.invites.create, {
      organizationId,
      expiry: "7d",
    });
    await owner.as.mutation(api.invites.revoke, { inviteId });
    const member = await createUser(t, "Petr Malý", "petr@example.com");

    await expect(join(member, code)).rejects.toThrow(/zrušena/);
    expect(await member.as.query(api.organizations.listForUser)).toEqual([]);
  });

  test("accepting twice is idempotent and counts once", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    const { inviteId, code } = await owner.as.mutation(api.invites.create, {
      organizationId,
      expiry: "7d",
    });
    const member = await createUser(t, "Petr Malý", "petr@example.com");

    await join(member, code);
    await join(member, code);

    const invite = await t.run(
      async (ctx) => await ctx.db.get(inviteId as Id<"invites">),
    );
    expect(invite?.usedCount).toBe(1);
    expect(await member.as.query(api.organizations.listForUser)).toHaveLength(1);
  });

  test("an invite can be consumed by only one account", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    const { code } = await owner.as.mutation(api.invites.create, {
      organizationId,
      expiry: "7d",
    });
    const first = await createUser(t, "Petr Malý", "petr@example.com");
    const second = await createUser(t, "Eva Bílá", "eva@example.com");

    await join(first, code);
    await expect(join(second, code)).rejects.toThrow(/už byla použita/);
    expect(await second.as.query(api.organizations.listForUser)).toEqual([]);
  });

  test("the public invite lookup leaks no ids and reports the state", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    const { projectId } = await owner.as.mutation(api.projects.create, {
      organizationId,
      name: "Web",
    });
    const { code } = await owner.as.mutation(api.invites.create, {
      organizationId,
      projectId,
      expiry: "7d",
    });

    const summary = await t.query(api.invites.getByCode, { code });
    expect(summary).toEqual({
      organizationName: "Studio",
      projectName: "Web",
      inviterName: "Jana Nováková",
      expiresAt: expect.any(Number),
      expired: false,
      revoked: false,
      used: false,
    });
    expect(await t.query(api.invites.getByCode, { code: "NEEXISTUJE" })).toBeNull();
  });

  test("a plain member cannot create or list invites", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    const { code } = await owner.as.mutation(api.invites.create, {
      organizationId,
      expiry: "7d",
    });
    const member = await createUser(t, "Petr Malý", "petr@example.com");
    await join(member, code);

    await expect(
      member.as.mutation(api.invites.create, { organizationId, expiry: "7d" }),
    ).rejects.toThrow(/oprávnění/);
    expect(await member.as.query(api.invites.list, { organizationId })).toEqual(
      [],
    );
  });

  test("an invite for another organization's project is rejected", async () => {
    const t = setup();
    const first = await createOrgWithOwner(t, "Jana", "jana@example.com");
    const second = await createOrgWithOwner(t, "Karel", "karel@example.com");
    const { projectId } = await second.owner.as.mutation(api.projects.create, {
      organizationId: second.organizationId,
      name: "Cizí projekt",
    });

    await expect(
      first.owner.as.mutation(api.invites.create, {
        organizationId: first.organizationId,
        projectId,
        expiry: "7d",
      }),
    ).rejects.toThrow(/přístup|nepatří/);
  });

  test("a limited admin can issue invites only for a visible project", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    const { projectId: visibleProjectId } = await owner.as.mutation(
      api.projects.create,
      { organizationId, name: "Viditelný" },
    );
    const { projectId: hiddenProjectId } = await owner.as.mutation(
      api.projects.create,
      { organizationId, name: "Skrytý" },
    );
    const { code } = await owner.as.mutation(api.invites.create, {
      organizationId,
      projectId: visibleProjectId,
      expiry: "7d",
    });
    const admin = await createUser(t, "Petr Malý", "petr@example.com");
    await join(admin, code);
    await owner.as.mutation(api.organizations.updateMemberRole, {
      organizationId,
      userId: admin.userId,
      role: "admin",
    });

    await admin.as.mutation(api.invites.create, {
      organizationId,
      projectId: visibleProjectId,
      expiry: "7d",
    });
    await expect(
      admin.as.mutation(api.invites.create, {
        organizationId,
        projectId: hiddenProjectId,
        expiry: "7d",
      }),
    ).rejects.toThrow(/přístup/);
    expect(
      await admin.as.query(api.invites.list, {
        organizationId,
        projectId: hiddenProjectId,
      }),
    ).toEqual([]);
  });
});

describe("organization management", () => {
  test("a plain member cannot rename the organization", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    const { code } = await owner.as.mutation(api.invites.create, {
      organizationId,
      expiry: "7d",
    });
    const member = await createUser(t, "Petr Malý", "petr@example.com");
    await join(member, code);

    await expect(
      member.as.mutation(api.organizations.rename, {
        organizationId,
        name: "Jiný název",
      }),
    ).rejects.toThrow(/oprávnění/);
  });

  test("the last owner cannot be demoted or removed", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );

    await expect(
      owner.as.mutation(api.organizations.updateMemberRole, {
        organizationId,
        userId: owner.userId,
        role: "admin",
      }),
    ).rejects.toThrow(/vlastníka/);
    await expect(
      owner.as.mutation(api.organizations.removeMember, {
        organizationId,
        userId: owner.userId,
      }),
    ).rejects.toThrow(/vlastníka/);
  });

  test("an admin cannot touch an owner or hand out the owner role", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    const { code } = await owner.as.mutation(api.invites.create, {
      organizationId,
      expiry: "7d",
    });
    const admin = await createUser(t, "Petr Malý", "petr@example.com");
    await join(admin, code);
    await owner.as.mutation(api.organizations.updateMemberRole, {
      organizationId,
      userId: admin.userId,
      role: "admin",
    });

    await expect(
      admin.as.mutation(api.organizations.updateMemberRole, {
        organizationId,
        userId: owner.userId,
        role: "member",
      }),
    ).rejects.toThrow(/vlastníka/);
    await expect(
      admin.as.mutation(api.organizations.updateMemberRole, {
        organizationId,
        userId: admin.userId,
        role: "owner",
      }),
    ).rejects.toThrow(/vlastníka/);
    await expect(
      admin.as.mutation(api.organizations.removeMember, {
        organizationId,
        userId: owner.userId,
      }),
    ).rejects.toThrow(/vlastník/i);
  });

  test("ownership can be handed over when another owner remains", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    const { code } = await owner.as.mutation(api.invites.create, {
      organizationId,
      expiry: "7d",
    });
    const successor = await createUser(t, "Petr Malý", "petr@example.com");
    await join(successor, code);

    await owner.as.mutation(api.organizations.updateMemberRole, {
      organizationId,
      userId: successor.userId,
      role: "owner",
    });
    await owner.as.mutation(api.organizations.updateMemberRole, {
      organizationId,
      userId: owner.userId,
      role: "admin",
    });

    const members = await successor.as.query(api.organizations.members, {
      organizationId,
    });
    expect(members.find((member) => member.userId === successor.userId)?.role).toBe(
      "owner",
    );
    expect(members.find((member) => member.userId === owner.userId)?.role).toBe(
      "admin",
    );
  });

  test("removing a member deletes their project grants", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    const { projectId } = await owner.as.mutation(api.projects.create, {
      organizationId,
      name: "Web",
    });
    const { code } = await owner.as.mutation(api.invites.create, {
      organizationId,
      projectId,
      expiry: "7d",
    });
    const member = await createUser(t, "Petr Malý", "petr@example.com");
    await join(member, code);

    await owner.as.mutation(api.organizations.removeMember, {
      organizationId,
      userId: member.userId,
    });

    const grants = await t.run(
      async (ctx) =>
        await ctx.db
          .query("projectMembers")
          .withIndex("by_user", (q) => q.eq("userId", member.userId))
          .collect(),
    );
    expect(grants).toEqual([]);
    expect(await member.as.query(api.organizations.listForUser)).toEqual([]);
    expect(
      await member.as.query(api.projects.get, { projectId }),
    ).toBeNull();
  });

  test("only managers see which projects a limited member can reach", async () => {
    const t = setup();
    const { owner, organizationId } = await createOrgWithOwner(
      t,
      "Jana Nováková",
      "jana@example.com",
    );
    const { projectId } = await owner.as.mutation(api.projects.create, {
      organizationId,
      name: "Web",
    });
    const projectInvite = await owner.as.mutation(api.invites.create, {
      organizationId,
      projectId,
      expiry: "7d",
    });
    const orgInvite = await owner.as.mutation(api.invites.create, {
      organizationId,
      expiry: "7d",
    });
    const limited = await createUser(t, "Petr Malý", "petr@example.com");
    const full = await createUser(t, "Eva Bílá", "eva@example.com");
    await join(limited, projectInvite.code);
    await join(full, orgInvite.code);

    const asOwner = await owner.as.query(api.organizations.members, {
      organizationId,
    });
    expect(
      asOwner.find((row) => row.userId === limited.userId)?.projects,
    ).toEqual([{ _id: projectId, name: "Web" }]);

    const asMember = await full.as.query(api.organizations.members, {
      organizationId,
    });
    expect(asMember).toHaveLength(3);
    expect(
      asMember.find((row) => row.userId === limited.userId)?.projects,
    ).toEqual([]);
  });
});

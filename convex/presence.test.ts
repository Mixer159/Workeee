import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { isOnline, ONLINE_WINDOW_MS, WRITE_GAP_MS } from "./lib/presence";
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
 * Presence: the heartbeat, the write throttle, and the two timestamps as the
 * members list serves them.
 *
 * The point of every test here is that the server decides when a row moves —
 * the client may send as many heartbeats as it likes, and an unauthenticated
 * one is a no-op rather than an error.
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

function presenceRow(t: Harness, userId: Id<"users">) {
  return t.run(
    async (ctx) =>
      await ctx.db
        .query("userPresence")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique(),
  );
}

function presenceRows(t: Harness) {
  return t.run(async (ctx) => await ctx.db.query("userPresence").collect());
}

describe("the heartbeat", () => {
  test("the first one creates the row", async () => {
    const t = setup();
    const jana = await createUser(t, "Jana Nováková", "jana@example.com");

    expect(await jana.as.mutation(api.presence.heartbeat, {})).toBeNull();

    const row = await presenceRow(t, jana.userId);
    expect(row?.lastSeenAt).toEqual(expect.any(Number));
    // A heartbeat is a visit, not work.
    expect(row?.lastActiveAt).toBeUndefined();
  });

  test("a second one inside the write gap changes nothing, after it writes", async () => {
    vi.useFakeTimers();
    try {
      const t = setup();
      const jana = await createUser(t, "Jana Nováková", "jana@example.com");

      await jana.as.mutation(api.presence.heartbeat, {});
      const first = (await presenceRow(t, jana.userId))?.lastSeenAt;
      expect(first).toEqual(Date.now());

      // Still inside the gap: the client sent one, the server ignored it.
      vi.setSystemTime(Date.now() + WRITE_GAP_MS - 1);
      await jana.as.mutation(api.presence.heartbeat, {});
      expect((await presenceRow(t, jana.userId))?.lastSeenAt).toBe(first);

      // Past it, the same call moves the row.
      vi.setSystemTime(Date.now() + 1);
      await jana.as.mutation(api.presence.heartbeat, {});
      expect((await presenceRow(t, jana.userId))?.lastSeenAt).toBe(Date.now());
    } finally {
      vi.useRealTimers();
    }
  });

  test("a signed-out tab is answered with null and writes nothing", async () => {
    const t = setup();

    // No toast, no throw: the timer of a tab that has just signed out must not
    // shout at somebody on their way to the sign-in screen.
    expect(await t.mutation(api.presence.heartbeat, {})).toBeNull();
    expect(await presenceRows(t)).toEqual([]);
  });
});

describe("what counts as activity", () => {
  test("creating a task records both the work and the visit", async () => {
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

    // Joining is not work, so nothing exists for Petr yet.
    expect(await presenceRow(t, petr.userId)).toBeNull();

    await petr.as.mutation(api.tasks.create, {
      projectId,
      statusId,
      title: "Opravit fakturaci",
    });

    const row = await presenceRow(t, petr.userId);
    expect(row?.lastActiveAt).toEqual(expect.any(Number));
    expect(row?.lastSeenAt).toBe(row?.lastActiveAt);
  });
});

describe("the members list", () => {
  test("carries both timestamps, and nulls for somebody never seen", async () => {
    const t = setup();
    const { owner, organizationId } = await createWorkspace(t);
    const petr = await addFullMember(
      t,
      owner,
      organizationId,
      "Petr Svoboda",
      "petr@example.com",
    );
    // Petr has only looked in; Jana created the project, which is work.
    await petr.as.mutation(api.presence.heartbeat, {});

    const members = await owner.as.query(api.organizations.members, {
      organizationId,
    });
    const jana = members.find((member) => member.userId === owner.userId);
    const seen = members.find((member) => member.userId === petr.userId);

    expect(jana?.lastSeenAt).toEqual(expect.any(Number));
    expect(jana?.lastActiveAt).toEqual(expect.any(Number));
    expect(seen?.lastSeenAt).toEqual(expect.any(Number));
    expect(seen?.lastActiveAt).toBeNull();
  });

  test("a member with no row at all reads as null on both", async () => {
    const t = setup();
    const owner = await createUser(t, "Jana Nováková", "jana@example.com");
    const { organizationId } = await owner.as.mutation(
      api.organizations.create,
      { name: "Studio" },
    );

    const [jana] = await owner.as.query(api.organizations.members, {
      organizationId,
    });
    expect(jana.lastSeenAt).toBeNull();
    expect(jana.lastActiveAt).toBeNull();
  });

  test("an outsider still gets nothing", async () => {
    const t = setup();
    const { organizationId } = await createWorkspace(t);
    const outsider = await createUser(t, "Cizí Člověk", "cizi@example.com");

    expect(
      await outsider.as.query(api.organizations.members, { organizationId }),
    ).toEqual([]);
  });
});

describe("isOnline", () => {
  test("never seen is offline, and the window is exclusive at its edge", () => {
    const now = 1_700_000_000_000;

    expect(isOnline(null, now)).toBe(false);
    expect(isOnline(now, now)).toBe(true);
    expect(isOnline(now - ONLINE_WINDOW_MS + 1, now)).toBe(true);
    expect(isOnline(now - ONLINE_WINDOW_MS, now)).toBe(false);
  });
});

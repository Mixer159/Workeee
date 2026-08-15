import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { serializeCommentBody } from "./lib/commentBody";
import schema from "./schema";

declare global {
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

async function createComment(t: Harness) {
  const owner = await createUser(t, "Jana Nováková", "jana@example.com");
  const { organizationId } = await owner.as.mutation(api.organizations.create, {
    name: "Studio",
  });
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
  const { commentId } = await owner.as.mutation(api.comments.create, {
    taskId,
    body: serializeCommentBody([{ type: "text", text: "Hotovo." }]),
  });
  return { owner, organizationId, projectId, taskId, commentId };
}

describe("comment reactions", () => {
  test("the same emoji is one reaction with a shared count", async () => {
    const t = setup();
    const { owner, organizationId, taskId, commentId } = await createComment(t);
    const mate = await addMember(t, owner, organizationId, {
      name: "Petr Malý",
      email: "petr@example.com",
    });

    await owner.as.mutation(api.commentReactions.toggle, {
      commentId,
      emoji: "👍",
    });
    await mate.as.mutation(api.commentReactions.toggle, {
      commentId,
      emoji: "👍",
    });

    const together = await owner.as.query(api.comments.listByTask, { taskId });
    expect(together[0].reactions).toEqual([
      { emoji: "👍", count: 2, reactedByMe: true },
    ]);

    await owner.as.mutation(api.commentReactions.toggle, {
      commentId,
      emoji: "👍",
    });
    const afterToggle = await owner.as.query(api.comments.listByTask, { taskId });
    expect(afterToggle[0].reactions).toEqual([
      { emoji: "👍", count: 1, reactedByMe: false },
    ]);
  });

  test("flags and joined emoji work, but text and emoji strings do not", async () => {
    const t = setup();
    const { owner, taskId, commentId } = await createComment(t);

    await owner.as.mutation(api.commentReactions.toggle, {
      commentId,
      emoji: "🇨🇿",
    });
    await owner.as.mutation(api.commentReactions.toggle, {
      commentId,
      emoji: "👩🏽‍💻",
    });
    await expect(
      owner.as.mutation(api.commentReactions.toggle, {
        commentId,
        emoji: "like",
      }),
    ).rejects.toThrow(/jedno emoji/);
    await expect(
      owner.as.mutation(api.commentReactions.toggle, {
        commentId,
        emoji: "👍❤️",
      }),
    ).rejects.toThrow(/jedno emoji/);

    const stream = await owner.as.query(api.comments.listByTask, { taskId });
    expect(stream[0].reactions.map((reaction) => reaction.emoji)).toEqual([
      "🇨🇿",
      "👩🏽‍💻",
    ]);
  });

  test("somebody without access cannot react", async () => {
    const t = setup();
    const { commentId } = await createComment(t);
    const outsider = await createUser(t, "Cizí Člověk", "cizi@example.com");

    await expect(
      outsider.as.mutation(api.commentReactions.toggle, {
        commentId,
        emoji: "👀",
      }),
    ).rejects.toThrow(/přístup/);
  });

  test("a comment keeps at most twenty different reaction types", async () => {
    const t = setup();
    const { owner, commentId } = await createComment(t);
    const emoji = [
      "👍",
      "❤️",
      "😂",
      "🎉",
      "😮",
      "😢",
      "🙌",
      "👀",
      "🔥",
      "✅",
      "🚀",
      "👏",
      "🤔",
      "👎",
      "💡",
      "💯",
      "😍",
      "🤝",
      "🙏",
      "⭐",
    ];
    for (const reaction of emoji) {
      await owner.as.mutation(api.commentReactions.toggle, {
        commentId,
        emoji: reaction,
      });
    }

    await expect(
      owner.as.mutation(api.commentReactions.toggle, {
        commentId,
        emoji: "⚡",
      }),
    ).rejects.toThrow(/nejvýš 20/);
  });

  test("reactions are deleted with their comment and their task", async () => {
    const t = setup();
    const { owner, taskId, commentId } = await createComment(t);
    await owner.as.mutation(api.commentReactions.toggle, {
      commentId,
      emoji: "❤️",
    });
    await owner.as.mutation(api.comments.remove, { commentId });
    expect(
      await t.run(async (ctx) => await ctx.db.query("commentReactions").collect()),
    ).toEqual([]);

    const { commentId: nextCommentId } = await owner.as.mutation(
      api.comments.create,
      {
        taskId,
        body: serializeCommentBody([{ type: "text", text: "Ještě jedna." }]),
      },
    );
    await owner.as.mutation(api.commentReactions.toggle, {
      commentId: nextCommentId,
      emoji: "🎉",
    });
    await owner.as.mutation(api.tasks.remove, { taskId });
    expect(
      await t.run(async (ctx) => await ctx.db.query("commentReactions").collect()),
    ).toEqual([]);
  });
});

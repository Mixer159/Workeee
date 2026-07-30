import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
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
type Identity = ReturnType<Harness["withIdentity"]>;

async function createUser(t: Harness, name: string, email: string) {
  const authId = `auth_${email}`;
  const userId = await t.run(
    async (ctx) => await ctx.db.insert("users", { authId, name, email }),
  );
  return { userId, as: t.withIdentity({ subject: authId, name, email }) };
}

/** An organization with an owner, one project and one task on the board. */
async function createTask(t: Harness) {
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
  return { owner, organizationId, projectId, taskId };
}

/**
 * Every blob gets distinct bytes on purpose: `convex-test` derives its serving
 * URL from the **content**, so two identical uploads would share one URL and a
 * document naming the first would look like it also names the second. A real
 * deployment serves `/api/storage/<storageId>`, which is why the reaper tests
 * the raw storage id as well as the URL.
 */
let blobCounter = 0;

async function storeBlob(t: Harness) {
  blobCounter += 1;
  const bytes = new Uint8Array(8).fill(blobCounter % 256);
  return await t.run(
    async (ctx) => await ctx.storage.store(new Blob([bytes], { type: "image/png" })),
  );
}

async function registerFile(
  user: { as: Identity },
  args: {
    taskId: Id<"tasks">;
    storageId: Id<"_storage">;
    fileName: string;
    mimeType: string;
    context: "attachment" | "content" | "comment";
  },
) {
  const result = await user.as.mutation(api.files.register, args);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.file;
}

async function upload(
  t: Harness,
  user: { as: Identity },
  taskId: Id<"tasks">,
  context: "attachment" | "content" | "comment",
) {
  const storageId = await storeBlob(t);
  const file = await registerFile(user, {
    taskId,
    storageId,
    fileName: "snimek.png",
    mimeType: "image/png",
    context,
  });
  return { fileId: file._id, storageId, url: file.url };
}

async function fileRow(t: Harness, fileId: Id<"files">) {
  return await t.run(async (ctx) => await ctx.db.get(fileId));
}

async function blobExists(t: Harness, storageId: Id<"_storage">) {
  return await t.run(
    async (ctx) => (await ctx.db.system.get(storageId)) !== null,
  );
}

/**
 * "Everything that exists is old enough."
 *
 * `_creationTime` is assigned by the database, so a test cannot age a row —
 * hence the threshold is an argument of the mutation. It cannot simply be `0`
 * either: `convex-test` hands out `_creationTime` from a monotonic counter that
 * drifts *ahead* of the wall clock once a file has inserted a few hundred
 * documents, so `Date.now() - 0` would sit before rows that already exist. The
 * age is therefore measured against the newest file, not against the clock.
 */
async function reap(t: Harness, limit?: number) {
  const newest = await t.run(async (ctx) => {
    const rows = await ctx.db.query("files").collect();
    return rows.reduce((max, row) => Math.max(max, row._creationTime), 0);
  });
  return await t.mutation(internal.fileReaper.reapOrphanedFiles, {
    olderThanMs: Date.now() - newest - 1,
    limit,
  });
}

const documentWith = (url: string) =>
  JSON.stringify([
    { type: "paragraph", content: [{ type: "text", text: "Ahoj" }] },
    { type: "image", props: { url } },
  ]);

describe("orphaned comment uploads", () => {
  test("an upload no comment ever claimed is deleted with its blob", async () => {
    const t = setup();
    const { owner, taskId } = await createTask(t);
    const orphan = await upload(t, owner, taskId, "comment");

    const result = await reap(t);

    expect(result.comment).toBe(1);
    expect(await fileRow(t, orphan.fileId)).toBeNull();
    expect(await blobExists(t, orphan.storageId)).toBe(false);
  });

  test("an upload a posted comment claimed is kept", async () => {
    const t = setup();
    const { owner, taskId } = await createTask(t);
    const claimed = await upload(t, owner, taskId, "comment");
    await owner.as.mutation(api.comments.create, {
      taskId,
      body: serializeCommentBody([{ type: "text", text: "Mrkni na to" }]),
      attachmentIds: [claimed.fileId],
    });

    const result = await reap(t);

    expect(result.comment).toBe(0);
    expect(await fileRow(t, claimed.fileId)).not.toBeNull();
    expect(await blobExists(t, claimed.storageId)).toBe(true);
  });

  test("a fresh upload inside the grace period is left alone", async () => {
    const t = setup();
    const { owner, taskId } = await createTask(t);
    const orphan = await upload(t, owner, taskId, "comment");

    // The default threshold: nothing created seconds ago is reapable.
    const result = await t.mutation(internal.fileReaper.reapOrphanedFiles, {});

    expect(result.scanned).toBe(0);
    expect(result.comment).toBe(0);
    expect(await fileRow(t, orphan.fileId)).not.toBeNull();
  });
});

describe("orphaned body images", () => {
  test("an image the document no longer names is deleted with its blob", async () => {
    const t = setup();
    const { owner, taskId } = await createTask(t);
    const kept = await upload(t, owner, taskId, "content");
    const dropped = await upload(t, owner, taskId, "content");
    await owner.as.mutation(api.taskContent.save, {
      taskId,
      content: documentWith(kept.url!),
    });

    const result = await reap(t);

    expect(result.content).toBe(1);
    expect(await fileRow(t, dropped.fileId)).toBeNull();
    expect(await blobExists(t, dropped.storageId)).toBe(false);
    expect(await fileRow(t, kept.fileId)).not.toBeNull();
    expect(await blobExists(t, kept.storageId)).toBe(true);
  });

  test("a task with no saved document keeps no body images", async () => {
    const t = setup();
    const { owner, taskId } = await createTask(t);
    const orphan = await upload(t, owner, taskId, "content");

    const result = await reap(t);

    expect(result.content).toBe(1);
    expect(await fileRow(t, orphan.fileId)).toBeNull();
  });

  test("attachments are never touched — they are listed, not referenced", async () => {
    const t = setup();
    const { owner, taskId } = await createTask(t);
    const attachment = await upload(t, owner, taskId, "attachment");

    const result = await reap(t);

    expect(result.comment + result.content).toBe(0);
    expect(await fileRow(t, attachment.fileId)).not.toBeNull();
    expect(await blobExists(t, attachment.storageId)).toBe(true);
  });
});

describe("the batch cap", () => {
  test("a run never examines more than `limit` rows per branch", async () => {
    const t = setup();
    const { owner, taskId } = await createTask(t);
    await upload(t, owner, taskId, "comment");
    await upload(t, owner, taskId, "comment");
    await upload(t, owner, taskId, "comment");

    const result = await reap(t, 2);

    expect(result.scanned).toBe(2);
    expect(result.comment).toBe(2);

    const remaining = await t.run(
      async (ctx) => await ctx.db.query("files").collect(),
    );
    expect(remaining).toHaveLength(1);
  });
});

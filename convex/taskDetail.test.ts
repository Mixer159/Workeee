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

/** A stored blob, bypassing the upload URL the client would POST to. */
async function storeBlob(
  t: Harness,
  options: { type: string; bytes?: number },
) {
  return await t.run(
    async (ctx) =>
      await ctx.storage.store(
        new Blob([new Uint8Array(options.bytes ?? 8)], { type: options.type }),
      ),
  );
}

/**
 * Register an upload and assert it was accepted — `files.register` answers with
 * a result rather than throwing, so that the blob of a rejected upload can
 * actually be deleted (a throw would roll the deletion back).
 */
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

const text = (value: string) =>
  serializeCommentBody([{ type: "text", text: value }]);

async function updatedAtOf(t: Harness, taskId: Id<"tasks">) {
  return await t.run(async (ctx) => (await ctx.db.get(taskId))!.updatedAt);
}

describe("task content", () => {
  test("a member saves the body and the task is marked as updated", async () => {
    const t = setup();
    const { owner, taskId } = await createTask(t);
    const before = await updatedAtOf(t, taskId);

    const content = JSON.stringify([
      { type: "paragraph", content: [{ type: "text", text: "Ahoj" }] },
    ]);
    await owner.as.mutation(api.taskContent.save, { taskId, content });

    expect(await owner.as.query(api.taskContent.get, { taskId })).toMatchObject({
      content,
    });
    expect(await updatedAtOf(t, taskId)).toBeGreaterThanOrEqual(before);
  });

  test("saving twice keeps exactly one row", async () => {
    const t = setup();
    const { owner, taskId } = await createTask(t);

    await owner.as.mutation(api.taskContent.save, { taskId, content: "[]" });
    await owner.as.mutation(api.taskContent.save, {
      taskId,
      content: '[{"type":"paragraph"}]',
    });

    const rows = await t.run(
      async (ctx) =>
        await ctx.db
          .query("taskContent")
          .withIndex("by_task", (q) => q.eq("taskId", taskId))
          .collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].content).toBe('[{"type":"paragraph"}]');
  });

  test("a body that is not JSON, or is over the size cap, is refused", async () => {
    const t = setup();
    const { owner, taskId } = await createTask(t);

    await expect(
      owner.as.mutation(api.taskContent.save, { taskId, content: "not json" }),
    ).rejects.toThrow(/nepovedlo/);
    await expect(
      owner.as.mutation(api.taskContent.save, {
        taskId,
        content: JSON.stringify(["x".repeat(1024 * 1024 + 10)]),
      }),
    ).rejects.toThrow(/dlouhý/);
  });

  test("a malformed or excessively nested block document is refused", async () => {
    const t = setup();
    const { owner, taskId } = await createTask(t);

    await expect(
      owner.as.mutation(api.taskContent.save, {
        taskId,
        content: JSON.stringify([{ type: "unknown" }]),
      }),
    ).rejects.toThrow(/nepovedlo/);
    await expect(
      owner.as.mutation(api.taskContent.save, {
        taskId,
        content: JSON.stringify([{ type: "paragraph", content: [null] }]),
      }),
    ).rejects.toThrow(/nepovedlo/);

    let nested: Record<string, unknown> = { type: "paragraph" };
    for (let depth = 0; depth < 51; depth += 1) {
      nested = { type: "paragraph", children: [nested] };
    }
    await expect(
      owner.as.mutation(api.taskContent.save, {
        taskId,
        content: JSON.stringify([nested]),
      }),
    ).rejects.toThrow(/nepovedlo/);
  });

  test("an outsider can neither read nor write the body", async () => {
    const t = setup();
    const { owner, taskId } = await createTask(t);
    await owner.as.mutation(api.taskContent.save, { taskId, content: "[]" });
    const outsider = await createUser(t, "Cizí Člověk", "cizi@example.com");

    expect(await outsider.as.query(api.taskContent.get, { taskId })).toBeNull();
    await expect(
      outsider.as.mutation(api.taskContent.save, { taskId, content: "[]" }),
    ).rejects.toThrow(/přístup/);
  });

  test("a limited member of another project cannot reach the body", async () => {
    const t = setup();
    const { owner, organizationId, taskId } = await createTask(t);
    const { projectId: other } = await owner.as.mutation(api.projects.create, {
      organizationId,
      name: "Aplikace",
    });
    const stranger = await addMember(t, owner, organizationId, {
      name: "Petr Malý",
      email: "petr@example.com",
      projectId: other,
    });

    expect(await stranger.as.query(api.taskContent.get, { taskId })).toBeNull();
    await expect(
      stranger.as.mutation(api.taskContent.save, { taskId, content: "[]" }),
    ).rejects.toThrow(/přístup/);
  });
});

describe("files", () => {
  test("an attachment is registered, listed and removed with its blob", async () => {
    const t = setup();
    const { owner, taskId } = await createTask(t);
    const storageId = await storeBlob(t, { type: "image/png" });

    const file = await registerFile(owner, {
      taskId,
      storageId,
      fileName: "screenshot.png",
      mimeType: "image/png",
      context: "attachment",
    });
    expect(file).toMatchObject({
      fileName: "screenshot.png",
      mimeType: "image/png",
      isImage: true,
    });

    const listed = await owner.as.query(api.files.listByTask, { taskId });
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      fileName: "screenshot.png",
      canRemove: true,
      uploadedBy: { name: "Jana Nováková" },
    });

    await owner.as.mutation(api.files.remove, { fileId: file._id });
    expect(await owner.as.query(api.files.listByTask, { taskId })).toEqual([]);
    expect(
      await t.run(async (ctx) => await ctx.db.system.get(storageId)),
    ).toBeNull();
  });

  test("images inside the description do not show up in the attachment list", async () => {
    const t = setup();
    const { owner, taskId } = await createTask(t);
    await registerFile(owner, {
      taskId,
      storageId: await storeBlob(t, { type: "image/png" }),
      fileName: "inline.png",
      mimeType: "image/png",
      context: "content",
    });

    expect(await owner.as.query(api.files.listByTask, { taskId })).toEqual([]);
  });

  test("an oversized blob is refused and its blob is deleted", async () => {
    const t = setup();
    const { owner, taskId } = await createTask(t);
    const storageId = await storeBlob(t, {
      type: "image/png",
      bytes: 10 * 1024 * 1024 + 1,
    });

    const result = await owner.as.mutation(api.files.register, {
      taskId,
      storageId,
      fileName: "velky.png",
      mimeType: "image/png",
      context: "attachment",
    });
    expect(result).toEqual({ ok: false, error: "Soubor může mít nejvýš 10 MB." });
    expect(
      await t.run(async (ctx) => await ctx.db.system.get(storageId)),
    ).toBeNull();
    expect(await owner.as.query(api.files.listByTask, { taskId })).toEqual([]);
  });

  test("a blocked content type is refused and its blob is deleted", async () => {
    const t = setup();
    const { owner, taskId } = await createTask(t);
    const storageId = await storeBlob(t, { type: "image/svg+xml" });

    const result = await owner.as.mutation(api.files.register, {
      taskId,
      storageId,
      fileName: "xss.svg",
      mimeType: "image/svg+xml",
      context: "attachment",
    });
    expect(result).toEqual({ ok: false, error: "Tento typ souboru nahrát nejde." });
    expect(
      await t.run(async (ctx) => await ctx.db.system.get(storageId)),
    ).toBeNull();
  });

  test.each(["application/xml", "text/xml", "application/atom+xml"])(
    "the active XML type %s is refused and its blob is deleted",
    async (mimeType) => {
      const t = setup();
      const { owner, taskId } = await createTask(t);
      const storageId = await storeBlob(t, { type: mimeType });

      const result = await owner.as.mutation(api.files.register, {
        taskId,
        storageId,
        fileName: "aktivni.xml",
        mimeType,
        context: "attachment",
      });

      expect(result).toEqual({
        ok: false,
        error: "Tento typ souboru nahrát nejde.",
      });
      expect(
        await t.run(async (ctx) => await ctx.db.system.get(storageId)),
      ).toBeNull();
    },
  );

  test("an outsider gets no upload URL, no list and no file row", async () => {
    const t = setup();
    const { owner, taskId } = await createTask(t);
    await registerFile(owner, {
      taskId,
      storageId: await storeBlob(t, { type: "image/png" }),
      fileName: "tajne.png",
      mimeType: "image/png",
      context: "attachment",
    });
    const outsider = await createUser(t, "Cizí Člověk", "cizi@example.com");
    const storageId = await storeBlob(t, { type: "image/png" });

    expect(await outsider.as.query(api.files.listByTask, { taskId })).toEqual([]);
    await expect(
      outsider.as.mutation(api.files.generateUploadUrl, { taskId }),
    ).rejects.toThrow(/přístup/);
    await expect(
      outsider.as.mutation(api.files.register, {
        taskId,
        storageId,
        fileName: "cizi.png",
        mimeType: "image/png",
        context: "attachment",
      }),
    ).rejects.toThrow(/přístup/);
    expect(await owner.as.query(api.files.listByTask, { taskId })).toHaveLength(1);
  });

  test("a blob somebody already registered cannot be registered again", async () => {
    const t = setup();
    const { owner, organizationId, taskId } = await createTask(t);
    const mate = await addMember(t, owner, organizationId, {
      name: "Petr Malý",
      email: "petr@example.com",
    });
    const storageId = await storeBlob(t, { type: "image/png" });
    await registerFile(owner, {
      taskId,
      storageId,
      fileName: "obrazek.png",
      mimeType: "image/png",
      context: "attachment",
    });

    // Otherwise deleting one row would empty the other row's file.
    await expect(
      mate.as.mutation(api.files.register, {
        taskId,
        storageId,
        fileName: "ukradeny.png",
        mimeType: "image/png",
        context: "attachment",
      }),
    ).rejects.toThrow(/už aplikace používá/);
  });

  test("a project icon blob cannot be rebound as a task file", async () => {
    const t = setup();
    const { owner, projectId, taskId } = await createTask(t);
    const storageId = await storeBlob(t, { type: "image/png" });
    await t.run(async (ctx) => {
      await ctx.db.patch(projectId, { iconStorageId: storageId });
    });

    await expect(
      owner.as.mutation(api.files.register, {
        taskId,
        storageId,
        fileName: "ukradena-ikona.png",
        mimeType: "image/png",
        context: "attachment",
      }),
    ).rejects.toThrow(/už aplikace používá/);

    expect(
      await t.run(async (ctx) => (await ctx.db.get(projectId))?.iconStorageId),
    ).toBe(storageId);
    expect(
      await t.run(async (ctx) => await ctx.db.system.get(storageId)),
    ).not.toBeNull();
  });

  test("a task file blob cannot be rebound as a project icon", async () => {
    const t = setup();
    const { owner, projectId, taskId } = await createTask(t);
    const storageId = await storeBlob(t, { type: "image/png" });
    const file = await registerFile(owner, {
      taskId,
      storageId,
      fileName: "soubor.png",
      mimeType: "image/png",
      context: "attachment",
    });

    await expect(
      owner.as.mutation(api.projects.setIcon, { projectId, storageId }),
    ).rejects.toThrow(/už aplikace používá/);

    expect(await owner.as.query(api.files.listByTask, { taskId })).toHaveLength(1);
    expect(
      await t.run(async (ctx) => await ctx.db.system.get(storageId)),
    ).not.toBeNull();
    expect(
      await t.run(async (ctx) => await ctx.db.get(file._id)),
    ).not.toBeNull();
  });

  test("storage claims cannot cross organization boundaries", async () => {
    const t = setup();
    const first = await createTask(t);
    const fileStorageId = await storeBlob(t, { type: "image/png" });
    await registerFile(first.owner, {
      taskId: first.taskId,
      storageId: fileStorageId,
      fileName: "prvni.png",
      mimeType: "image/png",
      context: "attachment",
    });

    const secondOwner = await createUser(t, "Eva Bílá", "eva@example.com");
    const { organizationId: secondOrganizationId } =
      await secondOwner.as.mutation(api.organizations.create, {
        name: "Druhé studio",
      });
    const { projectId: secondProjectId } = await secondOwner.as.mutation(
      api.projects.create,
      { organizationId: secondOrganizationId, name: "Druhý projekt" },
    );
    const statuses = await secondOwner.as.query(api.taskStatuses.list, {
      projectId: secondProjectId,
    });
    const { taskId: secondTaskId } = await secondOwner.as.mutation(
      api.tasks.create,
      {
        projectId: secondProjectId,
        statusId: statuses[0]._id,
        title: "Druhý úkol",
      },
    );

    await expect(
      secondOwner.as.mutation(api.projects.setIcon, {
        projectId: secondProjectId,
        storageId: fileStorageId,
      }),
    ).rejects.toThrow(/už aplikace používá/);

    const iconStorageId = await storeBlob(t, { type: "image/png" });
    await t.run(async (ctx) => {
      await ctx.db.patch(first.projectId, { iconStorageId });
    });
    await expect(
      secondOwner.as.mutation(api.files.register, {
        taskId: secondTaskId,
        storageId: iconStorageId,
        fileName: "cizi-ikona.png",
        mimeType: "image/png",
        context: "attachment",
      }),
    ).rejects.toThrow(/už aplikace používá/);

    expect(
      await t.run(async (ctx) => await ctx.db.system.get(fileStorageId)),
    ).not.toBeNull();
    expect(
      await t.run(async (ctx) => await ctx.db.system.get(iconStorageId)),
    ).not.toBeNull();
  });

  test("only the uploader or a project manager may delete a file", async () => {
    const t = setup();
    const { owner, organizationId, taskId } = await createTask(t);
    const author = await addMember(t, owner, organizationId, {
      name: "Petr Malý",
      email: "petr@example.com",
    });
    const other = await addMember(t, owner, organizationId, {
      name: "Eva Bílá",
      email: "eva@example.com",
    });

    const file = await registerFile(author, {
      taskId,
      storageId: await storeBlob(t, { type: "application/pdf" }),
      fileName: "zadani.pdf",
      mimeType: "application/pdf",
      context: "attachment",
    });

    await expect(
      other.as.mutation(api.files.remove, { fileId: file._id }),
    ).rejects.toThrow(/nahrál/);
    // The owner is a project manager, so this one goes through.
    await owner.as.mutation(api.files.remove, { fileId: file._id });
    expect(await owner.as.query(api.files.listByTask, { taskId })).toEqual([]);
  });

  test("the per-surface count is capped", async () => {
    const t = setup();
    const { owner, taskId } = await createTask(t);
    for (let index = 0; index < 30; index += 1) {
      await registerFile(owner, {
        taskId,
        storageId: await storeBlob(t, { type: "image/png" }),
        fileName: `soubor-${index}.png`,
        mimeType: "image/png",
        context: "attachment",
      });
    }

    const storageId = await storeBlob(t, { type: "image/png" });
    const result = await owner.as.mutation(api.files.register, {
      taskId,
      storageId,
      fileName: "posledni.png",
      mimeType: "image/png",
      context: "attachment",
    });
    expect(result).toMatchObject({ ok: false });
    expect(
      await t.run(async (ctx) => await ctx.db.system.get(storageId)),
    ).toBeNull();
    expect(await owner.as.query(api.files.listByTask, { taskId })).toHaveLength(30);
  });
});

describe("comments", () => {
  test("a comment with a mention is stored and shaped for the stream", async () => {
    const t = setup();
    const { owner, organizationId, taskId } = await createTask(t);
    const mate = await addMember(t, owner, organizationId, {
      name: "Petr Malý",
      email: "petr@example.com",
    });
    const before = await updatedAtOf(t, taskId);

    await owner.as.mutation(api.comments.create, {
      taskId,
      body: serializeCommentBody([
        { type: "text", text: "Mrkni na to " },
        { type: "mention", userId: mate.userId, name: "Petr Malý" },
        { type: "text", text: ", prosím." },
      ]),
    });

    const stream = await mate.as.query(api.comments.listByTask, { taskId });
    expect(stream).toHaveLength(1);
    expect(stream[0].author?.name).toBe("Jana Nováková");
    expect(stream[0].body).toEqual([
      { type: "text", text: "Mrkni na to " },
      { type: "mention", userId: mate.userId, name: "Petr Malý" },
      { type: "text", text: ", prosím." },
    ]);
    expect(stream[0].edited).toBe(false);
    expect(stream[0].canEdit).toBe(false);
    expect(await updatedAtOf(t, taskId)).toBeGreaterThanOrEqual(before);
  });

  test("mentioning somebody without access to the project is refused", async () => {
    const t = setup();
    const { owner, organizationId, taskId } = await createTask(t);
    const { projectId: other } = await owner.as.mutation(api.projects.create, {
      organizationId,
      name: "Aplikace",
    });
    const elsewhere = await addMember(t, owner, organizationId, {
      name: "Petr Malý",
      email: "petr@example.com",
      projectId: other,
    });

    await expect(
      owner.as.mutation(api.comments.create, {
        taskId,
        body: serializeCommentBody([
          { type: "mention", userId: elsewhere.userId, name: "Petr Malý" },
        ]),
      }),
    ).rejects.toThrow(/Zmíněný člověk/);
  });

  test("an empty comment and a malformed body are refused", async () => {
    const t = setup();
    const { owner, taskId } = await createTask(t);

    await expect(
      owner.as.mutation(api.comments.create, { taskId, body: text("   ") }),
    ).rejects.toThrow(/Napište komentář/);
    await expect(
      owner.as.mutation(api.comments.create, { taskId, body: "nope" }),
    ).rejects.toThrow(/nepovedlo/);
    await expect(
      owner.as.mutation(api.comments.create, {
        taskId,
        body: JSON.stringify([{ type: "script", text: "x" }]),
      }),
    ).rejects.toThrow(/nepovedlo/);
  });

  test("the 201st comment on a task is refused", async () => {
    const t = setup();
    const { owner, organizationId, projectId, taskId } = await createTask(t);

    await t.run(async (ctx) => {
      await Promise.all(
        Array.from({ length: 200 }, (_, index) =>
          ctx.db.insert("comments", {
            taskId,
            projectId,
            organizationId,
            authorId: owner.userId,
            body: text(`Komentář ${index + 1}`),
          }),
        ),
      );
    });

    await expect(
      owner.as.mutation(api.comments.create, {
        taskId,
        body: text("Komentář 201"),
      }),
    ).rejects.toThrow(/nejvýš 200/);
  });

  test("a comment attachment must be the author's own upload on this task", async () => {
    const t = setup();
    const { owner, organizationId, taskId } = await createTask(t);
    const mate = await addMember(t, owner, organizationId, {
      name: "Petr Malý",
      email: "petr@example.com",
    });

    const mine = await registerFile(owner, {
      taskId,
      storageId: await storeBlob(t, { type: "image/png" }),
      fileName: "moje.png",
      mimeType: "image/png",
      context: "comment",
    });
    const theirs = await registerFile(mate, {
      taskId,
      storageId: await storeBlob(t, { type: "image/png" }),
      fileName: "cizi.png",
      mimeType: "image/png",
      context: "comment",
    });
    const attachment = await registerFile(owner, {
      taskId,
      storageId: await storeBlob(t, { type: "image/png" }),
      fileName: "priloha.png",
      mimeType: "image/png",
      context: "attachment",
    });

    await expect(
      owner.as.mutation(api.comments.create, {
        taskId,
        body: text("Cizí soubor"),
        attachmentIds: [theirs._id],
      }),
    ).rejects.toThrow(/připojit/);
    await expect(
      owner.as.mutation(api.comments.create, {
        taskId,
        body: text("Špatný kontext"),
        attachmentIds: [attachment._id],
      }),
    ).rejects.toThrow(/připojit/);

    await owner.as.mutation(api.comments.create, {
      taskId,
      body: text("S obrázkem"),
      attachmentIds: [mine._id],
    });
    const stream = await owner.as.query(api.comments.listByTask, { taskId });
    expect(stream[0].attachments).toHaveLength(1);
    expect(stream[0].attachments[0]).toMatchObject({
      fileName: "moje.png",
      isImage: true,
    });

    // A claimed file cannot be attached to a second comment.
    await expect(
      owner.as.mutation(api.comments.create, {
        taskId,
        body: text("Znovu"),
        attachmentIds: [mine._id],
      }),
    ).rejects.toThrow(/připojit/);
  });

  test("only the author may edit a comment, and the edit is marked", async () => {
    const t = setup();
    const { owner, organizationId, taskId } = await createTask(t);
    const mate = await addMember(t, owner, organizationId, {
      name: "Petr Malý",
      email: "petr@example.com",
    });
    const { commentId } = await mate.as.mutation(api.comments.create, {
      taskId,
      body: text("Původní znění"),
    });

    await expect(
      owner.as.mutation(api.comments.update, {
        commentId,
        body: text("Cizí úprava"),
      }),
    ).rejects.toThrow(/autor/);

    await mate.as.mutation(api.comments.update, {
      commentId,
      body: text("Opravené znění"),
    });
    const stream = await owner.as.query(api.comments.listByTask, { taskId });
    expect(stream[0].body).toEqual([{ type: "text", text: "Opravené znění" }]);
    expect(stream[0].edited).toBe(true);
  });

  test("a project manager may delete somebody else's comment, and its blobs go too", async () => {
    const t = setup();
    const { owner, organizationId, taskId } = await createTask(t);
    const mate = await addMember(t, owner, organizationId, {
      name: "Petr Malý",
      email: "petr@example.com",
    });
    const other = await addMember(t, owner, organizationId, {
      name: "Eva Bílá",
      email: "eva@example.com",
    });
    const storageId = await storeBlob(t, { type: "image/png" });
    const file = await registerFile(mate, {
      taskId,
      storageId,
      fileName: "obrazek.png",
      mimeType: "image/png",
      context: "comment",
    });
    const { commentId } = await mate.as.mutation(api.comments.create, {
      taskId,
      body: text("S přílohou"),
      attachmentIds: [file._id],
    });

    await expect(
      other.as.mutation(api.comments.remove, { commentId }),
    ).rejects.toThrow(/autor/);

    await owner.as.mutation(api.comments.remove, { commentId });
    expect(await owner.as.query(api.comments.listByTask, { taskId })).toEqual([]);
    expect(await t.run(async (ctx) => await ctx.db.get(file._id))).toBeNull();
    expect(
      await t.run(async (ctx) => await ctx.db.system.get(storageId)),
    ).toBeNull();
  });

  test("a claimed comment attachment cannot be deleted on its own", async () => {
    const t = setup();
    const { owner, taskId } = await createTask(t);
    const file = await registerFile(owner, {
      taskId,
      storageId: await storeBlob(t, { type: "image/png" }),
      fileName: "obrazek.png",
      mimeType: "image/png",
      context: "comment",
    });
    await owner.as.mutation(api.comments.create, {
      taskId,
      body: text("S přílohou"),
      attachmentIds: [file._id],
    });

    await expect(
      owner.as.mutation(api.files.remove, { fileId: file._id }),
    ).rejects.toThrow(/komentář/);
  });

  test("an outsider reads nothing and writes nothing", async () => {
    const t = setup();
    const { owner, taskId } = await createTask(t);
    await owner.as.mutation(api.comments.create, {
      taskId,
      body: text("Interní poznámka"),
    });
    const outsider = await createUser(t, "Cizí Člověk", "cizi@example.com");

    expect(
      await outsider.as.query(api.comments.listByTask, { taskId }),
    ).toEqual([]);
    await expect(
      outsider.as.mutation(api.comments.create, {
        taskId,
        body: text("Cizí komentář"),
      }),
    ).rejects.toThrow(/přístup/);
  });

  test("a limited member of another project reads nothing and writes nothing", async () => {
    const t = setup();
    const { owner, organizationId, taskId } = await createTask(t);
    const { projectId: other } = await owner.as.mutation(api.projects.create, {
      organizationId,
      name: "Aplikace",
    });
    const stranger = await addMember(t, owner, organizationId, {
      name: "Petr Malý",
      email: "petr@example.com",
      projectId: other,
    });

    expect(
      await stranger.as.query(api.comments.listByTask, { taskId }),
    ).toEqual([]);
    await expect(
      stranger.as.mutation(api.comments.create, {
        taskId,
        body: text("Cizí komentář"),
      }),
    ).rejects.toThrow(/přístup/);
    expect(await stranger.as.query(api.files.listByTask, { taskId })).toEqual([]);
  });
});

describe("deleting a task", () => {
  test("takes its body, its files and its comments with it", async () => {
    const t = setup();
    const { owner, taskId } = await createTask(t);
    const storageId = await storeBlob(t, { type: "image/png" });
    await owner.as.mutation(api.taskContent.save, { taskId, content: "[]" });
    const file = await registerFile(owner, {
      taskId,
      storageId,
      fileName: "priloha.png",
      mimeType: "image/png",
      context: "attachment",
    });
    await owner.as.mutation(api.comments.create, {
      taskId,
      body: text("Komentář"),
    });

    await owner.as.mutation(api.tasks.remove, { taskId });

    const left = await t.run(async (ctx) => ({
      content: await ctx.db.query("taskContent").collect(),
      comments: await ctx.db.query("comments").collect(),
      file: await ctx.db.get(file._id),
      blob: await ctx.db.system.get(storageId),
    }));
    expect(left.content).toEqual([]);
    expect(left.comments).toEqual([]);
    expect(left.file).toBeNull();
    expect(left.blob).toBeNull();
  });
});

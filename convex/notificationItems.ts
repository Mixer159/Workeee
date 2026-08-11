import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { getOrgAccess, getProjectAccess, requireOrgAccess } from "./lib/access";
import { getAuthUserId } from "./lib/auth";
import { commentPreview } from "./lib/notifications";

/**
 * The in-app notification feed — what `/upozorneni` renders and what the badge
 * in the rail counts. Rows are written by the same `notify*` calls that feed
 * the e-mail digest (`convex/lib/notificationItems.ts`); everything shown here
 * is read live and re-authorized, exactly like the digest at flush time — a
 * feed row is a pointer, never a copy.
 */

/** The feed page shows this many. Older rows exist but are not worth paging. */
const MAX_FEED_ITEMS = 50;

/** Past this the badge reads "99+" anyway; no reason to count further. */
const MAX_UNREAD_COUNT = 100;

export const list = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    if (!(await getOrgAccess(ctx, userId, args.organizationId))) {
      return [];
    }

    const rows = await ctx.db
      .query("notificationItems")
      .withIndex("by_user_org", (q) =>
        q.eq("userId", userId).eq("organizationId", args.organizationId),
      )
      .order("desc")
      .take(MAX_FEED_ITEMS);

    // One access check per distinct project — the re-check that makes a revoked
    // grant silently drop out of the feed instead of leaking a task title.
    const projectNames = new Map<Id<"projects">, string | null>();
    const actors = new Map<Id<"users">, string>();
    const items = [];

    for (const row of rows) {
      if (!projectNames.has(row.projectId)) {
        const access = await getProjectAccess(ctx, userId, row.projectId);
        projectNames.set(row.projectId, access?.project.name ?? null);
      }
      const projectName = projectNames.get(row.projectId);
      if (projectName === null || projectName === undefined) {
        continue;
      }

      const task = await ctx.db.get(row.taskId);
      if (!task) {
        continue;
      }

      if (!actors.has(row.actorId)) {
        const actor = await ctx.db.get(row.actorId);
        actors.set(row.actorId, actor?.name ?? "Někdo");
      }

      items.push({
        _id: row._id,
        taskId: row.taskId,
        projectId: row.projectId,
        projectName,
        taskTitle: task.title,
        kind: row.kind,
        actorName: actors.get(row.actorId)!,
        count: row.count ?? 1,
        preview: row.commentId
          ? await commentPreview(ctx, row.commentId)
          : null,
        read: row.readAt !== undefined,
        createdAt: row._creationTime,
      });
    }
    return items;
  },
});

/**
 * The number on the bell. Counts the same rows `list` would show as unread —
 * including the per-project access re-check, so the badge can never say "3"
 * over a feed that shows nothing.
 */
export const unreadCount = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return 0;
    }
    if (!(await getOrgAccess(ctx, userId, args.organizationId))) {
      return 0;
    }

    const rows = await ctx.db
      .query("notificationItems")
      .withIndex("by_user_org_read", (q) =>
        q
          .eq("userId", userId)
          .eq("organizationId", args.organizationId)
          .eq("readAt", undefined),
      )
      .take(MAX_UNREAD_COUNT);

    const allowed = new Map<Id<"projects">, boolean>();
    let count = 0;
    for (const row of rows) {
      if (!allowed.has(row.projectId)) {
        allowed.set(
          row.projectId,
          (await getProjectAccess(ctx, userId, row.projectId)) !== null,
        );
      }
      if (allowed.get(row.projectId)) {
        count += 1;
      }
    }
    return count;
  },
});

/** The broom on the feed page. Personal, like everything in this file. */
export const markAllRead = mutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    await requireOrgAccess(ctx, userId, args.organizationId);

    const rows = await ctx.db
      .query("notificationItems")
      .withIndex("by_user_org_read", (q) =>
        q
          .eq("userId", userId)
          .eq("organizationId", args.organizationId)
          .eq("readAt", undefined),
      )
      .collect();
    const now = Date.now();
    await Promise.all(
      rows.map((row) => ctx.db.patch(row._id, { readAt: now })),
    );
  },
});

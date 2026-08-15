import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Shared validators — defined once here, imported by every function that reads
 * or writes these shapes, so the table and the mutation can never drift.
 */

/** Organization role. Two managers (`owner`, `admin`), one worker (`member`). */
export const organizationRoles = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("member"),
);

/**
 * Row visibility inside an organization.
 *
 * - `full`    — sees every project in the organization, including future ones.
 * - `limited` — sees only the projects listed for them in `projectMembers`.
 */
export const memberAccessLevels = v.union(
  v.literal("full"),
  v.literal("limited"),
);

/** Invite lifetime presets. Mapped to a concrete `expiresAt` server-side. */
export const inviteExpiryPresets = v.union(
  v.literal("6h"),
  v.literal("24h"),
  v.literal("48h"),
  v.literal("7d"),
  v.literal("30d"),
);

/**
 * Task status palette. A fixed set of color keys, never a raw CSS color — the
 * client maps each key to Tailwind classes in `src/lib/task-status-colors.ts`,
 * so both themes stay correct and no component hardcodes a color.
 */
export const taskStatusColors = v.union(
  v.literal("gray"),
  v.literal("blue"),
  v.literal("indigo"),
  v.literal("violet"),
  v.literal("amber"),
  v.literal("orange"),
  v.literal("red"),
  v.literal("green"),
  v.literal("teal"),
);

/**
 * What a status *means*, independent of its name.
 *
 * Every project is seeded with exactly one `todo`, one `in_progress` and one
 * `done` status. Those three are the core statuses: they can be renamed,
 * recolored and reordered, but never deleted, so "done" semantics (and later
 * completion counts) always have a column to point at. Everything a user adds
 * is `custom`.
 */
export const taskStatusKinds = v.union(
  v.literal("todo"),
  v.literal("in_progress"),
  v.literal("done"),
  v.literal("custom"),
);

/**
 * What a stored file is attached to. One `files` table serves three surfaces of
 * a task and the discriminator keeps them apart:
 *
 * - `attachment` — the "Přílohy" list on the task detail page.
 * - `content`    — an image or file dropped inside the description document.
 * - `comment`    — uploaded in the comment composer; carries `commentId` once
 *                  the comment it belongs to has been created.
 */
export const fileContexts = v.union(
  v.literal("attachment"),
  v.literal("content"),
  v.literal("comment"),
);

/**
 * Why somebody is being notified.
 *
 * - `task_created`    — a task was added to a project they can open.
 * - `task_assigned`   — they were made its `řešitel`.
 * - `comment_added`   — somebody wrote under a task **they are the řešitel of**.
 * - `comment_mention` — somebody `@`-mentioned them in a comment.
 *
 * They fall into two **categories**, `task` and `comment`, and that split is
 * load-bearing: the queue holds at most one row per person per task per
 * category, and a stronger kind replaces a weaker one inside its own category
 * only. Without it, a comment on a freshly created task would overwrite the
 * notification about the task itself.
 *
 * The client never supplies one of these: all four are written by the server
 * from inside the mutation that caused them.
 */
export const notificationKinds = v.union(
  v.literal("task_created"),
  v.literal("task_assigned"),
  v.literal("comment_added"),
  v.literal("comment_mention"),
);

/** Audited actions. The client never supplies one of these directly. */
export const activityTypes = v.union(
  v.literal("organization_created"),
  v.literal("organization_renamed"),
  v.literal("invite_created"),
  v.literal("invite_accepted"),
  v.literal("invite_revoked"),
  v.literal("member_role_changed"),
  v.literal("member_removed"),
  v.literal("project_created"),
  v.literal("project_renamed"),
  v.literal("project_archived"),
  v.literal("project_restored"),
  v.literal("task_created"),
  v.literal("task_status_changed"),
  v.literal("task_deleted"),
);

/**
 * App-level tables.
 *
 * Better Auth owns its own tables inside the `betterAuth` component; the `users`
 * table below is an app-owned mirror kept in sync by the triggers in
 * `convex/auth.ts`. Everything downstream (memberships, projects, tasks,
 * comments) references `Id<"users">`, never the Better Auth id.
 */
export default defineSchema({
  users: defineTable({
    // Better Auth user id (`_id` of the component's user document).
    authId: v.string(),
    name: v.string(),
    email: v.string(),
    image: v.optional(v.string()),
  })
    .index("by_auth_id", ["authId"])
    .index("by_email", ["email"]),

  organizations: defineTable({
    name: v.string(),
    createdBy: v.id("users"),
  }),

  organizationMembers: defineTable({
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    role: organizationRoles,
    access: memberAccessLevels,
  })
    .index("by_org", ["organizationId"])
    .index("by_user", ["userId"])
    .index("by_org_user", ["organizationId", "userId"]),

  /**
   * A project's icon is an uploaded raster image (`iconStorageId`), an SVG
   * (`iconSvg`) or an emoji (`emoji`) — never two at once. Setting one clears
   * the others server-side, so the renderer never has to invent a precedence
   * rule; with none of them, the project falls back to a colored tile with its
   * first letter.
   *
   * The SVG is markup on the document rather than a blob in storage: it is
   * served as a `data:` URI, which has no origin to run script in and cannot be
   * opened as a page. See `convex/lib/svg.ts`.
   */
  projects: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    iconStorageId: v.optional(v.id("_storage")),
    iconSvg: v.optional(v.string()),
    emoji: v.optional(v.string()),
    createdBy: v.id("users"),
    archived: v.optional(v.boolean()),
  })
    .index("by_org", ["organizationId"])
    .index("by_icon_storage", ["iconStorageId"]),

  /** An explicit project grant. Only `limited` members need one. */
  projectMembers: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    organizationId: v.id("organizations"),
  })
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"])
    .index("by_project_user", ["projectId", "userId"])
    .index("by_org_user", ["organizationId", "userId"]),

  /** `projectId` absent = organization-wide invite (grants `full` access). */
  invites: defineTable({
    organizationId: v.id("organizations"),
    projectId: v.optional(v.id("projects")),
    code: v.string(),
    createdBy: v.id("users"),
    expiresAt: v.number(),
    revoked: v.optional(v.boolean()),
    usedCount: v.number(),
    acceptedBy: v.optional(v.id("users")),
  })
    .index("by_code", ["code"])
    .index("by_org", ["organizationId"])
    .index("by_org_project", ["organizationId", "projectId"])
    .index("by_project", ["projectId"]),

  /**
   * The columns of a project's board. Seeded with three core statuses when the
   * project is created; members may add, rename, recolor and reorder more.
   * `order` is fractional-friendly but statuses are always renumbered in one
   * pass on reorder — there are few of them.
   */
  taskStatuses: defineTable({
    projectId: v.id("projects"),
    organizationId: v.id("organizations"),
    name: v.string(),
    color: taskStatusColors,
    order: v.number(),
    kind: taskStatusKinds,
  }).index("by_project", ["projectId"]),

  /**
   * `order` is the position inside the status column and is **fractional**: a
   * dropped card takes the midpoint between its two new neighbours, so a drag
   * writes one document. See `convex/lib/ordering.ts` for the renormalization
   * that runs when the gap between neighbours gets too small.
   */
  tasks: defineTable({
    projectId: v.id("projects"),
    organizationId: v.id("organizations"),
    title: v.string(),
    statusId: v.id("taskStatuses"),
    order: v.number(),
    createdBy: v.id("users"),
    assigneeId: v.optional(v.id("users")),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    // The workspace merges one recent page per visible project. Keeping the
    // activity timestamp in the index makes that read bounded even when a
    // board has years of finished work behind it.
    .index("by_project_updated_at", ["projectId", "updatedAt"])
    .index("by_status", ["statusId"])
    .index("by_project_assignee", ["projectId", "assigneeId"]),

  /**
   * The task body — one BlockNote document per task, stored as the serialized
   * JSON the editor round-trips. Exactly one row per task, upserted by
   * `taskContent.save`; a task with no row has an empty description.
   *
   * The shared task-content parser validates the default BlockNote schema's
   * structural envelope and resource bounds before this JSON text is stored.
   */
  taskContent: defineTable({
    taskId: v.id("tasks"),
    projectId: v.id("projects"),
    organizationId: v.id("organizations"),
    content: v.string(),
    updatedBy: v.id("users"),
    updatedAt: v.number(),
  }).index("by_task", ["taskId"]),

  /**
   * Blobs in Convex storage, always scoped to a task (and through it to a
   * project and an organization) — there is no generic "give me this storage
   * id" endpoint anywhere in the app.
   *
   * `context` says which surface the file belongs to; `commentId` is set when a
   * `comment` file is claimed by the comment that was posted with it, which is
   * also what stops the same upload being attached to two comments.
   */
  files: defineTable({
    taskId: v.id("tasks"),
    projectId: v.id("projects"),
    organizationId: v.id("organizations"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
    context: fileContexts,
    commentId: v.optional(v.id("comments")),
    uploadedBy: v.id("users"),
  })
    .index("by_task", ["taskId"])
    .index("by_task_context", ["taskId", "context"])
    // Convex appends `_creationTime` to every index, so this one is also the
    // oldest-first scan the orphan reaper (`convex/fileReaper.ts`) walks.
    .index("by_context", ["context"])
    .index("by_comment", ["commentId"])
    .index("by_storage", ["storageId"]),

  /**
   * A chat-like stream under every task.
   *
   * `body` is a serialized array of segments — `{type:"text",text}` and
   * `{type:"mention",userId,name}` — see `convex/lib/commentBody.ts`. Storing
   * segments instead of markdown means a mention stays a real reference to a
   * user id, so the notifications of a later phase can read them without
   * re-parsing prose. The denormalized `name` is only display copy for the
   * moment the comment was written.
   */
  comments: defineTable({
    taskId: v.id("tasks"),
    projectId: v.id("projects"),
    organizationId: v.id("organizations"),
    authorId: v.id("users"),
    body: v.string(),
    attachmentIds: v.optional(v.array(v.id("files"))),
    edited: v.optional(v.boolean()),
  }).index("by_task", ["taskId"]),

  /**
   * Emoji reactions attached to comments. One row represents one emoji on one
   * comment; `userIds` is both the membership set and the displayed count, so
   * fifty identical reactions never become fifty separate controls in the UI.
   */
  commentReactions: defineTable({
    taskId: v.id("tasks"),
    commentId: v.id("comments"),
    projectId: v.id("projects"),
    organizationId: v.id("organizations"),
    emoji: v.string(),
    userIds: v.array(v.id("users")),
  })
    .index("by_task", ["taskId"])
    .index("by_comment", ["commentId"])
    .index("by_comment_emoji", ["commentId", "emoji"]),

  activityLogs: defineTable({
    organizationId: v.id("organizations"),
    actorId: v.id("users"),
    type: activityTypes,
    targetId: v.optional(v.string()),
    meta: v.optional(v.any()),
  }).index("by_org", ["organizationId"]),

  /**
   * When one person last had one task open — the read state the unread badges
   * are computed against. **A missing row means "never opened"**, so a task
   * created by somebody else counts as new until its first visit, and every
   * comment on it counts as unread; nothing is backfilled.
   *
   * Upserted by `taskSeen.markSeen` while the task drawer is open. The badges
   * themselves are never stored: they are counted live from `comments` against
   * `lastSeenAt`, so there is no counter to drift.
   */
  taskSeen: defineTable({
    userId: v.id("users"),
    taskId: v.id("tasks"),
    projectId: v.id("projects"),
    organizationId: v.id("organizations"),
    lastSeenAt: v.number(),
  })
    .index("by_user_task", ["userId", "taskId"])
    .index("by_user_project", ["userId", "projectId"])
    .index("by_task", ["taskId"]),

  /**
   * The in-app notification feed — the bell, where `notificationEvents` is the
   * e-mail. Two tables on purpose: the e-mail queue is **drained** by the flush
   * (claim first, send second), while a feed item has to survive until the
   * person has actually seen it, and it must not care about the e-mail switch.
   *
   * Same collapsing rule as the queue: at most one row per person per task per
   * category (`task` / `comment`), the stronger kind wins and keeps its detail,
   * `count` carries how many comments the row stands for. A new event replaces
   * the row (delete + insert) so `_creationTime` is the burst's latest moment
   * and the feed sorts by it with no second timestamp.
   *
   * Nothing else is denormalized: the task title, project name and actor name
   * are read live by `notificationItems.list`, and access is re-checked there —
   * a feed is only a set of pointers.
   */
  notificationItems: defineTable({
    // The recipient, never the actor.
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    projectId: v.id("projects"),
    taskId: v.id("tasks"),
    kind: notificationKinds,
    actorId: v.id("users"),
    /** Comment rows only: the comment worth quoting — see `notificationEvents`. */
    commentId: v.optional(v.id("comments")),
    /** Comment rows only: how many comments this one row stands for. */
    count: v.optional(v.number()),
    /** Absent = unread. Set by `taskSeen.markSeen` and by `markAllRead`. */
    readAt: v.optional(v.number()),
  })
    // The feed, newest first.
    .index("by_user_org", ["userId", "organizationId"])
    // The badge on the bell: `readAt` absent sorts first, so unread rows are
    // one indexed range.
    .index("by_user_org_read", ["userId", "organizationId", "readAt"])
    // Opening a task marks its rows read.
    .index("by_user_task", ["userId", "taskId"])
    // Rows die with their task (`deleteTaskChildren`).
    .index("by_task", ["taskId"]),

  /**
   * The per-user notification switch.
   *
   * **A missing row means on.** That is what makes "on by default" free: no
   * backfill, and an account created tomorrow is already subscribed. Only
   * turning it off writes anything.
   */
  notificationSettings: defineTable({
    userId: v.id("users"),
    taskEmails: v.boolean(),
  }).index("by_user", ["userId"]),

  /**
   * One task waiting to go out to one person — the queue the digest is built
   * from. See `convex/lib/notifications.ts`.
   *
   * Nothing here is denormalized on purpose. The title and the project name are
   * read live when the batch is flushed, so a task renamed a minute after it was
   * quick-added arrives under its real name, and a task deleted inside the
   * window drops out of the e-mail instead of linking to nothing.
   */
  notificationEvents: defineTable({
    // The recipient, never the actor.
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    projectId: v.id("projects"),
    taskId: v.id("tasks"),
    kind: notificationKinds,
    actorId: v.id("users"),
    /**
     * Comment rows only: the comment worth quoting — the latest one, or the
     * one that mentioned this person, since a mention outranks the chatter
     * that followed it.
     */
    commentId: v.optional(v.id("comments")),
    /**
     * Comment rows only: how many comments have piled up on this task for this
     * person inside the window, so ten replies read as "10 komentářů" on one
     * line instead of ten lines.
     */
    count: v.optional(v.number()),
  })
    // Collecting one person's digest.
    .index("by_user", ["userId"])
    // Dropping pending events when the task itself is deleted, and finding the
    // row to upgrade when a task is created and then assigned inside one window.
    .index("by_task", ["taskId"]),

  /**
   * The open batching window of one person. Its existence is the whole point:
   * it is what stops the eighth task of a burst from scheduling an eighth
   * e-mail. `scheduledId` is the flush this window currently owns, so a later
   * event can cancel it and push the send further out.
   */
  notificationBatches: defineTable({
    userId: v.id("users"),
    scheduledId: v.id("_scheduled_functions"),
    /** When the window opened — the anchor the hard cap is measured from. */
    firstEventAt: v.number(),
    /** When the flush is currently due. */
    flushAt: v.number(),
  }).index("by_user", ["userId"]),

  /**
   * Cursors for bounded maintenance scans. A cursor is deleted after its scan
   * reaches the end, so the next scheduled run starts another complete pass.
   */
  maintenanceCursors: defineTable({
    key: v.string(),
    cursor: v.string(),
  }).index("by_key", ["key"]),
});

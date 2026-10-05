import { ConvexError, v } from "convex/values";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { getActiveApiToken, LAST_USED_GAP_MS } from "./lib/apiTokens";
import {
  getActorOrgAccess,
  isBot,
  listActorProjects,
  requireActorProjectAccess,
  requireActorTaskAccess,
  requireBotActor,
} from "./lib/bots";
import { createComment, MAX_COMMENTS } from "./lib/commentActions";
import { commentBodyText, parseCommentBody, serializeCommentBody } from "./lib/commentBody";
import { taskContentText } from "./lib/mcp/taskText";
import { byOrder } from "./lib/ordering";
import { listProjectMemberIds } from "./lib/projectMembers";
import { assignTask, createTask, moveTask, renameTask } from "./lib/taskActions";
import { parseTaskContent } from "./lib/taskContent";
import { listProjectStatuses } from "./lib/taskStatuses";

/**
 * What every MCP tool actually does — internal functions only, reached from
 * the HTTP action in `convex/mcp.ts` and from nowhere else.
 *
 * Each one takes the **hash** of the bearer token, never an actor id, and
 * resolves the acting bot itself inside its own transaction through
 * `requireBotActor`. So a revoked token stops working between two calls, and
 * nothing a client sends can name the actor. Writes go through the same
 * `convex/lib/taskActions.ts` / `commentActions.ts` the board uses, called
 * with the bot's id, after the owner's access was checked
 * (`requireActorProjectAccess`) — bot ∩ owner, never more.
 *
 * Ids arrive as plain strings from a language model, so they are normalized
 * rather than validated: a made-up id is a sentence the model can read, not an
 * argument-validation error.
 *
 * Errors are rethrown as `ConvexError` (`asToolError`) so the Czech message
 * crosses `runQuery` / `runMutation` intact and reaches the bot. Rethrowing
 * still aborts the transaction, so a refused write leaves nothing behind.
 */

/** A bot's search reads this many recent tasks per project. */
const SEARCH_SCAN_PER_PROJECT = 500;
const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;

/**
 * Is this a live token? Also records `lastUsedAt`, throttled. The HTTP action
 * calls it first and answers `401` on null, before any JSON-RPC is parsed.
 */
export const authenticate = internalMutation({
  args: { tokenHash: v.string() },
  handler: async (ctx, args) => {
    const token = await getActiveApiToken(ctx, args.tokenHash);
    if (!token) {
      return null;
    }
    const owner = await ctx.db.get(token.userId);
    if (!owner || isBot(owner)) {
      return null;
    }
    const now = Date.now();
    if (token.lastUsedAt === undefined || now - token.lastUsedAt >= LAST_USED_GAP_MS) {
      await ctx.db.patch(token._id, { lastUsedAt: now });
    }
    return { hasBot: token.botUserId !== undefined };
  },
});

export const listOrganizations = internalQuery({
  args: { tokenHash: v.string() },
  handler: (ctx, args) =>
    asToolError(async () => {
      const actor = await requireBotActor(ctx, args.tokenHash);
      const memberships = await ctx.db
        .query("organizationMembers")
        .withIndex("by_user", (q) => q.eq("userId", actor.botId))
        .collect();
      const rows = await Promise.all(
        memberships.map(async (membership) => {
          const access = await getActorOrgAccess(
            ctx,
            actor,
            membership.organizationId,
          );
          const organization = await ctx.db.get(membership.organizationId);
          if (!access || !organization) {
            return null;
          }
          return {
            organizationId: organization._id,
            name: organization.name,
            access: access.access,
          };
        }),
      );
      return {
        organizations: rows
          .filter((row): row is NonNullable<typeof row> => row !== null)
          .sort((a, b) => a.name.localeCompare(b.name, "cs")),
      };
    }),
});

export const listProjects = internalQuery({
  args: { tokenHash: v.string(), organizationId: v.string() },
  handler: (ctx, args) =>
    asToolError(async () => {
      const actor = await requireBotActor(ctx, args.tokenHash);
      const organizationId = requireId(ctx, "organizations", args.organizationId);
      if (!(await getActorOrgAccess(ctx, actor, organizationId))) {
        throw new Error("Nemáte přístup k této organizaci.");
      }
      const projects = await listActorProjects(ctx, actor, organizationId);
      return {
        projects: projects
          .map((project) => ({ projectId: project._id, name: project.name }))
          .sort((a, b) => a.name.localeCompare(b.name, "cs")),
      };
    }),
});

/** The board as data: its statuses in column order and every task on it. */
export const listTasks = internalQuery({
  args: { tokenHash: v.string(), projectId: v.string() },
  handler: (ctx, args) =>
    asToolError(async () => {
      const actor = await requireBotActor(ctx, args.tokenHash);
      const projectId = requireId(ctx, "projects", args.projectId);
      const { project } = await requireActorProjectAccess(ctx, actor, projectId);

      const [statuses, tasks] = await Promise.all([
        listProjectStatuses(ctx, projectId),
        ctx.db
          .query("tasks")
          .withIndex("by_project", (q) => q.eq("projectId", projectId))
          .collect(),
      ]);
      const statusIndex = new Map(statuses.map((status, index) => [status._id, index]));
      const people = await loadPeople(ctx, tasks.map((task) => task.assigneeId));

      tasks.sort(
        (a, b) =>
          (statusIndex.get(a.statusId) ?? Number.MAX_SAFE_INTEGER) -
            (statusIndex.get(b.statusId) ?? Number.MAX_SAFE_INTEGER) ||
          byOrder(a, b),
      );
      const statusName = new Map(statuses.map((status) => [status._id, status.name]));
      return {
        project: { projectId: project._id, name: project.name },
        statuses: statuses.map((status) => ({
          statusId: status._id,
          name: status.name,
          kind: status.kind,
        })),
        tasks: tasks.map((task) => ({
          taskId: task._id,
          title: task.title,
          statusId: task.statusId,
          status: statusName.get(task.statusId) ?? null,
          assignee: task.assigneeId ? (people.get(task.assigneeId) ?? null) : null,
          updatedAt: task.updatedAt,
        })),
      };
    }),
});

export const getTask = internalQuery({
  args: {
    tokenHash: v.string(),
    taskId: v.string(),
    includeComments: v.optional(v.boolean()),
  },
  handler: (ctx, args) =>
    asToolError(async () => {
      const actor = await requireBotActor(ctx, args.tokenHash);
      const taskId = requireId(ctx, "tasks", args.taskId);
      const { task, access } = await requireActorTaskAccess(ctx, actor, taskId);

      const [status, content, people] = await Promise.all([
        ctx.db.get(task.statusId),
        ctx.db
          .query("taskContent")
          .withIndex("by_task", (q) => q.eq("taskId", task._id))
          .unique(),
        loadPeople(ctx, [task.assigneeId, task.createdBy]),
      ]);
      const blocks = content ? parseTaskContent(content.content) : null;

      return {
        taskId: task._id,
        title: task.title,
        project: { projectId: access.project._id, name: access.project.name },
        organizationId: task.organizationId,
        status: status
          ? { statusId: status._id, name: status.name, kind: status.kind }
          : null,
        assignee: task.assigneeId ? (people.get(task.assigneeId) ?? null) : null,
        createdBy: people.get(task.createdBy) ?? null,
        createdAt: task._creationTime,
        updatedAt: task.updatedAt,
        description: blocks ? taskContentText(blocks) : "",
        comments: args.includeComments ? await commentRows(ctx, task._id) : undefined,
      };
    }),
});

/** Who a task in this project can be assigned to, or mention. */
export const listMembers = internalQuery({
  args: { tokenHash: v.string(), projectId: v.string() },
  handler: (ctx, args) =>
    asToolError(async () => {
      const actor = await requireBotActor(ctx, args.tokenHash);
      const projectId = requireId(ctx, "projects", args.projectId);
      const { project } = await requireActorProjectAccess(ctx, actor, projectId);
      const memberIds = await listProjectMemberIds(
        ctx,
        project._id,
        project.organizationId,
      );
      const people = await loadPeople(ctx, [...memberIds]);
      return {
        members: [...people.values()].sort((a, b) =>
          a.name.localeCompare(b.name, "cs"),
        ),
      };
    }),
});

export const listComments = internalQuery({
  args: { tokenHash: v.string(), taskId: v.string() },
  handler: (ctx, args) =>
    asToolError(async () => {
      const actor = await requireBotActor(ctx, args.tokenHash);
      const taskId = requireId(ctx, "tasks", args.taskId);
      await requireActorTaskAccess(ctx, actor, taskId);
      return { comments: await commentRows(ctx, taskId) };
    }),
});

/**
 * Title search across everything the bot can open. Bounded the way the
 * workspace inbox is: one indexed page of the most recently touched tasks per
 * project, so a board with years of history cannot turn one search into a
 * table scan. Old, untouched work past that page is not found — say so in the
 * tool description rather than pretend otherwise.
 */
export const search = internalQuery({
  args: {
    tokenHash: v.string(),
    query: v.string(),
    organizationId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: (ctx, args) =>
    asToolError(async () => {
      const actor = await requireBotActor(ctx, args.tokenHash);
      const needle = args.query.trim().toLocaleLowerCase("cs");
      if (needle.length < 2) {
        throw new Error("Hledaný text musí mít aspoň 2 znaky.");
      }
      const requested =
        args.limit !== undefined && Number.isFinite(args.limit)
          ? Math.floor(args.limit)
          : DEFAULT_SEARCH_LIMIT;
      const limit = Math.min(Math.max(requested, 1), MAX_SEARCH_LIMIT);

      const organizationIds = args.organizationId
        ? [requireId(ctx, "organizations", args.organizationId)]
        : (
            await ctx.db
              .query("organizationMembers")
              .withIndex("by_user", (q) => q.eq("userId", actor.botId))
              .collect()
          ).map((membership) => membership.organizationId);

      const projects = (
        await Promise.all(
          organizationIds.map((organizationId) =>
            listActorProjects(ctx, actor, organizationId),
          ),
        )
      ).flat();
      const pages = await Promise.all(
        projects.map((project) =>
          ctx.db
            .query("tasks")
            .withIndex("by_project_updated_at", (q) => q.eq("projectId", project._id))
            .order("desc")
            .take(SEARCH_SCAN_PER_PROJECT),
        ),
      );
      const projectName = new Map(projects.map((project) => [project._id, project.name]));
      const matches = pages
        .flat()
        .filter((task) => task.title.toLocaleLowerCase("cs").includes(needle))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, limit);

      return {
        tasks: matches.map((task) => ({
          taskId: task._id,
          title: task.title,
          projectId: task.projectId,
          project: projectName.get(task.projectId) ?? null,
          organizationId: task.organizationId,
          updatedAt: task.updatedAt,
        })),
      };
    }),
});

/** Without `statusId` the task lands in the project's core To-do column. */
export const createTaskTool = internalMutation({
  args: {
    tokenHash: v.string(),
    projectId: v.string(),
    title: v.string(),
    statusId: v.optional(v.string()),
  },
  handler: (ctx, args) =>
    asToolError(async () => {
      const actor = await requireBotActor(ctx, args.tokenHash);
      const projectId = requireId(ctx, "projects", args.projectId);
      await requireActorProjectAccess(ctx, actor, projectId);
      const statusId = args.statusId
        ? requireId(ctx, "taskStatuses", args.statusId)
        : await defaultStatusId(ctx, projectId);

      const taskId = await createTask(ctx, actor.botId, {
        projectId,
        statusId,
        title: args.title,
      });
      return await taskSummary(ctx, taskId);
    }),
});

/** Title and/or řešitel in one call. `assigneeId: null` unassigns. */
export const updateTaskTool = internalMutation({
  args: {
    tokenHash: v.string(),
    taskId: v.string(),
    title: v.optional(v.string()),
    assigneeId: v.optional(v.union(v.string(), v.null())),
  },
  handler: (ctx, args) =>
    asToolError(async () => {
      const actor = await requireBotActor(ctx, args.tokenHash);
      const taskId = requireId(ctx, "tasks", args.taskId);
      await requireActorTaskAccess(ctx, actor, taskId);
      if (args.title === undefined && args.assigneeId === undefined) {
        throw new Error("Zadejte title nebo assigneeId.");
      }
      if (args.title !== undefined) {
        await renameTask(ctx, actor.botId, { taskId, title: args.title });
      }
      if (args.assigneeId !== undefined) {
        await assignTask(ctx, actor.botId, {
          taskId,
          assigneeId: optionalUserId(ctx, args.assigneeId),
        });
      }
      return await taskSummary(ctx, taskId);
    }),
});

export const assignTaskTool = internalMutation({
  args: {
    tokenHash: v.string(),
    taskId: v.string(),
    assigneeId: v.union(v.string(), v.null()),
  },
  handler: (ctx, args) =>
    asToolError(async () => {
      const actor = await requireBotActor(ctx, args.tokenHash);
      const taskId = requireId(ctx, "tasks", args.taskId);
      await requireActorTaskAccess(ctx, actor, taskId);
      await assignTask(ctx, actor.botId, {
        taskId,
        assigneeId: optionalUserId(ctx, args.assigneeId),
      });
      return await taskSummary(ctx, taskId);
    }),
});

/** Same neighbour-based placement as a drag; no neighbours = end of the column. */
export const moveTaskTool = internalMutation({
  args: {
    tokenHash: v.string(),
    taskId: v.string(),
    statusId: v.string(),
    previousTaskId: v.optional(v.string()),
    nextTaskId: v.optional(v.string()),
  },
  handler: (ctx, args) =>
    asToolError(async () => {
      const actor = await requireBotActor(ctx, args.tokenHash);
      const taskId = requireId(ctx, "tasks", args.taskId);
      await requireActorTaskAccess(ctx, actor, taskId);
      await moveTask(ctx, actor.botId, {
        taskId,
        statusId: requireId(ctx, "taskStatuses", args.statusId),
        previousTaskId: args.previousTaskId
          ? requireId(ctx, "tasks", args.previousTaskId)
          : undefined,
        nextTaskId: args.nextTaskId
          ? requireId(ctx, "tasks", args.nextTaskId)
          : undefined,
      });
      return await taskSummary(ctx, taskId);
    }),
});

/**
 * Plain text only: one text segment, no mentions. A mention is a user id the
 * composer picked from a list; a model typing "@Jana" is prose, and turning
 * prose into ids by guessing names is how the wrong Jana gets notified.
 */
export const addComment = internalMutation({
  args: { tokenHash: v.string(), taskId: v.string(), text: v.string() },
  handler: (ctx, args) =>
    asToolError(async () => {
      const actor = await requireBotActor(ctx, args.tokenHash);
      const taskId = requireId(ctx, "tasks", args.taskId);
      await requireActorTaskAccess(ctx, actor, taskId);
      const commentId = await createComment(ctx, actor.botId, {
        taskId,
        body: serializeCommentBody([{ type: "text", text: args.text }]),
      });
      return { commentId, taskId };
    }),
});

/**
 * Run a tool body and turn whatever it throws into a `ConvexError` carrying
 * the message, so the bot reads the same Czech sentence a person would see
 * in a toast. Rethrowing — never returning — keeps the transaction aborted.
 */
async function asToolError<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ConvexError) {
      throw error;
    }
    throw new ConvexError(
      error instanceof Error ? error.message : "Akce se nepovedla.",
    );
  }
}

function requireId<Table extends TableNames>(
  ctx: QueryCtx | MutationCtx,
  table: Table,
  value: string,
): Id<Table> {
  const id = ctx.db.normalizeId(table, value);
  if (!id) {
    throw new Error(`Neplatné id: ${value.slice(0, 64)}`);
  }
  return id;
}

function optionalUserId(
  ctx: MutationCtx,
  value: string | null,
): Id<"users"> | undefined {
  return value === null ? undefined : requireId(ctx, "users", value);
}

async function defaultStatusId(
  ctx: MutationCtx,
  projectId: Id<"projects">,
): Promise<Id<"taskStatuses">> {
  const statuses = await listProjectStatuses(ctx, projectId);
  const status = statuses.find((row) => row.kind === "todo") ?? statuses[0];
  if (!status) {
    throw new Error("Projekt nemá žádný stav.");
  }
  return status._id;
}

async function taskSummary(ctx: MutationCtx, taskId: Id<"tasks">) {
  const task = await ctx.db.get(taskId);
  if (!task) {
    throw new Error("Tento úkol už neexistuje.");
  }
  const [status, people] = await Promise.all([
    ctx.db.get(task.statusId),
    loadPeople(ctx, [task.assigneeId]),
  ]);
  return {
    taskId: task._id,
    title: task.title,
    projectId: task.projectId,
    status: status
      ? { statusId: status._id, name: status.name, kind: status.kind }
      : null,
    assignee: task.assigneeId ? (people.get(task.assigneeId) ?? null) : null,
    updatedAt: task.updatedAt,
  };
}

async function commentRows(ctx: QueryCtx, taskId: Id<"tasks">) {
  const comments = await ctx.db
    .query("comments")
    .withIndex("by_task", (q) => q.eq("taskId", taskId))
    .take(MAX_COMMENTS);
  comments.sort((a, b) => a._creationTime - b._creationTime);
  const people = await loadPeople(ctx, comments.map((comment) => comment.authorId));
  return comments.map((comment) => {
    const segments = parseCommentBody(comment.body);
    return {
      commentId: comment._id,
      author: people.get(comment.authorId) ?? null,
      text: segments ? commentBodyText(segments) : "",
      createdAt: comment._creationTime,
      edited: comment.edited === true,
      attachments: comment.attachmentIds?.length ?? 0,
    };
  });
}

type Person = { userId: Id<"users">; name: string; isBot: boolean };

async function loadPeople(
  ctx: QueryCtx | MutationCtx,
  ids: (Id<"users"> | undefined)[],
): Promise<Map<Id<"users">, Person>> {
  const distinct = [...new Set(ids.filter((id): id is Id<"users"> => !!id))];
  const users = await Promise.all(distinct.map((id) => ctx.db.get(id)));
  const people = new Map<Id<"users">, Person>();
  for (const user of users.filter((row): row is Doc<"users"> => row !== null)) {
    people.set(user._id, { userId: user._id, name: user.name, isBot: isBot(user) });
  }
  return people;
}

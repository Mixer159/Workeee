import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { listVisibleProjects } from "./lib/access";
import { getAuthUserId } from "./lib/auth";
import { commentBodyPreview } from "./lib/notifications";
import { svgDataUrl } from "./lib/svg";

/** A useful first page without letting one live query grow with the database. */
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

/**
 * The central workspace inbox: recent tasks from every project the caller may
 * open, newest activity first.
 *
 * Each project is read through `by_project_updated_at` and contributes at most
 * `limit + 1` rows. Merging those bounded pages is enough to find the global
 * first page: a task below that rank inside its own project cannot enter the
 * global first `limit` either.
 */
export const listTasks = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { items: [], projects: [], hasMore: false };
    }

    const projects = await listWorkspaceProjects(ctx, userId);
    if (projects.length === 0) {
      return { items: [], projects: [], hasMore: false };
    }

    const limit = normalizeLimit(args.limit);
    const [pages, iconUrls, organizationNames] = await Promise.all([
      Promise.all(
        projects.map((project) =>
          ctx.db
            .query("tasks")
            .withIndex("by_project_updated_at", (q) =>
              q.eq("projectId", project._id),
            )
            .order("desc")
            .take(limit + 1),
        ),
      ),
      loadProjectIconUrls(ctx, projects),
      loadOrganizationNames(ctx, projects),
    ]);
    const candidates = pages
      .flat()
      .sort(
        (a, b) =>
          b.updatedAt - a.updatedAt || b._creationTime - a._creationTime,
      );
    const tasks = candidates.slice(0, limit);

    const projectById = new Map(
      projects.map((project) => [project._id, project]),
    );
    const [statuses, people, latestComments] = await Promise.all([
      loadStatuses(ctx, tasks),
      loadPeople(ctx, tasks),
      Promise.all(
        tasks.map((task) =>
          ctx.db
            .query("comments")
            .withIndex("by_task", (q) => q.eq("taskId", task._id))
            .order("desc")
            .first(),
        ),
      ),
    ]);

    const commentAuthors = await loadCommentAuthors(ctx, latestComments);
    const projectOptions = projects
      .map((project) => ({
        _id: project._id,
        name: project.name,
        emoji: project.emoji ?? null,
        iconUrl: iconUrls.get(project._id) ?? null,
        organizationName:
          organizationNames.get(project.organizationId) ??
          "Neznámá organizace",
      }))
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name, "cs") ||
          a.organizationName.localeCompare(b.organizationName, "cs"),
      );

    return {
      items: tasks.map((task, index) => {
        const project = projectById.get(task.projectId);
        const status = statuses.get(task.statusId);
        const latestComment = latestComments[index];
        return {
          _id: task._id,
          title: task.title,
          updatedAt: task.updatedAt,
          project: {
            _id: task.projectId,
            name: project?.name ?? "Neznámý projekt",
            emoji: project?.emoji ?? null,
            iconUrl: iconUrls.get(task.projectId) ?? null,
          },
          status: status
            ? {
                _id: status._id,
                name: status.name,
                color: status.color,
                kind: status.kind,
              }
            : null,
          assignee: task.assigneeId
            ? (people.get(task.assigneeId) ?? null)
            : null,
          latestComment: latestComment
            ? {
                authorName:
                  commentAuthors.get(latestComment.authorId)?.name ??
                  "Neznámý uživatel",
                preview: commentBodyPreview(latestComment.body),
              }
            : null,
        };
      }),
      projects: projectOptions,
      hasMore: limit < MAX_LIMIT && candidates.length > limit,
    };
  },
});

/** Every non-archived project the user may open, across all memberships. */
async function listWorkspaceProjects(
  ctx: QueryCtx,
  userId: Id<"users">,
): Promise<Doc<"projects">[]> {
  const memberships = await ctx.db
    .query("organizationMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  const organizationIds = [
    ...new Set(memberships.map((membership) => membership.organizationId)),
  ];
  const pages = await Promise.all(
    organizationIds.map((organizationId) =>
      listVisibleProjects(ctx, userId, organizationId),
    ),
  );
  return pages.flat();
}

async function loadOrganizationNames(
  ctx: QueryCtx,
  projects: Doc<"projects">[],
) {
  const ids = [...new Set(projects.map((project) => project.organizationId))];
  const rows = await Promise.all(ids.map((id) => ctx.db.get(id)));
  const names = new Map<Id<"organizations">, string>();
  for (const row of rows) {
    if (row) {
      names.set(row._id, row.name);
    }
  }
  return names;
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.max(Math.floor(limit), 1), MAX_LIMIT);
}

async function loadStatuses(ctx: QueryCtx, tasks: Doc<"tasks">[]) {
  const ids = [...new Set(tasks.map((task) => task.statusId))];
  const rows = await Promise.all(ids.map((id) => ctx.db.get(id)));
  const statuses = new Map<Id<"taskStatuses">, Doc<"taskStatuses">>();
  for (const row of rows) {
    if (row) {
      statuses.set(row._id, row);
    }
  }
  return statuses;
}

type Person = {
  _id: Id<"users">;
  name: string;
  image: string | undefined;
};

async function loadPeople(ctx: QueryCtx, tasks: Doc<"tasks">[]) {
  const ids = [
    ...new Set(
      tasks
        .map((task) => task.assigneeId)
        .filter((id): id is Id<"users"> => id !== undefined),
    ),
  ];
  const rows = await Promise.all(ids.map((id) => ctx.db.get(id)));
  const people = new Map<Id<"users">, Person>();
  for (const row of rows) {
    if (row) {
      people.set(row._id, { _id: row._id, name: row.name, image: row.image });
    }
  }
  return people;
}

async function loadCommentAuthors(
  ctx: QueryCtx,
  comments: (Doc<"comments"> | null)[],
) {
  const ids = [
    ...new Set(
      comments
        .map((comment) => comment?.authorId)
        .filter((id): id is Id<"users"> => id !== undefined),
    ),
  ];
  const rows = await Promise.all(ids.map((id) => ctx.db.get(id)));
  const people = new Map<Id<"users">, Person>();
  for (const row of rows) {
    if (row) {
      people.set(row._id, { _id: row._id, name: row.name, image: row.image });
    }
  }
  return people;
}

async function loadProjectIconUrls(
  ctx: QueryCtx,
  projects: Doc<"projects">[],
) {
  const rows = await Promise.all(
    projects.map(async (project) => {
      if (project.iconStorageId) {
        return [
          project._id,
          await ctx.storage.getUrl(project.iconStorageId),
        ] as const;
      }
      return [
        project._id,
        project.iconSvg ? svgDataUrl(project.iconSvg) : null,
      ] as const;
    }),
  );
  return new Map(rows);
}

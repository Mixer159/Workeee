import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { listProjectMemberIds } from "./projectMembers";

type Ctx = QueryCtx | MutationCtx;

/**
 * Hidden tasks.
 *
 * A task is visible to everybody who can open its project, unless somebody is
 * listed in `tasks.hiddenFrom`. For them the task **does not exist**: every
 * read skips it, every mutation refuses it with the same sentence as a deleted
 * task ("Tento úkol už neexistuje."), and no notification about it reaches
 * them — neither the feed nor an e-mail. Nothing tells a hidden person that
 * there is something they cannot see.
 *
 * The rule is enforced at three layers, and each would be enough alone:
 *
 * 1. **Reads.** `getTaskAccess` / `requireTaskAccess` (`./tasks.ts`) and the
 *    bot's `requireActorTaskAccess` refuse a hidden task, and every list that
 *    reads tasks by index filters through `isTaskHiddenFrom`.
 * 2. **Audiences.** Nobody hidden can be made řešitel or be `@`-mentioned
 *    (`isTaskHiddenFromUser` in `assignTask`, `effectiveHiddenIds` in
 *    `validateCommentBody`), and both notification writers skip a hidden
 *    recipient. Hiding someone deletes whatever was already queued or shown to
 *    them about the task.
 * 3. **Send time.** `claimDigest` re-reads the task and drops it when the
 *    recipient is hidden, so even a row that slipped past the first two never
 *    becomes an e-mail.
 */

/** Hidden from more people than this, a task wants a project of its own. */
export const MAX_HIDDEN_PER_TASK = 100;

/** A bot's owner has at most this many — `MAX_BOTS_PER_OWNER` in `./bots.ts`. */
const MAX_OWNED_BOTS_READ = 11;

/**
 * Is `task` hidden from `userId`? Pure, and the one predicate every read goes
 * through. A session user is always a human (`getAuthUser` refuses bots), so
 * this is the whole check for them; a bot actor checks itself and its owner.
 */
export function isTaskHiddenFrom(
  task: Pick<Doc<"tasks">, "hiddenFrom">,
  userId: Id<"users">,
): boolean {
  return task.hiddenFrom?.includes(userId) ?? false;
}

/**
 * Everybody `hiddenFrom` hides the task from, bots included: a bot acts with
 * bot ∩ owner access, so a task hidden from a person is hidden from every bot
 * that person owns. One indexed read per hidden person.
 */
export async function effectiveHiddenIds(
  ctx: Ctx,
  hiddenFrom: readonly Id<"users">[] | undefined,
): Promise<Set<Id<"users">>> {
  const hidden = new Set(hiddenFrom ?? []);
  const owned = await Promise.all(
    [...hidden].map((ownerId) =>
      ctx.db
        .query("users")
        .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
        .take(MAX_OWNED_BOTS_READ),
    ),
  );
  for (const bots of owned) {
    for (const bot of bots) {
      if (bot.kind === "bot") {
        hidden.add(bot._id);
      }
    }
  }
  return hidden;
}

/**
 * Is the task hidden from `userId`, directly or — for a bot — through its
 * owner? For checking one person (a new řešitel) without reading the project.
 */
export async function isTaskHiddenFromUser(
  ctx: Ctx,
  task: Pick<Doc<"tasks">, "hiddenFrom">,
  userId: Id<"users">,
): Promise<boolean> {
  if (isTaskHiddenFrom(task, userId)) {
    return true;
  }
  if (!task.hiddenFrom || task.hiddenFrom.length === 0) {
    return false;
  }
  const user = await ctx.db.get(userId);
  return (
    user?.kind === "bot" &&
    user.ownerId !== undefined &&
    isTaskHiddenFrom(task, user.ownerId)
  );
}

/**
 * The hidden list a new task starts with, checked: only people who can open
 * the project, never the author (nor, through a bot, its owner), at most
 * `MAX_HIDDEN_PER_TASK`. Returns `undefined` for "visible to everybody", which
 * is what the field stores for it.
 */
export async function checkInitialHiddenFrom(
  ctx: Ctx,
  args: {
    projectId: Id<"projects">;
    organizationId: Id<"organizations">;
    authorId: Id<"users">;
    requested: readonly Id<"users">[] | undefined;
  },
): Promise<Id<"users">[] | undefined> {
  const requested = [...new Set(args.requested ?? [])];
  if (requested.length === 0) {
    return undefined;
  }
  if (requested.length > MAX_HIDDEN_PER_TASK) {
    throw new Error(
      `Úkol jde skrýt nejvýš před ${MAX_HIDDEN_PER_TASK} lidmi.`,
    );
  }
  const members = await listProjectMemberIds(
    ctx,
    args.projectId,
    args.organizationId,
  );
  for (const userId of requested) {
    if (!members.has(userId)) {
      throw new Error("Tento člověk nemá přístup k projektu.");
    }
  }
  if ((await effectiveHiddenIds(ctx, requested)).has(args.authorId)) {
    throw new Error("Sami před sebou úkol skrýt nemůžete.");
  }
  return requested;
}

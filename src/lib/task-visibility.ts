import type { Id } from "@convex/_generated/dataModel";
import { plural } from "@convex/lib/plural";

/**
 * The client's mirror of the hidden-task rules in
 * `convex/lib/taskVisibility.ts` and `setTaskHiddenFrom`. The server decides;
 * this only keeps the pickers from offering what it would refuse: the
 * řešitel select and the mention picker leave hidden people out, and the
 * "Skrýt před" menu locks the people who can never be hidden.
 */

/** A row of `projects.assignableMembers`. `ownerId` is set for bots only. */
export type VisibilityMember = {
  _id: Id<"users">;
  name: string;
  image?: string;
  ownerId: Id<"users"> | null;
};

/**
 * Why a member cannot be toggled: they are the person looking (`you`), the
 * author, the řešitel, the owner of an author or řešitel bot (hiding them
 * would hide the bot), or a bot hidden because its owner is (`owner`).
 */
export type HideLock =
  | "you"
  | "author"
  | "assignee"
  | "authorOwner"
  | "assigneeOwner"
  | "owner";

export type HideOption<Member extends VisibilityMember> = {
  member: Member;
  hidden: boolean;
  lock: HideLock | null;
};

export const HIDE_LOCK_LABELS: Record<HideLock, string> = {
  you: "vy",
  author: "autor",
  assignee: "řešitel",
  authorOwner: "vlastník autora",
  assigneeOwner: "vlastník řešitele",
  owner: "s vlastníkem",
};

/** Hidden directly, or — for a bot — through its owner (bot ∩ owner). */
function isHidden(
  member: VisibilityMember,
  hidden: ReadonlySet<Id<"users">>,
): boolean {
  return (
    hidden.has(member._id) ||
    (member.ownerId !== null && hidden.has(member.ownerId))
  );
}

/** The members the task is not hidden from: řešitel and mention candidates. */
export function membersWhoSee<Member extends VisibilityMember>(
  members: readonly Member[],
  hiddenFrom: readonly Id<"users">[],
): Member[] {
  const hidden = new Set(hiddenFrom);
  return members.filter((member) => !isHidden(member, hidden));
}

/** One row per member for the "Skrýt před" menu, in the members' order. */
export function hideOptions<Member extends VisibilityMember>(
  members: readonly Member[],
  hiddenFrom: readonly Id<"users">[],
  roles: {
    viewerId?: Id<"users">;
    authorId?: Id<"users">;
    assigneeId?: Id<"users">;
  },
): HideOption<Member>[] {
  const hidden = new Set(hiddenFrom);
  const ownerOf = (userId: Id<"users"> | undefined) =>
    members.find((member) => member._id === userId)?.ownerId ?? null;
  const authorOwner = ownerOf(roles.authorId);
  const assigneeOwner = ownerOf(roles.assigneeId);
  return members.map((member) => {
    const ownerHidden = member.ownerId !== null && hidden.has(member.ownerId);
    const lock: HideLock | null =
      member._id === roles.viewerId
        ? "you"
        : member._id === roles.authorId
          ? "author"
          : member._id === roles.assigneeId
            ? "assignee"
            : member._id === authorOwner
              ? "authorOwner"
              : member._id === assigneeOwner
                ? "assigneeOwner"
                : ownerHidden
                  ? "owner"
                  : null;
    return { member, hidden: isHidden(member, hidden), lock };
  });
}

/** What the trigger says: who the task is visible to, in one short line. */
export function hiddenSummary(hiddenCount: number): string {
  if (hiddenCount === 0) {
    return "Všichni v projektu";
  }
  return `Skryto před ${hiddenCount} ${plural(hiddenCount, "člověkem", "lidmi", "lidmi")}`;
}

/** Toggle one id in a staged list (a task that does not exist yet). */
export function toggleHidden(
  hiddenFrom: readonly Id<"users">[],
  userId: Id<"users">,
  hidden: boolean,
): Id<"users">[] {
  const without = hiddenFrom.filter((id) => id !== userId);
  return hidden ? [...without, userId] : without;
}

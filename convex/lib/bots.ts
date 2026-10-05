import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  getOrgAccess,
  getProjectAccess,
  listVisibleProjects,
  type OrgAccess,
  type ProjectAccess,
} from "./access";
import { getActiveApiToken } from "./apiTokens";
import type { TaskAccess } from "./tasks";
import { normalizeUserName } from "./validation";

type Ctx = QueryCtx | MutationCtx;

/**
 * Bots: first-class members that act through the MCP endpoint.
 *
 * A bot is a `users` row with `kind: "bot"` and an `ownerId`. It joins an
 * organization like anybody else (a manager who owns it adds it), and from then
 * on it is a řešitel, a comment author and a name in the members list — never a
 * silent "act as the human".
 *
 * **The rule this module exists for:** a call authenticated with a human's
 * token may only act as a bot that human owns, and it may only do what **both**
 * of them may do. The bot's own membership goes through the ordinary gates in
 * `./access.ts` (the shared task and comment actions are called with the bot's
 * id), and the owner's access to the same project is checked here first. So a
 * bot without a membership cannot see an organization even when its owner can,
 * and a bot whose owner was removed loses the organization with them.
 */

/** A human with more bots than this is running a fleet, not a team. */
export const MAX_BOTS_PER_OWNER = 10;

/** Long enough for any CDN avatar URL; short enough to ride in every list. */
const MAX_AVATAR_URL_LENGTH = 2048;

export type BotActor = {
  tokenId: Id<"apiTokens">;
  ownerId: Id<"users">;
  botId: Id<"users">;
};

export function isBot(user: Pick<Doc<"users">, "kind"> | null): boolean {
  return user?.kind === "bot";
}

/** True for a bot id. Used to keep bots out of every notification channel. */
export async function isBotUser(
  ctx: Ctx,
  userId: Id<"users">,
): Promise<boolean> {
  return isBot(await ctx.db.get(userId));
}

/** The bots `ownerId` has created, oldest first. */
export async function listOwnedBots(
  ctx: Ctx,
  ownerId: Id<"users">,
): Promise<Doc<"users">[]> {
  const bots = await ctx.db
    .query("users")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .take(MAX_BOTS_PER_OWNER + 1);
  return bots.filter((user) => isBot(user));
}

/**
 * A pushed avatar URL, or undefined for none. `https:` only: the value ends up
 * in an `<img src>` on every colleague's screen, and anything else — `data:`,
 * `javascript:`, plain `http:` on an `https` page — is either a vector or a
 * broken image. Credentials in the URL are refused rather than stored.
 */
export function normalizeAvatarUrl(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.length > MAX_AVATAR_URL_LENGTH) {
    throw new Error("Adresa avataru je příliš dlouhá.");
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Adresa avataru není platná URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Avatar musí být na adrese https://.");
  }
  return url.toString();
}

export function normalizeBotName(value: string): string {
  return normalizeUserName(value);
}

/**
 * The token's owner — a live token, minted by a human who still exists.
 * Everything a token does starts here.
 */
export async function requireTokenOwner(
  ctx: Ctx,
  tokenHash: string,
): Promise<{ token: Doc<"apiTokens">; owner: Doc<"users"> }> {
  const token = await getActiveApiToken(ctx, tokenHash);
  if (!token) {
    throw new Error("Neplatný nebo zrušený API token.");
  }
  const owner = await ctx.db.get(token.userId);
  if (!owner || isBot(owner)) {
    throw new Error("Neplatný nebo zrušený API token.");
  }
  return { token, owner };
}

/**
 * The bot a token acts as. A token that has not synced an identity yet has no
 * bot, and every tool but `sync_bot_identity` refuses it — there is nobody to
 * act as. The ownership check is repeated on every call: a bot row that was
 * somehow re-owned would otherwise keep answering to the old owner's token.
 */
export async function requireBotActor(
  ctx: Ctx,
  tokenHash: string,
): Promise<BotActor> {
  const { token, owner } = await requireTokenOwner(ctx, tokenHash);
  if (!token.botUserId) {
    throw new Error(
      "Token zatím nemá bota. Nejdřív zavolejte sync_bot_identity.",
    );
  }
  const bot = await ctx.db.get(token.botUserId);
  if (!bot || !isBot(bot) || bot.ownerId !== owner._id) {
    throw new Error("Tento bot k tokenu nepatří.");
  }
  return { tokenId: token._id, ownerId: owner._id, botId: bot._id };
}

/**
 * The bot's membership in an organization, or null — null as well when its
 * owner is no longer a member there. Queries fail soft on it.
 */
export async function getActorOrgAccess(
  ctx: Ctx,
  actor: BotActor,
  organizationId: Id<"organizations">,
): Promise<OrgAccess | null> {
  const owner = await getOrgAccess(ctx, actor.ownerId, organizationId);
  if (!owner) {
    return null;
  }
  return await getOrgAccess(ctx, actor.botId, organizationId);
}

/** Project access for the bot, intersected with its owner's. */
export async function getActorProjectAccess(
  ctx: Ctx,
  actor: BotActor,
  projectId: Id<"projects">,
): Promise<ProjectAccess | null> {
  const owner = await getProjectAccess(ctx, actor.ownerId, projectId);
  if (!owner) {
    return null;
  }
  return await getProjectAccess(ctx, actor.botId, projectId);
}

export async function requireActorProjectAccess(
  ctx: Ctx,
  actor: BotActor,
  projectId: Id<"projects">,
): Promise<ProjectAccess> {
  const access = await getActorProjectAccess(ctx, actor, projectId);
  if (!access) {
    throw new Error("Nemáte přístup k tomuto projektu.");
  }
  return access;
}

/** A task plus the bot's (intersected) access to its project. */
export async function requireActorTaskAccess(
  ctx: Ctx,
  actor: BotActor,
  taskId: Id<"tasks">,
): Promise<TaskAccess> {
  const task = await ctx.db.get(taskId);
  if (!task) {
    throw new Error("Tento úkol už neexistuje.");
  }
  const access = await requireActorProjectAccess(ctx, actor, task.projectId);
  return { task, access };
}

/** Projects the bot may open in one organization — both lists, intersected. */
export async function listActorProjects(
  ctx: Ctx,
  actor: BotActor,
  organizationId: Id<"organizations">,
): Promise<Doc<"projects">[]> {
  const [bot, owner] = await Promise.all([
    listVisibleProjects(ctx, actor.botId, organizationId),
    listVisibleProjects(ctx, actor.ownerId, organizationId),
  ]);
  const ownerIds = new Set(owner.map((project) => project._id));
  return bot.filter((project) => ownerIds.has(project._id));
}

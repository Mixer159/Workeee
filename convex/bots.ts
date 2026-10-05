import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import {
  getOrgAccess,
  getProjectAccess,
  requireOrgManager,
} from "./lib/access";
import { logActivity } from "./lib/activity";
import { getAuthUserId } from "./lib/auth";
import {
  isBot,
  listOwnedBots,
  MAX_BOTS_PER_OWNER,
  normalizeAvatarUrl,
  normalizeBotName,
  requireTokenOwner,
} from "./lib/bots";
import { memberAccessLevels } from "./schema";

/**
 * The bots a person owns, and getting one into an organization.
 *
 * A bot is created by its own first `sync_bot_identity` over MCP — Workeee
 * cannot read a Grok Bot profile, so the bot pushes its name and avatar — and
 * from then on it appears here, ready to be added wherever its owner manages.
 */

/**
 * The caller's bots. With `organizationId`, each one also says whether it is
 * already a member there, which is what the "Přidat bota" dialog needs.
 */
export const listMine = query({
  args: { organizationId: v.optional(v.id("organizations")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const bots = await listOwnedBots(ctx, userId);
    const rows = await Promise.all(
      bots.map(async (bot) => ({
        _id: bot._id,
        name: bot.name,
        image: bot.image,
        lastSyncedAt: bot.lastSyncedAt ?? null,
        inOrganization: args.organizationId
          ? (await getOrgAccess(ctx, bot._id, args.organizationId)) !== null
          : false,
      })),
    );
    return rows.sort((a, b) => a.name.localeCompare(b.name, "cs"));
  },
});

/**
 * Add one of your bots to an organization you manage.
 *
 * The bot always joins as a `member` — it works, it does not administer. Its
 * access can never be wider than its owner's: a `limited` manager can only
 * hand it projects they can open themselves. (The MCP layer intersects the
 * two on every call anyway; refusing it here keeps the members list honest.)
 */
export const addToOrganization = mutation({
  args: {
    organizationId: v.id("organizations"),
    botId: v.id("users"),
    access: memberAccessLevels,
    projectIds: v.optional(v.array(v.id("projects"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const owner = await requireOrgManager(ctx, userId, args.organizationId);
    const bot = await ctx.db.get(args.botId);
    if (!bot || !isBot(bot) || bot.ownerId !== userId) {
      throw new Error("Tohoto bota nevlastníte.");
    }
    if (await getOrgAccess(ctx, bot._id, args.organizationId)) {
      throw new Error("Bot už v organizaci je.");
    }
    if (args.access === "full" && owner.access !== "full") {
      throw new Error("Botovi nemůžete dát širší přístup, než máte sami.");
    }

    const projectIds = [...new Set(args.projectIds ?? [])];
    if (args.access === "limited") {
      if (projectIds.length === 0) {
        throw new Error("Vyberte aspoň jeden projekt.");
      }
      for (const projectId of projectIds) {
        const project = await getProjectAccess(ctx, userId, projectId);
        if (!project || project.project.organizationId !== args.organizationId) {
          throw new Error("Nemáte přístup k tomuto projektu.");
        }
      }
    }

    await ctx.db.insert("organizationMembers", {
      organizationId: args.organizationId,
      userId: bot._id,
      role: "member",
      access: args.access,
    });
    if (args.access === "limited") {
      await Promise.all(
        projectIds.map((projectId) =>
          ctx.db.insert("projectMembers", {
            projectId,
            userId: bot._id,
            organizationId: args.organizationId,
          }),
        ),
      );
    }
    await logActivity(ctx, {
      organizationId: args.organizationId,
      actorId: userId,
      type: "bot_added",
      targetId: bot._id,
      meta: { name: bot.name, access: args.access },
    });
  },
});

/**
 * `sync_bot_identity` — the first thing a connected bot does, and what it
 * repeats whenever its profile changes.
 *
 * The token decides whose bot this is; the bot only says what it is called.
 * Resolution, in order:
 *
 * 1. The token is already bound → update that bot.
 * 2. The owner already has a bot of this name → bind the token to it. That is
 *    how a revoked token is replaced without losing the bot's memberships.
 * 3. Otherwise create a new bot owned by the token's human and bind it.
 *
 * `avatarUrl` omitted keeps the stored one; an empty string clears it.
 */
export const syncIdentity = internalMutation({
  args: {
    tokenHash: v.string(),
    name: v.string(),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Like every tool in `convex/mcpTools.ts`: a plain `Error` would reach the
    // bot as "Akce se nepovedla.", a `ConvexError` carries the Czech sentence.
    try {
      return await syncBotIdentity(ctx, args);
    } catch (error) {
      if (error instanceof ConvexError) {
        throw error;
      }
      throw new ConvexError(
        error instanceof Error ? error.message : "Akce se nepovedla.",
      );
    }
  },
});

async function syncBotIdentity(
  ctx: MutationCtx,
  args: { tokenHash: string; name: string; avatarUrl?: string },
) {
  const { token, owner } = await requireTokenOwner(ctx, args.tokenHash);
  const name = normalizeBotName(args.name);
  const image = normalizeAvatarUrl(args.avatarUrl);
  const now = Date.now();

  const bot = await findBotForToken(ctx, token, owner._id, name);
  if (bot) {
    const nextImage = args.avatarUrl === undefined ? bot.image : image;
    await ctx.db.patch(bot._id, { name, image: nextImage, lastSyncedAt: now });
    if (token.botUserId !== bot._id) {
      await ctx.db.patch(token._id, { botUserId: bot._id });
    }
    return identity(bot._id, name, nextImage, owner);
  }

  const owned = await listOwnedBots(ctx, owner._id);
  if (owned.length >= MAX_BOTS_PER_OWNER) {
    throw new Error(`Jeden člověk může mít nejvýš ${MAX_BOTS_PER_OWNER} botů.`);
  }
  const botId = await ctx.db.insert("users", {
    authId: `bot:${crypto.randomUUID()}`,
    name,
    email: "",
    image,
    kind: "bot",
    ownerId: owner._id,
    lastSyncedAt: now,
  });
  await ctx.db.patch(token._id, { botUserId: botId });
  return identity(botId, name, image, owner);
}

async function findBotForToken(
  ctx: MutationCtx,
  token: Doc<"apiTokens">,
  ownerId: Id<"users">,
  name: string,
): Promise<Doc<"users"> | null> {
  if (token.botUserId) {
    const bound = await ctx.db.get(token.botUserId);
    if (bound && isBot(bound) && bound.ownerId === ownerId) {
      return bound;
    }
  }
  const owned = await listOwnedBots(ctx, ownerId);
  const key = name.toLocaleLowerCase("cs");
  return owned.find((bot) => bot.name.toLocaleLowerCase("cs") === key) ?? null;
}

function identity(
  botId: Id<"users">,
  name: string,
  image: string | undefined,
  owner: Doc<"users">,
) {
  return {
    botId,
    name,
    avatarUrl: image ?? null,
    ownerName: owner.name,
  };
}

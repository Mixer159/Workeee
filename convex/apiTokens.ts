import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import {
  apiTokenDisplayPrefix,
  generateApiToken,
  hashApiToken,
  MAX_ACTIVE_TOKENS,
} from "./lib/apiTokens";
import { getAuthUserId, getUserByAuthId } from "./lib/auth";
import { isBot } from "./lib/bots";
import { normalizeName } from "./lib/validation";

/**
 * Personal API tokens: `/nastaveni/propojeni`. A token belongs to the person who
 * minted it, so none of these take a `userId` — like the notification switch,
 * it is nobody else's to list or revoke.
 */

/** How many rows the list shows, revoked ones included. */
const LIST_LIMIT = 50;

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    const tokens = await ctx.db
      .query("apiTokens")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(LIST_LIMIT);
    return await Promise.all(
      tokens.map(async (token) => {
        const bot = token.botUserId ? await ctx.db.get(token.botUserId) : null;
        return {
          _id: token._id,
          name: token.name,
          tokenPrefix: token.tokenPrefix,
          createdAt: token._creationTime,
          lastUsedAt: token.lastUsedAt ?? null,
          revoked: token.revokedAt !== undefined,
          bot: bot ? { name: bot.name, image: bot.image } : null,
        };
      }),
    );
  },
});

/**
 * Mint a token and hand back the secret — **the only time it is ever
 * returned**. An action because hashing is `crypto.subtle`, which is async;
 * the hash, never the secret, is what crosses into the transaction.
 */
export const create = action({
  args: { name: v.string() },
  handler: async (ctx, args): Promise<{ token: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Nejste přihlášeni.");
    }
    const token = generateApiToken();
    await ctx.runMutation(internal.apiTokens.insert, {
      authId: identity.subject,
      name: args.name,
      tokenHash: await hashApiToken(token),
      tokenPrefix: apiTokenDisplayPrefix(token),
    });
    return { token };
  },
});

/** The write half of `create`. The identity is passed in, resolved here. */
export const insert = internalMutation({
  args: {
    authId: v.string(),
    name: v.string(),
    tokenHash: v.string(),
    tokenPrefix: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"apiTokens">> => {
    const user = await getUserByAuthId(ctx, args.authId);
    if (!user || isBot(user)) {
      throw new Error("Nejste přihlášeni.");
    }
    const name = normalizeName(args.name, "tokenu");

    const tokens = await ctx.db
      .query("apiTokens")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const active = tokens.filter((token) => token.revokedAt === undefined);
    if (active.length >= MAX_ACTIVE_TOKENS) {
      throw new Error(
        `Aktivních tokenů může být nejvýš ${MAX_ACTIVE_TOKENS}. Nějaký zrušte.`,
      );
    }

    return await ctx.db.insert("apiTokens", {
      userId: user._id,
      name,
      tokenHash: args.tokenHash,
      tokenPrefix: args.tokenPrefix,
    });
  },
});

/**
 * Revoke for good. The bot the token was bound to stays a member wherever it
 * was added — it simply cannot act until somebody connects it with a new token.
 */
export const revoke = mutation({
  args: { tokenId: v.id("apiTokens") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const token = await ctx.db.get(args.tokenId);
    if (!token || token.userId !== userId) {
      throw new Error("Tento token neexistuje.");
    }
    if (token.revokedAt !== undefined) {
      return;
    }
    await ctx.db.patch(token._id, { revokedAt: Date.now() });
  },
});

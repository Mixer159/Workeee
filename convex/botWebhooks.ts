import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { getOrgAccess, getProjectAccess, isOwner, requireOrgAccess } from "./lib/access";
import { getAuthUserId } from "./lib/auth";
import {
  deleteBotWebhook,
  getBotWebhook,
  normalizeWebhookHeaderName,
  normalizeWebhookSecret,
  normalizeWebhookUrl,
  WEBHOOK_ATTEMPTS,
  WEBHOOK_BACKOFF_MS,
  type BotWebhookPayload,
} from "./lib/botWebhooks";
import { isBot } from "./lib/bots";
import { commentBodyText, parseCommentBody } from "./lib/commentBody";
import { postWebhook } from "./lib/webhookHttp";

/**
 * Where an organization's bots are told about mentions and assignments — the
 * owner's settings, and the scheduled delivery. The rules (what triggers one,
 * what the payload is, why nothing secret is scheduled) are in
 * `convex/lib/botWebhooks.ts`.
 *
 * **Owner only.** A webhook sends task titles and comment text out of the
 * organization to an address somebody typed in, which is the same kind of
 * decision as deleting it: an admin runs the organization, the owner decides
 * what leaves it.
 */

const webhookEvents = v.union(v.literal("mention"), v.literal("assigned"));

/**
 * Every webhook of the organization's bots, for its owner. Never the secret —
 * `hasSecret` is all a screen needs to say "nastaveno".
 */
export const list = query({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }
    if (!isOwner(await getOrgAccess(ctx, userId, args.organizationId))) {
      return [];
    }
    const rows = await ctx.db
      .query("botWebhooks")
      .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
      .collect();
    return rows.map((row) => ({
      botId: row.botUserId,
      ...publicConfig(row),
      updatedAt: row.updatedAt,
    }));
  },
});

/** One bot's webhook, or null when it has none (or the caller is not the owner). */
export const get = query({
  args: { organizationId: v.id("organizations"), botId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    if (!isOwner(await getOrgAccess(ctx, userId, args.organizationId))) {
      return null;
    }
    const row = await getBotWebhook(ctx, args.botId, args.organizationId);
    return row ? publicConfig(row) : null;
  },
});

/**
 * Create or replace a bot's webhook. `secret` may be omitted only when one is
 * already stored — the screen cannot show it, so "keep the current one" is
 * leaving the field empty. `headerName` omitted or empty sends no extra header.
 */
export const set = mutation({
  args: {
    organizationId: v.id("organizations"),
    botId: v.id("users"),
    url: v.string(),
    secret: v.optional(v.string()),
    headerName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireOrganizationOwner(ctx, args.organizationId);
    await requireBotMember(ctx, args.botId, args.organizationId);

    const url = normalizeWebhookUrl(args.url);
    const headerName = normalizeWebhookHeaderName(args.headerName);
    const existing = await getBotWebhook(ctx, args.botId, args.organizationId);
    const secret =
      args.secret !== undefined && args.secret.length > 0
        ? normalizeWebhookSecret(args.secret)
        : existing?.secret;
    if (!secret) {
      throw new Error("Zadejte tajný klíč.");
    }

    const fields = {
      url,
      secret,
      headerName,
      updatedBy: userId,
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return;
    }
    await ctx.db.insert("botWebhooks", {
      botUserId: args.botId,
      organizationId: args.organizationId,
      ...fields,
    });
  },
});

export const clear = mutation({
  args: { organizationId: v.id("organizations"), botId: v.id("users") },
  handler: async (ctx, args) => {
    await requireOrganizationOwner(ctx, args.organizationId);
    await deleteBotWebhook(ctx, args.botId, args.organizationId);
  },
});

type Delivery = {
  url: string;
  secret: string;
  headerName: string | null;
  payload: BotWebhookPayload;
};

/**
 * Everything one attempt needs, read and **re-authorized at send time** — the
 * same discipline as `claimDigest`. Between the comment and the POST the
 * webhook can be cleared, the bot removed, its owner removed, the task deleted
 * or the assignment undone; each of those means nothing goes out. Internal on
 * purpose: this is the only function that ever returns the secret.
 */
export const loadDelivery = internalQuery({
  args: {
    botId: v.id("users"),
    organizationId: v.id("organizations"),
    taskId: v.id("tasks"),
    event: webhookEvents,
    actorId: v.id("users"),
    commentId: v.union(v.id("comments"), v.null()),
  },
  handler: async (ctx, args): Promise<Delivery | null> => {
    const [webhook, bot, task, actor] = await Promise.all([
      getBotWebhook(ctx, args.botId, args.organizationId),
      ctx.db.get(args.botId),
      ctx.db.get(args.taskId),
      ctx.db.get(args.actorId),
    ]);
    if (!webhook || !bot || !isBot(bot) || !bot.ownerId || !task) {
      return null;
    }
    if (task.organizationId !== args.organizationId) {
      return null;
    }
    // Bot ∩ owner, as on every MCP call: the payload is task data, and it must
    // not reach a bot that could no longer read it through the endpoint.
    const [botAccess, ownerAccess] = await Promise.all([
      getProjectAccess(ctx, bot._id, task.projectId),
      getProjectAccess(ctx, bot.ownerId, task.projectId),
    ]);
    if (!botAccess || !ownerAccess) {
      return null;
    }

    let commentText: string | null = null;
    if (args.event === "mention") {
      const comment = args.commentId ? await ctx.db.get(args.commentId) : null;
      if (!comment || comment.taskId !== task._id) {
        return null;
      }
      const segments = parseCommentBody(comment.body);
      commentText = segments ? commentBodyText(segments) : "";
    } else if (task.assigneeId !== bot._id) {
      // Handed over and taken back before the POST: not news any more.
      return null;
    }

    const origin = (process.env.SITE_URL ?? "").replace(/\/+$/, "");
    return {
      url: webhook.url,
      secret: webhook.secret,
      headerName: webhook.headerName ?? null,
      payload: {
        event: args.event,
        taskId: task._id,
        taskTitle: task.title,
        projectId: task.projectId,
        organizationId: task.organizationId,
        commentId: args.event === "mention" ? args.commentId : null,
        commentText,
        author: { id: args.actorId, name: actor?.name ?? "" },
        url: `${origin}/projekt/${task.projectId}?ukol=${task._id}`,
      },
    };
  },
});

/**
 * One attempt. A failure worth repeating schedules the next one with the same
 * ids and `attempt + 1` — the backoff is the scheduler's delay, never a sleep
 * inside a running action. The log names the bot, the host and the status;
 * never the secret, and never the full URL, whose query string may carry one.
 */
export const deliver = internalAction({
  args: {
    botId: v.id("users"),
    organizationId: v.id("organizations"),
    taskId: v.id("tasks"),
    event: webhookEvents,
    actorId: v.id("users"),
    commentId: v.union(v.id("comments"), v.null()),
    attempt: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    const { attempt, ...target } = args;
    const delivery: Delivery | null = await ctx.runQuery(
      internal.botWebhooks.loadDelivery,
      target,
    );
    if (!delivery) {
      return;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${delivery.secret}`,
    };
    if (delivery.headerName) {
      headers[delivery.headerName] = delivery.secret;
    }
    const result = await postWebhook({
      url: delivery.url,
      headers,
      body: JSON.stringify(delivery.payload),
    });
    if (result.ok) {
      return;
    }

    const retry = result.retryable && attempt < WEBHOOK_ATTEMPTS;
    console.error(
      `[webhook] bot ${args.botId} → ${hostOf(delivery.url)}: ` +
        `${result.status ?? "bez odpovědi"}, pokus ${attempt}/${WEBHOOK_ATTEMPTS}` +
        (retry ? ", zkusí se znovu." : ", vzdáno."),
    );
    if (retry) {
      await ctx.scheduler.runAfter(
        WEBHOOK_BACKOFF_MS[attempt - 1],
        internal.botWebhooks.deliver,
        { ...target, attempt: attempt + 1 },
      );
    }
  },
});

function publicConfig(row: { url: string; secret: string; headerName?: string }) {
  return {
    url: row.url,
    hasSecret: row.secret.length > 0,
    headerName: row.headerName ?? null,
  };
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "?";
  }
}

async function requireOrganizationOwner(
  ctx: MutationCtx,
  organizationId: Id<"organizations">,
): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Nejste přihlášeni.");
  }
  const access = await requireOrgAccess(ctx, userId, organizationId);
  if (!isOwner(access)) {
    throw new Error("Webhook bota může nastavit jen vlastník organizace.");
  }
  return userId;
}

async function requireBotMember(
  ctx: MutationCtx,
  botId: Id<"users">,
  organizationId: Id<"organizations">,
): Promise<void> {
  const bot = await ctx.db.get(botId);
  if (!bot || !isBot(bot) || !(await getOrgAccess(ctx, botId, organizationId))) {
    throw new Error("Tento bot v organizaci není.");
  }
}

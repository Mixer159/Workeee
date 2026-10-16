import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isBot } from "./bots";

/**
 * Bot webhooks: the one way Workeee speaks first to a bot.
 *
 * A bot otherwise only answers — it polls the MCP endpoint. Two events are
 * addressed to it the way an e-mail is addressed to a person, and those two
 * are pushed: a comment that `@`-names it (`mention`) and a task handed to it
 * (`assigned`). The same rule as the digest: what somebody did *to* you, never
 * what merely happened near you.
 *
 * - **The mutation only schedules.** It reads one indexed row to decide whether
 *   there is anywhere to deliver, and hands the rest to
 *   `internal.botWebhooks.deliver`. Nothing about the network can fail the
 *   comment or the assignment that caused it.
 * - **Nothing secret is scheduled.** The arguments of a scheduled function are
 *   stored, so they carry ids only; the secret is read inside the delivery's
 *   own internal query, at send time, along with everything else.
 * - **Never for the bot's own work.** A bot assigning itself, or a comment it
 *   wrote, would otherwise wake it up to react to itself.
 */

export type BotWebhookEvent = "mention" | "assigned";

/** What the bot's endpoint receives, as JSON. */
export type BotWebhookPayload = {
  event: BotWebhookEvent;
  taskId: Id<"tasks">;
  taskTitle: string;
  projectId: Id<"projects">;
  organizationId: Id<"organizations">;
  /** `null` for `assigned`. */
  commentId: Id<"comments"> | null;
  /** The comment as plain text, a mention read as `@Jméno`; `null` for `assigned`. */
  commentText: string | null;
  author: { id: Id<"users">; name: string };
  /** The task's drawer — the same link the e-mail digest puts under a title. */
  url: string;
};

/** Attempts per event, including the first. */
export const WEBHOOK_ATTEMPTS = 3;

/** Delay before attempt 2 and attempt 3 — rescheduled, never slept. */
export const WEBHOOK_BACKOFF_MS = [10_000, 60_000];

/** A receiver slower than this is treated like one that is down. */
export const WEBHOOK_TIMEOUT_MS = 10_000;

const MAX_URL_LENGTH = 2048;
const MIN_SECRET_LENGTH = 16;
const MAX_SECRET_LENGTH = 256;
const MAX_HEADER_NAME_LENGTH = 64;

/** An HTTP token (RFC 9110 §5.6.2) — anything else is not a header name. */
const HEADER_NAME = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+$/;

/** Visible ASCII only: a header value cannot carry a space or a line break. */
const SECRET = /^[\x21-\x7E]+$/;

/**
 * Headers the request already sets, or that a fetch implementation owns. A
 * custom name equal to one of them would silently replace `Authorization` or
 * corrupt the request, so it is refused rather than allowed to collide.
 */
const RESERVED_HEADERS = new Set([
  "authorization",
  "proxy-authorization",
  "content-type",
  "content-length",
  "host",
  "cookie",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "te",
  "upgrade",
  "expect",
]);

/**
 * `https:` only, no credentials in the address. The payload carries task
 * titles and comment text, and plain `http:` would hand both — and the
 * secret in the header — to anybody on the path.
 */
export function normalizeWebhookUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error("Zadejte adresu webhooku.");
  }
  if (trimmed.length > MAX_URL_LENGTH) {
    throw new Error("Adresa webhooku je příliš dlouhá.");
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Adresa webhooku není platná URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Webhook musí být na adrese https://.");
  }
  return url.toString();
}

/** Not trimmed: a secret is compared byte for byte by whoever receives it. */
export function normalizeWebhookSecret(value: string): string {
  if (value.length < MIN_SECRET_LENGTH || value.length > MAX_SECRET_LENGTH) {
    throw new Error(
      `Tajný klíč musí mít ${MIN_SECRET_LENGTH} až ${MAX_SECRET_LENGTH} znaků.`,
    );
  }
  if (!SECRET.test(value)) {
    throw new Error("Tajný klíč smí obsahovat jen viditelné znaky ASCII bez mezer.");
  }
  return value;
}

/** Undefined (or empty) means no extra header. */
export function normalizeWebhookHeaderName(
  value: string | undefined,
): string | undefined {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) {
    return undefined;
  }
  if (trimmed.length > MAX_HEADER_NAME_LENGTH || !HEADER_NAME.test(trimmed)) {
    throw new Error("Název hlavičky není platný.");
  }
  if (RESERVED_HEADERS.has(trimmed.toLowerCase())) {
    throw new Error(`Hlavičku ${trimmed} posílá Workeee samo.`);
  }
  return trimmed;
}

export async function getBotWebhook(
  ctx: QueryCtx | MutationCtx,
  botUserId: Id<"users">,
  organizationId: Id<"organizations">,
): Promise<Doc<"botWebhooks"> | null> {
  return await ctx.db
    .query("botWebhooks")
    .withIndex("by_bot_org", (q) =>
      q.eq("botUserId", botUserId).eq("organizationId", organizationId),
    )
    .unique();
}

/** A comment was written: every bot it names that has somewhere to be told. */
export async function scheduleMentionWebhooks(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  commentId: Id<"comments">,
  mentionedIds: Id<"users">[],
  actorId: Id<"users">,
): Promise<void> {
  for (const botId of new Set(mentionedIds)) {
    await scheduleBotWebhook(ctx, {
      botId,
      task,
      event: "mention",
      actorId,
      commentId,
    });
  }
}

/** A task was handed to `assigneeId`; a no-op unless that is a bot with a webhook. */
export async function scheduleAssignedWebhook(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  assigneeId: Id<"users">,
  actorId: Id<"users">,
): Promise<void> {
  await scheduleBotWebhook(ctx, {
    botId: assigneeId,
    task,
    event: "assigned",
    actorId,
  });
}

async function scheduleBotWebhook(
  ctx: MutationCtx,
  args: {
    botId: Id<"users">;
    task: Doc<"tasks">;
    event: BotWebhookEvent;
    actorId: Id<"users">;
    commentId?: Id<"comments">;
  },
): Promise<void> {
  if (args.botId === args.actorId) {
    return;
  }
  if (!isBot(await ctx.db.get(args.botId))) {
    return;
  }
  if (!(await getBotWebhook(ctx, args.botId, args.task.organizationId))) {
    return;
  }
  await ctx.scheduler.runAfter(0, internal.botWebhooks.deliver, {
    botId: args.botId,
    organizationId: args.task.organizationId,
    taskId: args.task._id,
    event: args.event,
    actorId: args.actorId,
    commentId: args.commentId ?? null,
    attempt: 1,
  });
}

/** Removing a bot from an organization takes its webhook (and secret) with it. */
export async function deleteBotWebhook(
  ctx: MutationCtx,
  botUserId: Id<"users">,
  organizationId: Id<"organizations">,
): Promise<void> {
  const row = await getBotWebhook(ctx, botUserId, organizationId);
  if (row) {
    await ctx.db.delete(row._id);
  }
}

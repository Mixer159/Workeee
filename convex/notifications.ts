import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, mutation, query } from "./_generated/server";
import { getAuthUser, getAuthUserId } from "./lib/auth";
import { sendTransactionalEmail } from "./lib/brevo";
import { buildTaskDigest } from "./lib/notificationEmail";
import { claimDigest, wantsTaskEmails, type Digest } from "./lib/notifications";

/**
 * The notification surface: one switch for the person, and the flush that turns
 * a batch of queued tasks into a single e-mail.
 *
 * The batching itself — the queue, the sliding window, the access re-check —
 * lives in `convex/lib/notifications.ts`. Everything here is either a thin
 * wrapper the client calls or the scheduled job that hands the digest to Brevo.
 */

/**
 * The signed-in person's own setting. There is no `userId` argument here and
 * there never will be: a preference is not somebody else's to read or write.
 */
export const settings = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthUser(ctx);
    if (!user) {
      return null;
    }
    return {
      email: user.email,
      taskEmails: await wantsTaskEmails(ctx, user._id),
    };
  },
});

export const setTaskEmails = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Nejste přihlášeni.");
    }
    const existing = await ctx.db
      .query("notificationSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { taskEmails: args.enabled });
      return;
    }
    await ctx.db.insert("notificationSettings", {
      userId,
      taskEmails: args.enabled,
    });
  },
});

/**
 * Take the batch off the queue. Split out of `flush` because an action cannot
 * touch the database — and because this is the half worth testing, so the tests
 * drive it directly and never reach the network.
 */
export const claim = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<Digest | null> => {
    return await claimDigest(ctx, args.userId);
  },
});

/**
 * The scheduled send, one per person per window. An action, because Brevo is
 * an HTTP call.
 *
 * Also runnable by hand, which is how you avoid waiting two minutes while
 * testing:
 *
 *     pnpm exec convex run notifications:flush '{"userId": "..."}'
 */
export const flush = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<void> => {
    const digest: Digest | null = await ctx.runMutation(
      internal.notifications.claim,
      { userId: args.userId },
    );
    if (!digest) {
      return;
    }

    const email = buildTaskDigest(digest, process.env.SITE_URL ?? "");
    await sendTransactionalEmail({
      to: { email: digest.email, name: digest.name },
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  },
});

import {
  createClient,
  type AuthFunctions,
  type GenericCtx,
} from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components, internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";
import { getUserByAuthId } from "./lib/auth";
import { sendTransactionalEmail } from "./lib/brevo";
import {
  buildPasswordResetEmail,
  RESET_LINK_LIFETIME_MINUTES,
} from "./lib/passwordResetEmail";
import { deletePresence } from "./lib/presence";
import { normalizeUserName } from "./lib/validation";

const siteUrl = process.env.SITE_URL!;

const authFunctions: AuthFunctions = internal.auth;

/**
 * Better Auth component client.
 *
 * The triggers below mirror the component's `user` table into the app-owned
 * `users` table, transactionally with the auth write itself.
 */
export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      onCreate: async (ctx, doc) => {
        await ctx.db.insert("users", {
          authId: doc._id,
          name: normalizeUserName(doc.name),
          email: doc.email,
          image: doc.image ?? undefined,
        });
      },
      onUpdate: async (ctx, newDoc) => {
        const user = await getUserByAuthId(ctx, newDoc._id);
        if (!user) {
          return;
        }
        await ctx.db.patch(user._id, {
          name: normalizeUserName(newDoc.name),
          email: newDoc.email,
          image: newDoc.image ?? undefined,
        });
      },
      onDelete: async (ctx, doc) => {
        const user = await getUserByAuthId(ctx, doc._id);
        if (!user) {
          return;
        }
        await deletePresence(ctx, user._id);
        await ctx.db.delete(user._id);
      },
    },
  },
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

/**
 * Better Auth instance. Self-registration is enabled: users sign themselves up
 * with e-mail + password. E-mail verification is intentionally off for v1.
 *
 * Password reset is the one e-mail Better Auth sends: `requestPasswordReset`
 * mints a single-use token, and `sendResetPassword` mails the link through the
 * same Brevo helper the digests use. The `url` Better Auth builds points at
 * `${SITE_URL}/api/auth/reset-password/<token>`, which the Next.js proxy
 * forwards here; the callback checks expiry and redirects to
 * `/nove-heslo?token=…` (or `?error=INVALID_TOKEN`). The hook only ever runs
 * inside the HTTP action, so `fetch` is available. Unconfigured Brevo means
 * the request succeeds and nothing arrives — see **Upozornění** in CLAUDE.md.
 */
export const createAuth = (ctx: GenericCtx<DataModel>) =>
  betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 12,
      maxPasswordLength: 256,
      resetPasswordTokenExpiresIn: RESET_LINK_LIFETIME_MINUTES * 60,
      // Whoever had the old password loses every open session with it.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendTransactionalEmail(
          buildPasswordResetEmail({
            to: { email: user.email, name: normalizeUserName(user.name) },
            url,
          }),
        );
      },
    },
    plugins: [convex({ authConfig })],
  });

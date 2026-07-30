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
        await ctx.db.delete(user._id);
      },
    },
  },
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

/**
 * Better Auth instance. Self-registration is enabled: users sign themselves up
 * with e-mail + password. E-mail verification is intentionally off for v1.
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
    },
    plugins: [convex({ authConfig })],
  });

import { query } from "./_generated/server";
import { getAuthUser } from "./lib/auth";

/**
 * The signed-in app user, or null when unauthenticated.
 * Subscribed to by the app shell — must stay cheap.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    return await getAuthUser(ctx);
  },
});

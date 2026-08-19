import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthUserId } from "./lib/auth";
import { touchSeen } from "./lib/presence";

/**
 * "I am here."
 *
 * The app shell sends this on mount, on every return to a visible tab and then
 * every `HEARTBEAT_MS` while the tab stays visible — so the client is free to
 * be chatty and the server is what decides how often anything is written:
 * `touchSeen` leaves a row younger than `WRITE_GAP_MS` alone. A busy team
 * therefore costs at most one write per person per minute, which is also how
 * often the members list re-runs for everybody subscribed to it.
 *
 * It is the one mutation in the app that stays quiet when nobody is signed in.
 * A tab that has just signed out still has a timer in flight, and a toast
 * saying "Nejste přihlášeni" on the way to the sign-in screen would be noise
 * about something the person just did on purpose.
 */
export const heartbeat = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    await touchSeen(ctx, userId);
    return null;
  },
});

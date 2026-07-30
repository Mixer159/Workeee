"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";

/**
 * The signed-in app user. `undefined` while loading, `null` when unauthenticated.
 */
export function useCurrentUser() {
  return useQuery(api.users.currentUser);
}

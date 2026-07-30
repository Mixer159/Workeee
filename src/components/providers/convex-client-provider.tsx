"use client";

import type { ReactNode } from "react";
import {
  ConvexBetterAuthProvider,
  type AuthClient,
} from "@convex-dev/better-auth/react";
import { ConvexReactClient } from "convex/react";
import { authClient } from "@/lib/auth-client";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
// @convex-dev/better-auth 0.12.5's AuthClient alias infers `useSession.data`
// as `never` with Better Auth 1.6.22+, although the runtime client contract is
// unchanged and its declared peer range explicitly includes this patch line.
const providerAuthClient = authClient as unknown as AuthClient;

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexBetterAuthProvider client={convex} authClient={providerAuthClient}>
      {children}
    </ConvexBetterAuthProvider>
  );
}

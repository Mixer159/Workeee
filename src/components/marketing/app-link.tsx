"use client";

import Link from "next/link";
import { useConvexAuth } from "convex/react";
import { ACTIONS, LINKS } from "@/lib/landing";

/**
 * The way onward from the public page, for both kinds of visitor.
 *
 * The public page is what the bare domain shows to somebody without a session
 * (see `src/proxy.ts`), so the bar offers a door in: "Přihlášení" for a
 * visitor, "Přehled" for somebody Convex has actually validated, never a
 * redirect, because a signed-in visitor here is usually the person who
 * deployed it, showing the page to somebody. Nothing renders while the session
 * is still being checked, so neither label ever flashes into the other.
 */
export function AppLink({ className }: { className: string }) {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return null;
  }

  return (
    <Link href={isAuthenticated ? "/" : LINKS.login} className={className}>
      {isAuthenticated ? "Přehled" : ACTIONS.login}
    </Link>
  );
}

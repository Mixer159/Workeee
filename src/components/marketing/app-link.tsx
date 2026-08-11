"use client";

import Link from "next/link";
import { useConvexAuth } from "convex/react";
import { ArrowRightIcon } from "lucide-react";

/**
 * The way onward, for both kinds of visitor.
 *
 * The public page is what the bare domain shows to somebody without a session
 * (see `src/proxy.ts`), so the header has to offer a door in: "Přihlásit se"
 * for a visitor, "Přehled" for somebody Convex has actually validated — never
 * a redirect, because a signed-in visitor here is usually the person who
 * deployed it, showing the page to somebody. Nothing renders while the session
 * is still being checked, so neither label ever flashes into the other.
 *
 * It sits at the end of the nav, where appearing after hydration takes space
 * from the flexible gap and moves nothing.
 */
export function AppLink() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return null;
  }

  return (
    <Link
      href={isAuthenticated ? "/" : "/prihlaseni"}
      className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      {isAuthenticated ? "Přehled" : "Přihlásit se"}
      <ArrowRightIcon className="size-3.5" aria-hidden />
    </Link>
  );
}

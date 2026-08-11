import type { ReactNode } from "react";
import Link from "next/link";
import { Mark } from "@/components/brand/mark";

/**
 * The frame around signing in and signing up.
 *
 * The brand word is set the way the public page sets it, two steps down: the
 * same face, the same tracking, the same uppercase. It is the one moment inside
 * the product where the identity is allowed to be loud, because there is
 * nothing else on the screen to compete with. Everything below it is the app's
 * ordinary 14 px.
 *
 * The footer link back to `/` is the way out for somebody who arrived at the
 * sign-in screen and wanted to read what this is first.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-10 px-4 py-14">
      <div className="flex flex-col items-center gap-4">
        <Mark className="size-7 text-primary" />
        <p className="workeee-display text-[2.5rem] leading-none">Workeee</p>
      </div>

      <div className="w-full max-w-sm">{children}</div>

      <Link
        href="/o-aplikaci"
        className="rounded-md text-xs text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        Co je Workeee
      </Link>
    </div>
  );
}

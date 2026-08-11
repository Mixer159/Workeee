import type { ReactNode } from "react";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

/**
 * The public shell for `/o-aplikaci` and `/zmeny`.
 *
 * It carries the app's own `dark` class rather than a palette of its own. That
 * is the point of this build: the page is not a second design system that
 * resembles the product, it *is* the product's dark theme, which is why a
 * screenshot of the board drops onto the page with nothing around it and still
 * looks like part of the layout. A visitor whose app theme is light still sees
 * this page dark, because the class sits here and not on `<html>`.
 *
 * `workeee-marketing` is what `globals.css` hangs the page-only rules off: the
 * document background behind an overscroll bounce, and the scroll choreography.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="workeee-marketing dark flex min-h-dvh flex-col bg-background text-foreground selection:bg-primary/25">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

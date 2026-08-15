import type { ReactNode } from "react";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";

/**
 * The public shell for `/o-aplikaci` and `/zmeny`.
 *
 * It presents the product's own light default, the Obloha palette, rather than
 * a palette of its own. That is the point of this build: the page is not a
 * second design system that resembles the product, it *is* the product's light
 * theme, which is why a screenshot of the board drops onto the page with
 * nothing around it and still looks like part of the layout. A visitor whose
 * app theme is dark still sees this page light, because the tokens are
 * overridden here and not on `<html>`.
 *
 * `workeee-marketing` is what `globals.css` hangs the page-only rules off: the
 * token override, the document background behind an overscroll bounce, and the
 * scroll choreography.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="workeee-marketing flex min-h-dvh flex-col bg-background text-foreground selection:bg-primary/25">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

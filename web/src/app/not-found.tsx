import type { Metadata } from "next";
import { ButtonLink } from "@/components/vyber/button-link";
import { Footer } from "@/components/vyber/footer";
import { CHANGES_HREF, Nav } from "@/components/vyber/nav";
import { PageHead } from "@/components/vyber/page-head";
import { SITE } from "@/lib/workeee";

// Next.js adds noindex to every 404 response by itself.
export const metadata: Metadata = { title: `Stránka nenalezena | ${SITE.name}` };

/** Any address that does not exist: the page head, and the way back. */
export default function NotFound() {
  return (
    <>
      <Nav page="not-found" />
      <main>
        <PageHead title="Tady nic není" lead="Stránka na této adrese neexistuje. Zkuste úvodní stránku nebo historii změn." />
        <div className="wrap flex flex-wrap justify-center gap-3 pb-24 lg:pb-32">
          <ButtonLink href="/">Na úvodní stránku</ButtonLink>
          <ButtonLink href={CHANGES_HREF} tone="white" className="shadow-[inset_0_0_0_1px_rgb(17_17_19/0.18)]">
            Historie změn
          </ButtonLink>
        </div>
      </main>
      <Footer page="not-found" />
    </>
  );
}

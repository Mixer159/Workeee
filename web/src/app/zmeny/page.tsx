import type { Metadata } from "next";
import { ChangesPage } from "@/components/vyber/changes-page";
import { Footer } from "@/components/vyber/footer";
import { Nav } from "@/components/vyber/nav";
import { pageMetadata } from "@/lib/metadata";
import { SITE } from "@/lib/workeee";

export const metadata: Metadata = pageMetadata({
  title: `Historie změn | ${SITE.name}`,
  description:
    "Co se v týmové nástěnce Workeee změnilo, od nejnovějšího. Seznam je součástí repozitáře, takže se mění spolu s kódem.",
  path: "/zmeny",
});

export default function ZmenyPage() {
  return (
    <>
      <Nav page="zmeny" />
      <main>
        <ChangesPage />
      </main>
      <Footer page="zmeny" />
    </>
  );
}

import type { Metadata } from "next";
import { ChangesPage } from "@/components/marketing/changes-page";
import { Footer } from "@/components/marketing/footer";
import { Nav } from "@/components/marketing/nav";

export const metadata: Metadata = {
  title: "Změny",
  description: "Co se ve Workeee změnilo, od nejnovějšího.",
};

/** The whole changelog, grouped by month, in the public page's shell. */
export default function ChangelogPage() {
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

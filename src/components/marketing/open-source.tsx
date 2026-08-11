import { RepoButton } from "@/components/marketing/repo-button";
import { LICENSE_NAME, REPO_ISSUES_URL, REPO_LICENSE_URL } from "@/lib/repo";

/**
 * The second and last appearance of the page's one button.
 *
 * No grid, no cards, no picture: after five sections of product this one is
 * deliberately a bare statement, which is also what keeps it from looking like
 * any other section on the page.
 */
export function OpenSource() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-[84rem] px-6 py-24 lg:px-10 lg:py-36">
        <div data-enter className="max-w-[46rem]">
          <h2 className="font-heading text-[clamp(1.75rem,4.2vw,3rem)] leading-[1.05] font-bold tracking-[-0.035em]">
            Celý zdrojový kód je venku.
          </h2>
          <p className="mt-6 text-[0.9375rem] leading-relaxed text-muted-foreground">
            Licence {LICENSE_NAME}, jeden repozitář, žádná uzavřená část.
            Chybí vám něco, děláme něco divně, nebo jste našli chybu? Založte
            issue nebo rovnou pull request. Kód je psaný tak, aby se v něm dalo
            číst: každé rozhodnutí, které by jinak vypadalo náhodně, má
            v repozitáři napsáno proč.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
            <RepoButton />
            <a
              href={REPO_ISSUES_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-md text-sm text-muted-foreground underline decoration-border underline-offset-[6px] transition-colors outline-none hover:text-foreground hover:decoration-primary focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              Issues
            </a>
            <a
              href={REPO_LICENSE_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-md text-sm text-muted-foreground underline decoration-border underline-offset-[6px] transition-colors outline-none hover:text-foreground hover:decoration-primary focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              Licence {LICENSE_NAME}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

import { CodeBlock } from "@/components/marketing/code-block";
import { REPO_URL } from "@/lib/repo";

/**
 * The whole sequence, with the real commands and the real variable names. If
 * somebody follows this page top to bottom they end up with a running
 * deployment, which is the only reason a section like this is worth writing.
 *
 * The steps hang off one vertical rule with a marker per step. They are named
 * by what they do, never numbered: "Krok 1" adds a word and no information, and
 * the reader can already see it is the first one.
 */
const STEPS = [
  {
    title: "Naklonovat a nainstalovat",
    body: "Node 20 nebo novější a pnpm. Nic dalšího.",
    lines: [
      `git clone ${REPO_URL}.git`,
      "cd Workeee",
      "pnpm install",
    ],
  },
  {
    title: "Založit deployment Convexu",
    body: "Přihlásí vás, vytvoří projekt a čtyři proměnné zapíše do .env.local samo.",
    lines: ["pnpm exec convex dev"],
  },
  {
    title: "Nastavit tajemství",
    body: "SITE_URL se musí rovnat adrese, ze které aplikaci servírujete. Jinak Better Auth odmítne přihlášení.",
    lines: [
      'pnpm exec convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"',
      "pnpm exec convex env set SITE_URL https://vase-app.vercel.app",
      "# volitelně, jinak se e-maily jen neodesílají",
      "pnpm exec convex env set BREVO_API_KEY xxx",
      "pnpm exec convex env set BREVO_SENDER_EMAIL vy@vase-domena.cz",
    ],
  },
  {
    title: "Nasadit",
    body: "Na Vercel patří jen tři veřejné proměnné. Tajemství zůstávají v Convexu, prohlížeč je nikdy neuvidí.",
    lines: [
      "NEXT_PUBLIC_CONVEX_URL",
      "NEXT_PUBLIC_CONVEX_SITE_URL",
      "NEXT_PUBLIC_SITE_URL",
    ],
  },
];

export function SelfHosting() {
  return (
    <section id="nasazeni" className="border-b border-border">
      <div className="mx-auto max-w-[84rem] px-6 py-24 lg:px-10 lg:py-36">
        <div className="grid gap-16 lg:grid-cols-12 lg:gap-10">
          <div className="min-w-0 lg:sticky lg:top-24 lg:col-span-5 lg:self-start">
            <h2
              data-enter
              className="font-heading text-[clamp(1.75rem,4.2vw,3rem)] leading-[1.05] font-bold tracking-[-0.035em]"
            >
              Nasadíte si to sami.
            </h2>
            <p
              data-enter
              className="mt-5 max-w-[32rem] text-[0.9375rem] leading-relaxed text-muted-foreground"
            >
              Vlastní Convex, vlastní Vercel, vlastní data. Čtyři kroky a
              aplikace běží, bez jediného účtu navíc.
            </p>
          </div>

          {/* `min-w-0` on both columns, and it is load-bearing rather than
              tidy: a grid item's automatic minimum size is its min-content
              size, and a `pre` full of shell commands has no wrap opportunity,
              so the column grew to the longest line and took the document with
              it. The `overflow-x-auto` on the block only contains itself once
              every ancestor agrees it may be narrower than its contents. */}
          <ol
            data-enter-stagger
            className="relative min-w-0 border-l border-border pl-8 lg:col-span-7 lg:pl-10"
          >
            {STEPS.map((step) => (
              <li
                key={step.title}
                className="relative min-w-0 pb-12 last:pb-0"
              >
                <span
                  aria-hidden
                  className="absolute top-[0.45rem] -left-8 size-1.5 rounded-[2px] bg-primary lg:-left-10"
                />
                <h3 className="text-sm font-semibold tracking-[-0.01em]">
                  {step.title}
                </h3>
                <p className="mt-2 max-w-[40rem] text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
                <div className="mt-4">
                  <CodeBlock lines={step.lines} />
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

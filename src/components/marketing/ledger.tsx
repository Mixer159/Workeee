import { Shot } from "@/components/marketing/shot";
import { REPO_LABEL, REPO_URL } from "@/lib/repo";
import { SHOTS } from "@/lib/shots";
import { cn } from "@/lib/utils";

/**
 * The numbers, scattered rather than lined up in a stat row.
 *
 * Four anchors on the corners and thirds of one quiet, mostly empty section.
 * Everything here is checkable in the repository: the licence file, the one
 * module that opens a socket, the version in `package.json`. Nothing is a
 * rounded-up marketing figure, because the audience for this page would look.
 *
 * Below `lg` the anchors stop being anchors and become a plain two-column list,
 * which is the only honest thing to do with corner placement on a phone.
 *
 * The dashboard sits underneath them, cropped by the section's bottom edge and
 * faded into it. It is under the anchors, never behind them: text over a
 * screenshot is a contrast problem waiting to happen, and this page has no
 * shortage of room.
 */
const ANCHORS = [
  {
    value: "MIT",
    label: "Licence",
    body: "Forkněte to, změňte to, nasaďte kamkoli. Žádná podmínka navíc.",
    place: "lg:col-span-3 lg:col-start-1",
    bodyPlace: "",
  },
  {
    value: "0",
    label: "Poplatků za uživatele",
    body: "Platíte svému Convexu a svému Vercelu. Nikomu jinému, tedy ani nám.",
    place: "lg:col-span-3 lg:col-start-10 lg:text-right",
    bodyPlace: "lg:ml-auto",
  },
  {
    value: "1",
    label: "Odchozí služba",
    body: "E-maily s upozorněními. Nic jiného aplikace ven nevolá.",
    place: "lg:col-span-3 lg:col-start-2",
    bodyPlace: "",
  },
  {
    value: "Next.js 16",
    label: "Convex, Better Auth",
    body: "Nic dalšího si nemusíte nikde zakládat.",
    place: "lg:col-span-4 lg:col-start-9 lg:text-right",
    bodyPlace: "lg:ml-auto",
  },
];

export function Ledger() {
  return (
    <section className="overflow-hidden border-b border-border">
      <div className="mx-auto max-w-[84rem] px-6 pt-24 lg:px-10 lg:pt-36">
        <div
          data-enter-stagger
          className="grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-12 lg:gap-y-24"
        >
          {ANCHORS.map((anchor) => (
            <div key={anchor.label} className={anchor.place}>
              <p className="font-heading text-[clamp(1.5rem,3vw,2.25rem)] leading-none font-bold tracking-[-0.035em] text-primary">
                {anchor.value}
              </p>
              <p className="mt-3 font-mono text-[0.6875rem] text-muted-foreground">
                {anchor.label}
              </p>
              <p
                className={cn(
                  "mt-3 max-w-[22rem] text-sm leading-relaxed text-muted-foreground",
                  anchor.bodyPlace,
                )}
              >
                {anchor.body}
              </p>
            </div>
          ))}
        </div>

        <p data-enter className="mt-20 font-mono text-xs text-muted-foreground">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-sm underline decoration-border underline-offset-4 transition-colors outline-none hover:text-foreground hover:decoration-primary focus-visible:ring-3 focus-visible:ring-ring/40"
          >
            {REPO_LABEL}
          </a>
        </p>
      </div>

      <div
        data-enter
        className="workeee-fade-b mx-auto mt-16 max-w-[84rem] px-6 lg:px-10"
      >
        <div className="h-[14rem] overflow-hidden rounded-t-2xl border border-b-0 border-border sm:h-[20rem] lg:h-[26rem]">
          <Shot
            shot={SHOTS.prehled}
            className="rounded-none border-0"
            sizes="(min-width: 1024px) 84rem, 100vw"
          />
        </div>
      </div>
    </section>
  );
}

import Link from "next/link";
import { Mark } from "@/components/brand/mark";
import { Button } from "@/components/ui/button";

/**
 * A root 404 renders outside the app shell, so it carries its own frame — the
 * mark, a plain Czech sentence, and the two links that get the person back:
 * into the app if they belong there, onto the public page if they do not.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-14 text-center">
      <Mark className="size-7 text-primary" />
      <div className="flex flex-col items-center gap-3">
        <h1 className="font-heading text-[1.75rem] leading-none font-bold tracking-[-0.03em]">
          Tady nic není
        </h1>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
          Stránka na této adrese neexistuje. Možná se změnila, nebo je odkaz
          přepsaný jen zčásti.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild size="lg">
          <Link href="/">Zpět do aplikace</Link>
        </Button>
        <Button asChild size="lg" variant="ghost">
          <Link href="/o-aplikaci">Co je Workeee</Link>
        </Button>
      </div>
    </div>
  );
}

import Link from "next/link";
import { Wordmark } from "@/components/layout/wordmark";
import { Button } from "@/components/ui/button";

/**
 * A root 404 renders outside the app shell, so it carries its own frame — a
 * plain Czech sentence and the one link that gets the person back.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12 text-center">
      <Wordmark className="text-lg" />
      <div className="flex flex-col items-center gap-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Tady nic není
        </h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Stránka na této adrese neexistuje. Možná se změnila, nebo je odkaz
          přepsaný jen zčásti.
        </p>
      </div>
      <Button asChild size="lg">
        <Link href="/">Zpět do aplikace</Link>
      </Button>
    </div>
  );
}

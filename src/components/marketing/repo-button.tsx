import { ArrowUpRightIcon } from "lucide-react";
import { REPO_URL } from "@/lib/repo";
import { cn } from "@/lib/utils";

/**
 * The page has one job, so it has one button, and this is it. It appears
 * exactly twice: once in the hero and once at the end of the open-source
 * section. Everything else on the page is a link.
 *
 * It is painted from `--primary`, the same token the app paints its own primary
 * action with, because the page and the app are one system now. It is taller
 * than an in-app control (44 px against 36) for the one reason a marketing
 * button is ever bigger: it is the only one on the screen.
 */
export function RepoButton({ className }: { className?: string }) {
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "group inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground",
        "transition-[background-color,transform] hover:bg-primary/85 active:translate-y-px",
        "outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        className,
      )}
    >
      Otevřít na GitHubu
      <ArrowUpRightIcon
        className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        aria-hidden
      />
    </a>
  );
}

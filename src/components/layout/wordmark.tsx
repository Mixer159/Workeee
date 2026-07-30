import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The product name. Inside the app shell it doubles as the only way back to the
 * dashboard, so it takes an `href`; on the auth and invite screens, where there
 * is nowhere to go yet, it stays plain text.
 */
export function Wordmark({
  className,
  href,
  onClick,
}: {
  className?: string;
  href?: string;
  onClick?: () => void;
}) {
  const text = "font-heading text-base font-semibold tracking-tight";

  if (href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={cn(
          text,
          "rounded-lg transition-colors outline-none hover:text-foreground/70 focus-visible:ring-3 focus-visible:ring-ring/50",
          className,
        )}
      >
        Workeee
      </Link>
    );
  }

  return <span className={cn(text, className)}>Workeee</span>;
}

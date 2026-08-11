import Link from "next/link";
import { Mark } from "@/components/brand/mark";
import { cn } from "@/lib/utils";

/**
 * The mark plus the product name. Inside the app shell it doubles as the only
 * way back to the dashboard, so it takes an `href`; on the auth, invite and
 * 404 screens, where there is nowhere to go yet, it stays plain.
 *
 * The name is set the way the public page sets it, one weight down: Switzer at
 * 700 with the tracking pulled in. The glyph takes the accent, which is the
 * only colored thing in the rail.
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
  const body = (
    <>
      <Mark className="size-[1.1em] text-primary" />
      <span className="font-heading text-[0.9375rem] font-bold tracking-[-0.03em]">
        Workeee
      </span>
    </>
  );

  const shell = "inline-flex items-center gap-2";

  if (href) {
    return (
      <Link
        href={href}
        onClick={onClick}
        className={cn(
          shell,
          "rounded-md transition-opacity outline-none hover:opacity-70 focus-visible:ring-3 focus-visible:ring-ring/50",
          className,
        )}
      >
        {body}
      </Link>
    );
  }

  return <span className={cn(shell, className)}>{body}</span>;
}

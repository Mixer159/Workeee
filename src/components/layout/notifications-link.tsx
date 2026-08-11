"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { BellIcon } from "lucide-react";
import { api } from "@convex/_generated/api";
import { UnreadBadge } from "@/components/notifications/unread-badge";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { plural } from "@convex/lib/plural";
import { cn } from "@/lib/utils";

/**
 * "Upozornění" in the rail, above the project list — the door to `/upozorneni`
 * with the unread count on it. Styled as one more row of the rail, not as a
 * bell floating in a corner: this app's chrome is the rail, so the rail is
 * where a person looks for what is new.
 */
export function NotificationsLink({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { organizationId } = useCurrentOrganization();
  const count = useQuery(
    api.notificationItems.unreadCount,
    organizationId ? { organizationId } : "skip",
  );

  if (!organizationId) {
    return null;
  }
  const active = pathname.startsWith("/upozorneni");

  return (
    <Link
      href="/upozorneni"
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-9 items-center gap-2.5 rounded-lg pr-2 pl-3 text-sm transition-colors outline-none",
        "before:absolute before:top-1/2 before:left-0 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary before:transition-opacity",
        "focus-visible:ring-3 focus-visible:ring-ring/40",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:opacity-100"
          : "text-muted-foreground before:opacity-0 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
      )}
    >
      <BellIcon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">Upozornění</span>
      <UnreadBadge
        count={count ?? 0}
        label={
          count
            ? `${count} ${plural(count, "nepřečtené upozornění", "nepřečtená upozornění", "nepřečtených upozornění")}`
            : undefined
        }
      />
    </Link>
  );
}

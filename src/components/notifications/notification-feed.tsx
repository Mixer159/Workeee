"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import {
  AtSignIcon,
  CheckCheckIcon,
  MessageCircleIcon,
  PlusIcon,
  UserRoundCheckIcon,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useNow } from "@/hooks/use-now";
import { formatRelativeTime } from "@/lib/format";
import { plural } from "@convex/lib/plural";
import { cn } from "@/lib/utils";

type FeedItem = FunctionReturnType<typeof api.notificationItems.list>[number];

/**
 * The feed behind the rail's "Upozornění": everything queued for this person in
 * the current organization, unread first by nature (a new event bubbles its row
 * back to the top). A row is a link into the task's drawer — opening it is what
 * marks it read, so there is no per-row button; the header's broom covers the
 * rest.
 */
export function NotificationFeed() {
  const { organizationId, isLoading } = useCurrentOrganization();
  const items = useQuery(
    api.notificationItems.list,
    organizationId ? { organizationId } : "skip",
  );
  const markAllRead = useMutation(api.notificationItems.markAllRead);
  const now = useNow();

  const unreadCount = (items ?? []).filter((item) => !item.read).length;

  const handleMarkAll = async () => {
    if (!organizationId) {
      return;
    }
    try {
      await markAllRead({ organizationId });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Označení se nepovedlo. Zkuste to prosím znovu.",
      );
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Upozornění"
        actions={
          unreadCount > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleMarkAll}
            >
              <CheckCheckIcon />
              Označit vše za přečtené
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <FeedSkeleton />
      ) : !organizationId ? (
        <EmptyState
          title="Žádná upozornění"
          description="Nejdřív se připojte k organizaci, nebo si založte vlastní."
        />
      ) : items === undefined ? (
        <FeedSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          title="Žádná upozornění"
          description="Nové úkoly ve vašich projektech, úkoly přiřazené vám, zmínky přes @ a komentáře k úkolům, které řešíte, se objeví tady."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const { icon: Icon, label } = itemMeta(item);
            return (
              <li key={item._id}>
                <Link
                  href={`/projekt/${item.projectId}?ukol=${item.taskId}`}
                  className={cn(
                    "flex gap-3 rounded-lg border border-border bg-card p-3 transition-colors outline-none hover:border-foreground/25 focus-visible:ring-3 focus-visible:ring-ring/40",
                    !item.read &&
                      "border-primary/35 bg-primary/[0.04] hover:border-primary/60",
                  )}
                >
                  <Icon
                    aria-hidden
                    className={cn(
                      "mt-0.5 size-4 shrink-0",
                      item.read ? "text-muted-foreground" : "text-primary",
                    )}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-baseline gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {item.taskTitle}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelativeTime(item.createdAt, now)}
                      </span>
                    </span>
                    {/* Verbless, the same rule the e-mails follow: Czech past
                        tense is gendered and a name is not a gender. */}
                    <span className="text-xs text-muted-foreground">
                      {label} · {item.actorName} · {item.projectName}
                    </span>
                    {item.preview ? (
                      <span className="mt-1 line-clamp-2 border-l-2 border-border pl-2.5 text-xs leading-relaxed text-muted-foreground">
                        {item.preview}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function itemMeta(item: FeedItem): { icon: LucideIcon; label: string } {
  switch (item.kind) {
    case "task_created":
      return { icon: PlusIcon, label: "Nový úkol" };
    case "task_assigned":
      return { icon: UserRoundCheckIcon, label: "Přiřazeno vám" };
    case "comment_mention":
      return {
        icon: AtSignIcon,
        label:
          item.count > 1
            ? `Zmínka a ${item.count - 1} ${plural(item.count - 1, "další komentář", "další komentáře", "dalších komentářů")}`
            : "Zmínka v komentáři",
      };
    case "comment_added":
      return {
        icon: MessageCircleIcon,
        label:
          item.count > 1
            ? `${item.count} ${plural(item.count, "nový komentář", "nové komentáře", "nových komentářů")}`
            : "Nový komentář",
      };
  }
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-16 w-2/3 rounded-lg" />
    </div>
  );
}

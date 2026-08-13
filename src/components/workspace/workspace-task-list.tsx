"use client";

import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ProjectIcon } from "@/components/projects/project-icon";
import { StatusDot } from "@/components/tasks/status-dot";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type WorkspaceTask = FunctionReturnType<
  typeof api.workspace.listTasks
>["items"][number];

export function WorkspaceTaskList({
  items,
  activeTaskId,
  now,
  loading,
  hasMore,
  onOpen,
  onLoadMore,
}: {
  items: WorkspaceTask[];
  activeTaskId: string | null;
  now: number;
  loading: boolean;
  hasMore: boolean;
  onOpen: (taskId: Id<"tasks">) => void;
  onLoadMore: () => void;
}) {
  if (loading) {
    return <WorkspaceTaskListSkeleton />;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-3 px-4 py-8 text-sm leading-relaxed text-muted-foreground">
        <p>Žádné úkoly tomuto výběru neodpovídají.</p>
        {hasMore ? (
          <Button type="button" variant="outline" size="sm" onClick={onLoadMore}>
            Hledat ve starších
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <ul>
        {items.map((task) => {
          const active = task._id === activeTaskId;
          return (
            <li key={task._id} className="border-b border-sidebar-border">
              <button
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onOpen(task._id)}
                className={cn(
                  "relative flex w-full flex-col gap-1.5 px-4 py-3.5 text-left transition-colors outline-none",
                  "before:absolute before:top-3 before:bottom-3 before:left-0 before:w-0.5 before:bg-primary before:transition-opacity",
                  "focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/40",
                  active
                    ? "bg-sidebar-accent/80 before:opacity-100"
                    : "before:opacity-0 hover:bg-sidebar-accent/45",
                )}
              >
                <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  <ProjectIcon
                    name={task.project.name}
                    emoji={task.project.emoji}
                    iconUrl={task.project.iconUrl}
                    className="size-4 rounded-sm text-[0.5rem]"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {task.project.name}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatRelativeTime(task.updatedAt, now)}
                  </span>
                </span>

                <span className="line-clamp-2 text-sm leading-snug font-medium text-sidebar-foreground">
                  {task.title}
                </span>

                {task.latestComment?.preview ? (
                  <span className="line-clamp-1 text-xs text-muted-foreground">
                    {task.latestComment.authorName}: {task.latestComment.preview}
                  </span>
                ) : null}

                <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                  {task.status ? (
                    <>
                      <StatusDot color={task.status.color} />
                      <span className="truncate">{task.status.name}</span>
                    </>
                  ) : (
                    <span>Bez stavu</span>
                  )}
                  {task.assignee ? (
                    <span className="ml-auto max-w-28 truncate">
                      {task.assignee.name}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {hasMore ? (
        <div className="p-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={onLoadMore}
          >
            Načíst další
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceTaskListSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 border-b border-sidebar-border px-4 py-3.5"
        >
          <Skeleton className="h-3 w-2/5" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      ))}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SquarePenIcon } from "lucide-react";
import { UserMenu } from "@/components/layout/user-menu";
import { Wordmark } from "@/components/layout/wordmark";
import { Input } from "@/components/ui/input";
import { useWorkspaceCommandMenu } from "@/components/workspace/workspace-command-menu";
import { WorkspaceTaskList } from "@/components/workspace/workspace-task-list";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useNow } from "@/hooks/use-now";
import { useWorkspace } from "@/components/workspace/workspace-provider";
import { cn } from "@/lib/utils";

type TaskScope = "all" | "mine";

/** Work mode rail: the whole useful height belongs to recent conversations. */
export function WorkspaceSidebar({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { data, activeTaskId, openTask, loadMore } = useWorkspace();
  const { openTaskCreator } = useWorkspaceCommandMenu();
  const user = useCurrentUser();
  const now = useNow();
  const [scope, setScope] = useState<TaskScope>("all");
  const [search, setSearch] = useState("");

  const items = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("cs");
    return (data?.items ?? []).filter((task) => {
      if (scope === "mine" && task.assignee?._id !== user?._id) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return [
        task.title,
        task.project.name,
        task.status?.name,
        task.latestComment?.authorName,
        task.latestComment?.preview,
      ].some((value) => value?.toLocaleLowerCase("cs").includes(needle));
    });
  }, [data?.items, scope, search, user?._id]);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-sidebar-border px-4">
        <Wordmark href="/" onClick={onNavigate} />
        <Link
          href="/"
          onClick={onNavigate}
          className="text-xs font-medium text-muted-foreground transition-colors outline-none hover:text-sidebar-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          Zpět na přehled
        </Link>
      </div>

      <div className="shrink-0 border-b border-sidebar-border p-3">
        <button
          type="button"
          onClick={() => {
            openTaskCreator();
            onNavigate?.();
          }}
          className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-sm font-medium text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-sidebar-ring/40"
        >
          <SquarePenIcon className="size-4 text-muted-foreground" />
          Nový úkol
          <kbd className="ml-auto font-mono text-[0.6875rem] text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="shrink-0 border-b border-sidebar-border p-3 pb-0">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Hledat úkol"
          aria-label="Hledat úkol"
          className="h-9 bg-transparent"
        />
        <div className="mt-2 grid grid-cols-2" aria-label="Výběr úkolů">
          <ScopeButton active={scope === "all"} onClick={() => setScope("all")}>
            Všechny
          </ScopeButton>
          <ScopeButton active={scope === "mine"} onClick={() => setScope("mine")}>
            Moje
          </ScopeButton>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <WorkspaceTaskList
          items={items}
          activeTaskId={activeTaskId}
          now={now}
          loading={data === undefined}
          hasMore={data?.hasMore ?? false}
          onOpen={(taskId) => {
            openTask(taskId);
            onNavigate?.();
          }}
          onLoadMore={loadMore}
        />
      </div>

      <div className="shrink-0 border-t border-sidebar-border p-2">
        <UserMenu />
      </div>
    </div>
  );
}

function ScopeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-8 border-b-2 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
        active
          ? "border-primary text-sidebar-foreground"
          : "border-transparent text-muted-foreground hover:text-sidebar-foreground",
      )}
    >
      {children}
    </button>
  );
}

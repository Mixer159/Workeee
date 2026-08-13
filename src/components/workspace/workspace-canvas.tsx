"use client";

import { Mark } from "@/components/brand/mark";
import { EmptyState } from "@/components/layout/empty-state";
import { Onboarding } from "@/components/organizations/onboarding";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { useWorkspace } from "@/components/workspace/workspace-provider";

/** The large middle surface: one selected task, with no project hop first. */
export function WorkspaceCanvas() {
  const { organizations, organization, isLoading } = useCurrentOrganization();
  const { data, activeTaskId, closeTask } = useWorkspace();

  if (isLoading) {
    return <WorkspaceCanvasSkeleton />;
  }

  if (!organizations || organizations.length === 0 || !organization) {
    return (
      <div className="h-full overflow-y-auto px-4 py-8 lg:px-8 lg:py-10">
        <div className="mx-auto w-full max-w-6xl">
          <Onboarding />
        </div>
      </div>
    );
  }

  if (data === undefined) {
    return <WorkspaceCanvasSkeleton />;
  }

  if (data.items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 lg:p-10">
        <EmptyState
          title="Zatím tu nejsou žádné úkoly"
          description="Vraťte se na přehled, otevřete projekt a přidejte první úkol. Pak už se bude řešit tady."
          className="w-full max-w-2xl"
        />
      </div>
    );
  }

  if (!activeTaskId) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div className="flex max-w-sm flex-col items-center gap-4">
          <Mark className="size-8 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">Vyberte úkol vlevo</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Detail, přílohy i komentáře se otevřou tady.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TaskDetailPanel
      key={activeTaskId}
      taskId={activeTaskId}
      onClose={closeTask}
      mode="workspace"
    />
  );
}

function WorkspaceCanvasSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center border-b px-6">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 py-10">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    </div>
  );
}

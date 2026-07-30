"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { SettingsIcon } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { EmptyState } from "@/components/layout/empty-state";
import { ProjectIcon } from "@/components/projects/project-icon";
import { ProjectSettingsDialog } from "@/components/projects/project-settings-dialog";
import { TaskBoard } from "@/components/tasks/task-board";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrganization } from "@/hooks/use-current-organization";

/** The open task lives in the address, so a task is still a link. */
const TASK_PARAM = "ukol";

export function ProjectScreen({ projectId }: { projectId: string }) {
  const project = useQuery(api.projects.get, { projectId });
  const { organizationId, setOrganizationId } = useCurrentOrganization();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const searchParams = useSearchParams();
  // Read once: from here on the drawer is opened by clicking a card, and the
  // address is rewritten to match. The page is keyed by the project, so
  // switching projects mounts this fresh.
  const [openTaskId, setOpenTaskId] = useState<string | null>(() =>
    searchParams.get(TASK_PARAM),
  );

  // Shallow history writes, not a navigation: the panel opens on the same page
  // and instantly, and the address stays copy-pasteable.
  const openTask = useCallback((taskId: Id<"tasks">) => {
    setOpenTaskId(taskId);
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${TASK_PARAM}=${taskId}`,
    );
  }, []);

  const closeTask = useCallback(() => {
    setOpenTaskId(null);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  // Opening a project link from another organization (an accepted invite, a
  // bookmark) switches the shell over instead of showing a mismatched sidebar.
  const projectOrganizationId = project?.organizationId;
  useEffect(() => {
    if (projectOrganizationId && projectOrganizationId !== organizationId) {
      setOrganizationId(projectOrganizationId);
    }
  }, [projectOrganizationId, organizationId, setOrganizationId]);

  if (project === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-80" />
      </div>
    );
  }

  if (project === null) {
    return (
      <EmptyState
        title="Projekt není dostupný"
        description="Buď neexistuje, nebo k němu nemáte přístup. Zkuste odkaz znovu, nebo požádejte správce organizace."
      >
        <Button asChild size="lg" variant="outline">
          <Link href="/">Zpět na projekty</Link>
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <ProjectIcon
          seed={project._id}
          name={project.name}
          emoji={project.emoji}
          iconUrl={project.iconUrl}
          className="size-9 rounded-lg text-base"
        />
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {project.name}
        </h1>
        {project.archived ? <Badge variant="outline">Archivovaný</Badge> : null}
        {project.canManage ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="ml-auto"
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon />
            Nastavení
          </Button>
        ) : null}
      </div>

      <TaskBoard
        projectId={project._id}
        selectedTaskId={openTaskId}
        onOpenTask={openTask}
      />

      <TaskDrawer taskId={openTaskId} onClose={closeTask} />

      {project.canManage ? (
        <ProjectSettingsDialog
          project={project}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      ) : null}
    </div>
  );
}

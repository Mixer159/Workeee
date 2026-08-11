"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  UnreadBadge,
  unreadTasksLabel,
} from "@/components/notifications/unread-badge";
import { ProjectIcon } from "@/components/projects/project-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { cn } from "@/lib/utils";

/**
 * The project list in the rail.
 *
 * No visible heading on purpose — the word "Projekty" belongs to the dashboard,
 * and a caption here would put it on the screen twice. The create action *is*
 * in the rail, but as its own component below this list
 * (`projects/new-project-button.tsx`), so this file stays a list of links.
 *
 * The open project is marked by a short accent rule in the left padding, not by
 * a colored dot: the rule is the one place the brand color appears in the rail,
 * and it says "you are here" without adding a shape to the row.
 */
export function ProjectsNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { organizationId } = useCurrentOrganization();
  const projects = useQuery(
    api.projects.listVisible,
    organizationId ? { organizationId } : "skip",
  );
  const unread = useQuery(
    api.taskSeen.unreadByOrganization,
    organizationId ? { organizationId } : "skip",
  );
  const unreadByProject = new Map(
    (unread ?? []).map((entry) => [entry.projectId, entry.count]),
  );

  if (!organizationId) {
    return null;
  }

  return (
    <nav aria-label="Projekty" className="flex flex-col gap-0.5">
      {projects === undefined ? (
        <div className="flex flex-col gap-1">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-4/5" />
        </div>
      ) : projects.length === 0 ? (
        // Silence on purpose — the dashboard is where "you have no projects
        // yet" is explained, and saying it twice on one screen is noise.
        null
      ) : (
        <ul className="flex flex-col gap-0.5">
          {projects.map((project) => {
            const href = `/projekt/${project._id}`;
            const active = pathname.startsWith(href);
            return (
              <li key={project._id}>
                <Link
                  href={href}
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
                  <ProjectIcon
                    name={project.name}
                    emoji={project.emoji}
                    iconUrl={project.iconUrl}
                    className={cn(
                      "transition-opacity",
                      active ? "opacity-100" : "opacity-80",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  <UnreadBadge
                    count={unreadByProject.get(project._id) ?? 0}
                    label={unreadTasksLabel(unreadByProject.get(project._id) ?? 0)}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}

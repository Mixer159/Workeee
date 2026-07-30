"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
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
 */
export function ProjectsNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { organizationId } = useCurrentOrganization();
  const projects = useQuery(
    api.projects.listVisible,
    organizationId ? { organizationId } : "skip",
  );

  if (!organizationId) {
    return null;
  }

  return (
    <nav aria-label="Projekty" className="flex flex-col gap-0.5">
      {projects === undefined ? (
        <div className="flex flex-col gap-1">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
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
                    "flex h-8 items-center gap-2 rounded-lg px-2 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                  )}
                >
                  <ProjectIcon
                    seed={project._id}
                    name={project.name}
                    emoji={project.emoji}
                    iconUrl={project.iconUrl}
                  />
                  <span className="truncate">{project.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}

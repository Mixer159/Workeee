"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { ArrowUpRightIcon } from "lucide-react";
import { api } from "@convex/_generated/api";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import {
  UnreadBadge,
  unreadTasksLabel,
} from "@/components/notifications/unread-badge";
import { Onboarding } from "@/components/organizations/onboarding";
import { ProjectIcon } from "@/components/projects/project-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrganization } from "@/hooks/use-current-organization";

/**
 * The first screen after signing in: every project of the current organization
 * as a card. It lives at `/` — the base URL is the application; the public
 * landing page is at `/o-aplikaci`.
 *
 * A `limited` member sees exactly the projects they were invited to — the list
 * comes from `projects.listVisible`, the same query the sidebar reads, so the
 * two can never disagree.
 *
 * Creating a project is *not* an action of this page: it lives at the foot of
 * the project list in the rail, where it is reachable from every screen instead
 * of only this one. Two buttons would also put "Nový projekt" on the screen
 * twice.
 */
export default function DashboardPage() {
  const { organizations, organization, organizationId, isLoading } =
    useCurrentOrganization();
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

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!organizations || organizations.length === 0 || !organization) {
    return <Onboarding />;
  }

  const canCreate = organization.access === "full";

  return (
    <section className="flex flex-col gap-8">
      <PageHeader title="Projekty" />

      {projects === undefined ? (
        <ProjectGridSkeleton />
      ) : projects.length === 0 ? (
        <EmptyState
          title="Zatím tu nic není"
          description={
            canCreate
              ? "Založte projekt tlačítkem „Nový projekt“ v levém panelu a pak do něj pozvěte lidi."
              : "Nemáte přístup k žádnému projektu. Ozvěte se správci organizace."
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <li key={project._id}>
              <Link
                href={`/projekt/${project._id}`}
                className="group flex h-full flex-col gap-6 rounded-xl border border-border bg-card p-4 transition-colors outline-none hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <ProjectIcon
                    name={project.name}
                    emoji={project.emoji}
                    iconUrl={project.iconUrl}
                    className="size-10 rounded-lg text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <UnreadBadge
                      count={unreadByProject.get(project._id) ?? 0}
                      label={unreadTasksLabel(
                        unreadByProject.get(project._id) ?? 0,
                      )}
                    />
                    {/* The affordance, not a decoration: it only moves when the
                        card is the thing under the pointer. */}
                    <ArrowUpRightIcon className="size-4 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary group-hover:opacity-100 group-focus-visible:opacity-100" />
                  </div>
                </div>
                <span className="text-sm leading-snug font-medium break-words">
                  {project.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProjectGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Skeleton className="h-[7.5rem] w-full rounded-xl" />
      <Skeleton className="h-[7.5rem] w-full rounded-xl" />
      <Skeleton className="h-[7.5rem] w-full rounded-xl" />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="border-b border-border pb-5">
        <Skeleton className="h-7 w-44" />
      </div>
      <ProjectGridSkeleton />
    </div>
  );
}

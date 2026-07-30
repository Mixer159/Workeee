"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { EmptyState } from "@/components/layout/empty-state";
import { Onboarding } from "@/components/organizations/onboarding";
import { ProjectIcon } from "@/components/projects/project-icon";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrganization } from "@/hooks/use-current-organization";

/**
 * The landing surface: every project of the current organization as a card.
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

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (!organizations || organizations.length === 0 || !organization) {
    return <Onboarding />;
  }

  const canCreate = organization.access === "full";

  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">
        Projekty
      </h1>

      {projects === undefined ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
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
                className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4 transition-colors outline-none hover:border-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <ProjectIcon
                  seed={project._id}
                  name={project.name}
                  emoji={project.emoji}
                  iconUrl={project.iconUrl}
                  className="size-9 rounded-lg text-base"
                />
                <span className="text-sm font-medium break-words">
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

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-40" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    </div>
  );
}

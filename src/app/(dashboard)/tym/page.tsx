"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { MembersTable } from "@/components/organizations/members-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrganization } from "@/hooks/use-current-organization";

/**
 * Kdo tu je. The same members list the organization settings show, without the
 * manager guard and without anything to click: seeing colleagues is not an
 * administrative act. `canManage={false}` is what drops the role select and the
 * remove button, which is the whole difference between the two screens.
 */
export default function TeamPage() {
  const { organizationId } = useCurrentOrganization();
  const organization = useQuery(
    api.organizations.get,
    organizationId ? { organizationId } : "skip",
  );

  if (!organizationId) {
    return (
      <EmptyState
        title="Žádná organizace"
        description="Nejdřív nějakou založte, nebo se připojte k existující."
      >
        <Button asChild size="lg" variant="outline">
          <Link href="/">Zpět na projekty</Link>
        </Button>
      </EmptyState>
    );
  }

  if (organization === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (organization === null) {
    return (
      <EmptyState
        title="Organizace není dostupná"
        description="Buď neexistuje, nebo v ní už nejste členem."
      >
        <Button asChild size="lg" variant="outline">
          <Link href="/">Zpět na projekty</Link>
        </Button>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Tým" />
      <MembersTable
        organizationId={organizationId}
        canManage={false}
        viewerRole={organization.role}
      />
    </div>
  );
}

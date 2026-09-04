"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Id } from "@convex/_generated/dataModel";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { readStoredOrganizationId } from "@/lib/current-organization";

/** Adopt a project link's organization until the user selects another one. */
export function useProjectOrganization(
  projectOrganizationId: Id<"organizations"> | undefined,
) {
  const { organizationId, setOrganizationId } = useCurrentOrganization();
  const router = useRouter();
  const expectedStoredId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const storedId = readStoredOrganizationId();
    if (expectedStoredId.current === undefined) {
      expectedStoredId.current = storedId;
    }

    // A later selection wins, including while the project query is loading
    // and when it comes from another tab. Never write the old project back.
    if (storedId !== expectedStoredId.current) {
      router.replace("/");
      return;
    }

    if (projectOrganizationId && projectOrganizationId !== organizationId) {
      expectedStoredId.current = projectOrganizationId;
      setOrganizationId(projectOrganizationId);
    }
  }, [projectOrganizationId, organizationId, setOrganizationId, router]);
}

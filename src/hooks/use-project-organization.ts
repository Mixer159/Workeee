"use client";

import { useEffect, useRef } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { readStoredOrganizationId } from "@/lib/current-organization";

/** Adopt a project link's organization until the user selects another one. */
export function useProjectOrganization(
  projectOrganizationId: Id<"organizations"> | undefined,
) {
  const { organizationId, setOrganizationId } = useCurrentOrganization();
  const expectedStoredId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const storedId = readStoredOrganizationId();
    if (expectedStoredId.current === undefined) {
      expectedStoredId.current = storedId;
    }

    // The switcher owns navigation. A late project response must not undo
    // a selection made while this page is still mounted.
    if (storedId !== expectedStoredId.current) {
      return;
    }

    if (projectOrganizationId && projectOrganizationId !== organizationId) {
      expectedStoredId.current = projectOrganizationId;
      setOrganizationId(projectOrganizationId);
    }
  }, [projectOrganizationId, organizationId, setOrganizationId]);
}

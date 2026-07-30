"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { useCurrentOrganization } from "@/hooks/use-current-organization";

/**
 * "Nový projekt" at the foot of the project list in the rail.
 *
 * The dashed outline says the row is a slot, not a project: it sits in the same
 * column as the links but never reads as one of them. It is the only create
 * action in the app — the dashboard used to carry a second one, which put the
 * same label twice on the same screen and still left the action out of reach
 * from every other page.
 *
 * Only a `full` member sees it: a `limited` member may not create a project
 * (they would immediately lose sight of what they just made), and the server
 * refuses it either way.
 */
export function NewProjectButton({ onNavigate }: { onNavigate?: () => void }) {
  const { organization, organizationId } = useCurrentOrganization();
  const [open, setOpen] = useState(false);

  if (!organizationId || organization?.access !== "full") {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-full items-center gap-2 rounded-lg border border-dashed border-sidebar-border px-2 text-sm text-muted-foreground transition-colors outline-none hover:border-foreground/25 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <PlusIcon className="size-4 shrink-0" />
        <span className="truncate">Nový projekt</span>
      </button>

      <CreateProjectDialog
        organizationId={organizationId}
        open={open}
        onOpenChange={setOpen}
        onCreated={onNavigate}
      />
    </>
  );
}

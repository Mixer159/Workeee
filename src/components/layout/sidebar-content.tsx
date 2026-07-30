"use client";

import { Wordmark } from "@/components/layout/wordmark";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { ProjectsNav } from "@/components/layout/projects-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { NewProjectButton } from "@/components/projects/new-project-button";
import { Separator } from "@/components/ui/separator";

/**
 * Shared sidebar body — rendered inside the fixed desktop rail and inside the
 * mobile drawer. `onNavigate` lets the drawer close itself when a link is
 * followed; on desktop it is absent.
 */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-4 p-3">
      <div className="flex flex-col gap-3">
        <Wordmark href="/" className="px-2 pt-1" onClick={onNavigate} />
        <OrganizationSwitcher onNavigate={onNavigate} />
      </div>
      <Separator />
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        <ProjectsNav onNavigate={onNavigate} />
        <NewProjectButton onNavigate={onNavigate} />
      </div>
      <Separator />
      <UserMenu />
    </div>
  );
}

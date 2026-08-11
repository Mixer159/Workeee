"use client";

import { Wordmark } from "@/components/layout/wordmark";
import { NotificationsLink } from "@/components/layout/notifications-link";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { ProjectsNav } from "@/components/layout/projects-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { NewProjectButton } from "@/components/projects/new-project-button";

/**
 * Shared rail body — rendered inside the fixed desktop rail and inside the
 * mobile drawer. `onNavigate` lets the drawer close itself when a link is
 * followed; on desktop it is absent.
 *
 * The rail is divided by hairlines rather than by `Separator` elements with
 * gaps around them: a rule that runs the full width reads as a panel with
 * compartments, a rule inset by the padding reads as a decoration. The
 * wordmark row is the same height as the mobile top bar, so the two line up
 * when the drawer is open over it.
 */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-4">
        <Wordmark href="/" onClick={onNavigate} />
      </div>

      <div className="border-b border-sidebar-border p-3">
        <OrganizationSwitcher onNavigate={onNavigate} />
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {/* Above the projects, not among them: what is new comes before where
            to go, and the row must never read as one more project. */}
        <NotificationsLink onNavigate={onNavigate} />
        <ProjectsNav onNavigate={onNavigate} />
        <NewProjectButton onNavigate={onNavigate} />
      </div>

      <div className="border-t border-sidebar-border p-2">
        <UserMenu />
      </div>
    </div>
  );
}

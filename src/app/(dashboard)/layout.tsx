import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/auth-guard";
import { AppShell } from "@/components/layout/app-shell";
import { OrganizationProvider } from "@/components/providers/organization-provider";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <OrganizationProvider>
        <AppShell>{children}</AppShell>
      </OrganizationProvider>
    </AuthGuard>
  );
}

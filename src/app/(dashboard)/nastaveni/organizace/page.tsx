"use client";

import { PageHeader } from "@/components/layout/page-header";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import { NameForm } from "@/components/forms/name-form";
import { InvitesPanel } from "@/components/invites/invites-panel";
import { EmptyState } from "@/components/layout/empty-state";
import { DeleteOrganizationDialog } from "@/components/organizations/delete-organization-dialog";
import { MembersTable } from "@/components/organizations/members-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrganization } from "@/hooks/use-current-organization";
import { storeOrganizationId } from "@/lib/current-organization";

export default function OrganizationSettingsPage() {
  const router = useRouter();
  const { organizationId } = useCurrentOrganization();
  const organization = useQuery(
    api.organizations.get,
    organizationId ? { organizationId } : "skip",
  );
  const rename = useMutation(api.organizations.rename);
  const [deleting, setDeleting] = useState(false);

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

  if (!organization.canManage) {
    return (
      <EmptyState
        title="Nemáte oprávnění"
        description="Tohle nastavení může měnit jen vlastník nebo správce."
      >
        <Button asChild size="lg" variant="outline">
          <Link href="/">Zpět na projekty</Link>
        </Button>
      </EmptyState>
    );
  }

  const handleRename = async (name: string) => {
    try {
      await rename({ organizationId, name });
      toast.success("Název organizace byl uložen.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Název se nepovedlo uložit.",
      );
    }
  };

  // The organization the shell was scoped to no longer exists: forget the stored
  // preference and go to the dashboard, which either shows another organization
  // or the onboarding screen.
  const handleDeleted = () => {
    storeOrganizationId(null);
    router.push("/");
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Nastavení organizace" />

      <Card className="[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle>Obecné</CardTitle>
        </CardHeader>
        <CardContent>
          <NameForm
            key={organization.name}
            label="Název"
            initialName={organization.name}
            onSubmit={handleRename}
          />
        </CardContent>
      </Card>

      <Card className="[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle>Členové</CardTitle>
          <CardDescription>
            Přístup „Celá organizace“ znamená všechny projekty včetně budoucích.
            „Jen vybrané projekty“ platí pro ty, které jsou vypsané u člena.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MembersTable
            organizationId={organizationId}
            canManage
            viewerRole={organization.role}
          />
        </CardContent>
      </Card>

      <Card className="[--card-spacing:--spacing(6)]">
        <CardHeader>
          <CardTitle>Pozvánky</CardTitle>
          <CardDescription>
            Pozvánka do organizace dává přístup ke všem projektům. Pozvánku jen
            do jednoho projektu vytvoříte v nastavení daného projektu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InvitesPanel organizationId={organizationId} />
        </CardContent>
      </Card>

      {organization.canDelete ? (
        <>
          <Card className="border-destructive/40 [--card-spacing:--spacing(6)]">
            <CardHeader>
              <CardTitle>Nevratná akce</CardTitle>
              <CardDescription>
                Zmizí všechny projekty, úkoly, přílohy i komentáře a ostatní
                členové ztratí přístup.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="destructive"
                size="lg"
                onClick={() => setDeleting(true)}
              >
                Smazat organizaci
              </Button>
            </CardContent>
          </Card>

          <DeleteOrganizationDialog
            organizationId={organizationId}
            name={organization.name}
            open={deleting}
            onOpenChange={setDeleting}
            onDeleted={handleDeleted}
          />
        </>
      ) : null}
    </div>
  );
}

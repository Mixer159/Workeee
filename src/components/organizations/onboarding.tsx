"use client";

import { CreateOrganizationForm } from "@/components/organizations/create-organization-form";
import { JoinOrganizationForm } from "@/components/organizations/join-organization-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * What an authenticated user without a single membership sees instead of the
 * dashboard. Two ways in, nothing else.
 */
export function Onboarding() {
  return (
    <div className="flex flex-col gap-6">
      {/* No lead paragraph: it could only repeat what the two cards below
          already say, and the wordmark in the rail already names the product. */}
      <h1 className="font-heading text-[1.75rem] leading-none font-bold tracking-[-0.03em]">
        Začínáme
      </h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="[--card-spacing:--spacing(6)]">
          <CardHeader>
            <CardTitle>Vytvořit organizaci</CardTitle>
            <CardDescription>
              Stanete se jejím vlastníkem a můžete zvát další lidi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateOrganizationForm submitLabel="Vytvořit" />
          </CardContent>
        </Card>

        <Card className="[--card-spacing:--spacing(6)]">
          <CardHeader>
            <CardTitle>Připojit se pomocí kódu</CardTitle>
            <CardDescription>
              Kód nebo odkaz vám pošle správce organizace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <JoinOrganizationForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { storeOrganizationId } from "@/lib/current-organization";
import { formatDateTime } from "@/lib/format";

/**
 * Public invite landing page. Everything shown here comes from
 * `invites.getByCode`, which is deliberately readable without an account and
 * returns display copy only.
 */
export function JoinScreen({ code }: { code: string }) {
  const router = useRouter();
  const invite = useQuery(api.invites.getByCode, { code });
  const { isLoading, isAuthenticated } = useConvexAuth();
  const accept = useMutation(api.invites.accept);
  const [pending, setPending] = useState(false);

  const handleAccept = async () => {
    if (pending) {
      return;
    }
    setPending(true);
    try {
      const { organizationId, projectId } = await accept({ code });
      storeOrganizationId(organizationId);
      toast.success("Pozvánka přijata.");
      router.push(projectId ? `/projekt/${projectId}` : "/");
    } catch (error) {
      setPending(false);
      toast.error(
        error instanceof Error ? error.message : "Pozvánku se nepovedlo přijmout.",
      );
    }
  };

  if (invite === undefined) {
    return (
      <Card className="[--card-spacing:--spacing(6)]">
        <CardHeader>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (invite === null) {
    return (
      <JoinMessage
        title="Pozvánka neexistuje"
        description="Zkontrolujte odkaz nebo kód. Možná byl přepsaný jen zčásti."
      />
    );
  }

  if (invite.revoked) {
    return (
      <JoinMessage
        title="Pozvánka byla zrušena"
        description="Požádejte správce organizace o novou."
      />
    );
  }

  if (invite.expired) {
    return (
      <JoinMessage
        title="Platnost pozvánky vypršela"
        description={`Pozvánka platila do ${formatDateTime(invite.expiresAt)}. Požádejte správce organizace o novou.`}
      />
    );
  }

  if (invite.used) {
    return (
      <JoinMessage
        title="Pozvánka už byla použita"
        description="Požádejte správce organizace o novou."
      />
    );
  }

  const target = invite.projectName
    ? `do projektu ${invite.projectName} v organizaci ${invite.organizationName}`
    : `do organizace ${invite.organizationName}`;
  const title = invite.inviterName
    ? `${invite.inviterName} vás zve ${target}`
    : `Pozvánka ${target}`;

  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {invite.projectName
            ? "Uvidíte jen tento projekt, nic dalšího z organizace."
            : "Uvidíte všechny projekty organizace, i ty budoucí."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading ? (
          <Skeleton className="h-9 w-full" />
        ) : isAuthenticated ? (
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={pending}
            onClick={handleAccept}
          >
            {pending ? (
              <>
                <Loader2Icon className="animate-spin" />
                Přijímám…
              </>
            ) : (
              "Přijmout pozvánku"
            )}
          </Button>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Po přihlášení vás vrátíme zpátky sem.
            </p>
            <Button asChild size="lg" className="w-full">
              <Link href={`/registrace?invite=${encodeURIComponent(code)}`}>
                Vytvořit účet
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full">
              <Link href={`/prihlaseni?invite=${encodeURIComponent(code)}`}>
                Přihlásit se
              </Link>
            </Button>
          </>
        )}
        <p className="text-xs text-muted-foreground">
          Platnost do {formatDateTime(invite.expiresAt)}.
        </p>
      </CardContent>
    </Card>
  );
}

function JoinMessage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild size="lg" variant="outline" className="w-full">
          <Link href="/">Zpět do aplikace</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

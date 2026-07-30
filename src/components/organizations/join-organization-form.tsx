"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentOrganization } from "@/hooks/use-current-organization";

/**
 * Redeem an invite code typed by hand. The link variant of the same flow lives
 * on `/join/[code]`.
 */
export function JoinOrganizationForm({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const fieldId = useId();
  const accept = useMutation(api.invites.accept);
  const { setOrganizationId } = useCurrentOrganization();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    try {
      const { organizationId, projectId } = await accept({ code });
      setOrganizationId(organizationId);
      setCode("");
      toast.success("Pozvánka přijata.");
      onDone?.();
      router.push(projectId ? `/projekt/${projectId}` : "/");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Pozvánku se nepovedlo přijmout.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId}>Kód pozvánky</Label>
        <Input
          id={fieldId}
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="NAPR12CD34"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          required
          className="h-9 font-mono tracking-widest"
        />
      </div>
      <Button type="submit" size="lg" variant="outline" disabled={pending}>
        {pending ? (
          <>
            <Loader2Icon className="animate-spin" />
            Připojuji…
          </>
        ) : (
          "Připojit se"
        )}
      </Button>
    </form>
  );
}

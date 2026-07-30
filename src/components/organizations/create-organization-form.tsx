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

export function CreateOrganizationForm({
  onDone,
  autoFocus = false,
  submitLabel = "Vytvořit organizaci",
}: {
  onDone?: () => void;
  autoFocus?: boolean;
  submitLabel?: string;
}) {
  const router = useRouter();
  const fieldId = useId();
  const createOrganization = useMutation(api.organizations.create);
  const { setOrganizationId } = useCurrentOrganization();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    try {
      const { organizationId } = await createOrganization({ name });
      setOrganizationId(organizationId);
      setName("");
      toast.success("Organizace je založená.");
      onDone?.();
      router.push("/");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Organizaci se nepovedlo založit.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId}>Název</Label>
        <Input
          id={fieldId}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Např. Studio Novák"
          maxLength={60}
          required
          autoFocus={autoFocus}
          className="h-9"
        />
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? (
          <>
            <Loader2Icon className="animate-spin" />
            Zakládám…
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
}

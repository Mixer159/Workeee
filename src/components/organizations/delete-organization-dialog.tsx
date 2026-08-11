"use client";

import { useId, useState } from "react";
import { useMutation } from "convex/react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { isSameName } from "@convex/lib/validation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The one action in the app with no undo, so it asks for the name to be typed
 * out. `isSameName` comes from the mutation's own module — the button and the
 * server agree on what counts as a match, and the confirmation can never be
 * satisfied by something `organizations.remove` would then refuse.
 */
export function DeleteOrganizationDialog({
  organizationId,
  name,
  open,
  onOpenChange,
  onDeleted,
}: {
  organizationId: Id<"organizations">;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const fieldId = useId();
  const removeOrganization = useMutation(api.organizations.remove);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const confirmed = isSameName(typed, name);

  const handleDelete = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || !confirmed) {
      return;
    }
    setPending(true);
    try {
      await removeOrganization({ organizationId, name: typed });
      toast.success(`Organizace ${name} byla smazána.`);
      onOpenChange(false);
      onDeleted();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Organizaci se nepovedlo smazat.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setTyped("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleDelete} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Smazat organizaci {name}</DialogTitle>
            <DialogDescription>
              Zmizí všechny projekty, úkoly, přílohy i komentáře a všichni
              členové ztratí přístup. Tohle nejde vrátit zpět.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fieldId}>Pro potvrzení napište {name}</Label>
            <Input
              id={fieldId}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => onOpenChange(false)}
            >
              Zrušit
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="lg"
              disabled={pending || !confirmed}
            >
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              Smazat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

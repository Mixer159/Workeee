"use client";

import { JoinOrganizationForm } from "@/components/organizations/join-organization-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function JoinOrganizationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Připojit se kódem</DialogTitle>
          <DialogDescription>
            Zadejte kód z pozvánky. Odkaz z pozvánky funguje také.
          </DialogDescription>
        </DialogHeader>
        <JoinOrganizationForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

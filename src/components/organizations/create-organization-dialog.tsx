"use client";

import { CreateOrganizationForm } from "@/components/organizations/create-organization-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function CreateOrganizationDialog({
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
          <DialogTitle>Nová organizace</DialogTitle>
          <DialogDescription>
            Stanete se jejím vlastníkem a můžete zvát další lidi.
          </DialogDescription>
        </DialogHeader>
        <CreateOrganizationForm
          autoFocus
          submitLabel="Vytvořit"
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

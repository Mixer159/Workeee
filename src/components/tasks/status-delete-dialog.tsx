"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { StatusDot } from "@/components/tasks/status-dot";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BoardStatus } from "@/lib/tasks";

/**
 * Delete a custom column. Tasks are never dropped with it — the target column
 * is part of the confirmation, and the server refuses without one.
 */
export function StatusDeleteDialog({
  status,
  otherStatuses,
  taskCount,
  open,
  onOpenChange,
}: {
  status: BoardStatus;
  otherStatuses: BoardStatus[];
  taskCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const removeStatus = useMutation(api.taskStatuses.remove);
  const [targetId, setTargetId] = useState<Id<"taskStatuses"> | undefined>(
    otherStatuses[0]?._id,
  );
  const [pending, setPending] = useState(false);

  const handleDelete = async () => {
    if (pending || !targetId) {
      return;
    }
    setPending(true);
    try {
      await removeStatus({ statusId: status._id, moveTasksToStatusId: targetId });
      toast.success("Stav byl smazán.");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Stav se nepovedlo smazat.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Smazat stav {status.name}</DialogTitle>
          <DialogDescription>
            {taskCount > 0
              ? "Úkoly v tomto stavu se přesunou jinam, nic se nesmaže."
              : "Ve stavu nejsou žádné úkoly."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-2">
          <Label>Přesunout úkoly do</Label>
          <Select
            value={targetId}
            onValueChange={(value) => setTargetId(value as Id<"taskStatuses">)}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Vyberte stav" />
            </SelectTrigger>
            <SelectContent>
              {otherStatuses.map((option) => (
                <SelectItem key={option._id} value={option._id}>
                  <StatusDot color={option.color} />
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            type="button"
            variant="destructive"
            size="lg"
            disabled={pending || !targetId}
            onClick={handleDelete}
          >
            {pending ? <Loader2Icon className="animate-spin" /> : null}
            Smazat stav
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

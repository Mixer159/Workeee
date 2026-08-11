"use client";

import { useId, useState } from "react";
import { useMutation } from "convex/react";
import { CheckIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
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
import {
  TASK_STATUS_COLORS,
  TASK_STATUS_COLOR_LABEL,
  TASK_STATUS_DOT_CLASS,
  TASK_STATUS_TEMPLATES,
  type TaskStatusColor,
} from "@/lib/task-status-colors";
import type { BoardStatus } from "@/lib/tasks";
import { cn } from "@/lib/utils";

/**
 * Add a column, or rename and recolor an existing one. Mounted only while it is
 * open, so it always opens with the values of the status it was opened for.
 */
export function StatusFormDialog({
  projectId,
  status,
  open,
  onOpenChange,
}: {
  projectId: Id<"projects">;
  status: BoardStatus | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const fieldId = useId();
  const createStatus = useMutation(api.taskStatuses.create);
  const updateStatus = useMutation(api.taskStatuses.update);
  const [name, setName] = useState(status?.name ?? "");
  const [color, setColor] = useState<TaskStatusColor>(status?.color ?? "gray");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    try {
      if (status) {
        await updateStatus({ statusId: status._id, name, color });
        toast.success("Stav byl upraven.");
      } else {
        await createStatus({ projectId, name, color });
        toast.success("Stav byl přidán.");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Stav se nepovedlo uložit.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{status ? "Upravit stav" : "Nový stav"}</DialogTitle>
          <DialogDescription>
            Stav je sloupec na nástěnce projektu.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fieldId}>Název</Label>
            <Input
              id={fieldId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Barva</Label>
            <div className="flex flex-wrap gap-1.5">
              {TASK_STATUS_COLORS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-label={TASK_STATUS_COLOR_LABEL[option]}
                  aria-pressed={color === option}
                  onClick={() => setColor(option)}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg border border-border transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                    color === option ? "border-primary bg-primary/10" : "hover:bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded-[3px] text-background",
                      TASK_STATUS_DOT_CLASS[option],
                    )}
                  >
                    {color === option ? (
                      <CheckIcon className="size-3" />
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {status ? null : (
            <div className="flex flex-col gap-2">
              <Label>Rychlá volba</Label>
              <div className="flex flex-wrap gap-1.5">
                {TASK_STATUS_TEMPLATES.map((template) => (
                  <button
                    key={template.name}
                    type="button"
                    onClick={() => {
                      setName(template.name);
                      setColor(template.color);
                    }}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium transition-colors outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/40"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "size-2 rounded-[2px]",
                        TASK_STATUS_DOT_CLASS[template.color],
                      )}
                    />
                    {template.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => onOpenChange(false)}
            >
              Zrušit
            </Button>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              {status ? "Uložit" : "Přidat stav"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

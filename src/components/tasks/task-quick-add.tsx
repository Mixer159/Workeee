"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Input } from "@/components/ui/input";

/**
 * The bottom of every column: one line, Enter saves and stays open for the next
 * task, Escape closes. Success is silent — the new card is the feedback.
 */
export function TaskQuickAdd({
  projectId,
  statusId,
  statusName,
}: {
  projectId: Id<"projects">;
  statusId: Id<"taskStatuses">;
  statusName: string;
}) {
  const createTask = useMutation(api.tasks.create);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || title.trim().length === 0) {
      return;
    }
    setPending(true);
    try {
      await createTask({ projectId, statusId, title });
      setTitle("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Úkol se nepovedlo přidat.",
      );
    } finally {
      setPending(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center gap-1.5 rounded-lg px-3 text-sm text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <PlusIcon className="size-4" />
        Přidat úkol
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Input
        value={title}
        autoFocus
        disabled={pending}
        maxLength={200}
        aria-label={`Nový úkol ve stavu ${statusName}`}
        placeholder="Název úkolu"
        className="h-9"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            // Escape closes this line, not the task drawer that may be open
            // beside the board and listens for it on the document.
            event.preventDefault();
            event.stopPropagation();
            setTitle("");
            setOpen(false);
          }
        }}
        onBlur={() => {
          if (title.trim().length === 0) {
            setOpen(false);
          }
        }}
      />
    </form>
  );
}

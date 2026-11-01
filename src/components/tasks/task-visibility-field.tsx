"use client";

import { useMutation } from "convex/react";
import { ChevronDownIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { HideFromMenu } from "@/components/tasks/hide-from-menu";
import { Label } from "@/components/ui/label";
import type { SaveState } from "@/lib/save-state";
import {
  hiddenSummary,
  hideOptions,
  type VisibilityMember,
} from "@/lib/task-visibility";

/**
 * "Viditelnost" in the task detail, beside Stav and Řešitel. Every toggle
 * writes on its own, one person at a time, and reports into the panel's one
 * save indicator like the selects next to it. Everybody who sees the task sees
 * who it is hidden from; only the author and project managers can change it.
 */
export function TaskVisibilityField({
  taskId,
  hiddenFrom,
  canEdit,
  authorId,
  assigneeId,
  viewerId,
  members,
  onSaveState,
}: {
  taskId: Id<"tasks">;
  hiddenFrom: Id<"users">[];
  canEdit: boolean;
  authorId?: Id<"users">;
  assigneeId?: Id<"users">;
  viewerId?: Id<"users">;
  members: VisibilityMember[];
  onSaveState: (state: SaveState) => void;
}) {
  const setHiddenFrom = useMutation(api.tasks.setHiddenFrom);
  const options = hideOptions(members, hiddenFrom, {
    viewerId,
    authorId,
    assigneeId,
  });
  const hiddenCount = options.filter((option) => option.hidden).length;

  const handleToggle = async (userId: Id<"users">, hidden: boolean) => {
    onSaveState("saving");
    try {
      await setHiddenFrom({ taskId, userId, hidden });
      onSaveState("saved");
    } catch (error) {
      onSaveState("error");
      toast.error(
        error instanceof Error
          ? error.message
          : "Viditelnost se nepovedlo změnit.",
      );
    }
  };

  return (
    <div className="flex min-w-48 flex-1 flex-col gap-1.5">
      <Label>Viditelnost</Label>
      <HideFromMenu
        options={options}
        readOnly={!canEdit}
        note={
          canEdit
            ? undefined
            : "Viditelnost mění autor úkolu nebo správce projektu."
        }
        onToggle={(userId, hidden) => void handleToggle(userId, hidden)}
      >
        {/* Drawn like the select triggers beside it, so the row reads as
            three fields of one kind. */}
        <button
          type="button"
          className="flex h-9 w-full items-center gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-3 text-left text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 dark:bg-card/60 dark:hover:bg-accent"
        >
          {hiddenCount > 0 ? (
            <EyeOffIcon aria-hidden className="size-4 shrink-0 text-primary" />
          ) : (
            <EyeIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate">
            {hiddenSummary(hiddenCount)}
          </span>
          <ChevronDownIcon
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground"
          />
        </button>
      </HideFromMenu>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { EyeOffIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { HideFromMenu } from "@/components/tasks/hide-from-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  hiddenSummary,
  hideOptions,
  toggleHidden,
} from "@/lib/task-visibility";
import { cn } from "@/lib/utils";

/**
 * The bottom of every column: one line, Enter saves and stays open for the next
 * task, Escape closes. Success is silent — the new card is the feedback.
 *
 * The eye button stages who the next tasks are hidden from. They are created
 * hidden, never hidden a moment later: in between, the title would already be
 * on those people's boards. The choice stays for every task typed until the
 * line closes, and the count on the button says it is on.
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
  const viewer = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [hiddenFrom, setHiddenFrom] = useState<Id<"users">[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const members = useQuery(
    api.projects.assignableMembers,
    open ? { projectId } : "skip",
  );
  const options = hideOptions(members ?? [], hiddenFrom, {
    viewerId: viewer?._id,
    authorId: viewer?._id,
  });
  const hiddenCount = options.filter((option) => option.hidden).length;

  const close = () => {
    setTitle("");
    setHiddenFrom([]);
    setOpen(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || title.trim().length === 0) {
      return;
    }
    setPending(true);
    try {
      await createTask({
        projectId,
        statusId,
        title,
        hiddenFrom: hiddenFrom.length > 0 ? hiddenFrom : undefined,
      });
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
        className="flex h-9 w-full items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <PlusIcon className="size-4" />
        Přidat úkol
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-1"
      // Leaving the line with nothing typed closes it — but moving between
      // the title and the eye button, or into the menu, is not leaving.
      onBlur={(event) => {
        if (
          menuOpen ||
          event.currentTarget.contains(event.relatedTarget as Node | null)
        ) {
          return;
        }
        if (title.trim().length === 0) {
          close();
        }
      }}
    >
      <Input
        value={title}
        autoFocus
        disabled={pending}
        maxLength={200}
        aria-label={`Nový úkol ve stavu ${statusName}`}
        placeholder="Název úkolu"
        className="h-9 min-w-0 flex-1 text-sm"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            // Escape closes this line, not the task drawer that may be open
            // beside the board and listens for it on the document.
            event.preventDefault();
            event.stopPropagation();
            close();
          }
        }}
      />
      <HideFromMenu
        options={options}
        onOpenChange={setMenuOpen}
        onToggle={(userId, hidden) =>
          setHiddenFrom((current) => toggleHidden(current, userId, hidden))
        }
      >
        <Button
          type="button"
          variant="ghost"
          size={hiddenCount > 0 ? "default" : "icon"}
          aria-label="Skrýt před"
          title={hiddenSummary(hiddenCount)}
          className={cn(
            "shrink-0 text-muted-foreground",
            hiddenCount > 0 && "px-2 font-mono text-xs text-primary tabular-nums",
          )}
        >
          <EyeOffIcon aria-hidden />
          {hiddenCount > 0 ? hiddenCount : null}
        </Button>
      </HideFromMenu>
    </form>
  );
}

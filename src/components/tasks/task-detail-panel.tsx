"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Trash2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { EmptyState } from "@/components/layout/empty-state";
import { StatusDot } from "@/components/tasks/status-dot";
import { TaskAttachments } from "@/components/tasks/task-attachments";
import { TaskComments } from "@/components/tasks/task-comments";
import { TaskDescriptionEditor } from "@/components/tasks/task-description-editor";
import { TaskSaveIndicator } from "@/components/tasks/task-save-indicator";
import { TaskTitleField } from "@/components/tasks/task-title-field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import type { SaveState } from "@/lib/save-state";
import { userInitials } from "@/lib/user";

/** Radix `Select` has no empty value, so "nobody" needs a sentinel. */
const UNASSIGNED = "none";

/** How long "Uloženo" stays visible after the last write. */
const SAVED_NOTE_MS = 2000;

/**
 * The task detail, as it is shown inside the drawer next to the board.
 *
 * Every control here writes on its own: the title debounces while you type and
 * flushes when you leave it, the two selects write on change, the body editor
 * autosaves. Nothing has a save button and nothing toasts on success — the one
 * indicator in the header is the whole story. Comments are the exception and
 * stay explicit: a message is sent, not saved.
 */
export function TaskDetailPanel({
  taskId,
  onClose,
}: {
  taskId: string;
  onClose: () => void;
}) {
  const task = useQuery(api.tasks.get, { taskId });
  const statuses = useQuery(
    api.taskStatuses.list,
    task ? { projectId: task.projectId } : "skip",
  );
  const members = useQuery(
    api.projects.assignableMembers,
    task ? { projectId: task.projectId } : "skip",
  );
  const description = useQuery(
    api.taskContent.get,
    task ? { taskId: task._id } : "skip",
  );
  const moveTask = useMutation(api.tasks.move);
  const setAssignee = useMutation(api.tasks.setAssignee);
  const removeTask = useMutation(api.tasks.remove);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [deleting, setDeleting] = useState(false);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reportSave = useCallback((state: SaveState) => {
    setSaveState(state);
    if (noteTimer.current) {
      clearTimeout(noteTimer.current);
    }
    if (state === "saved") {
      noteTimer.current = setTimeout(() => setSaveState("idle"), SAVED_NOTE_MS);
    }
  }, []);

  useEffect(
    () => () => {
      if (noteTimer.current) {
        clearTimeout(noteTimer.current);
      }
    },
    [],
  );

  const handleStatus = async (statusId: string) => {
    if (!task) {
      return;
    }
    reportSave("saving");
    try {
      await moveTask({
        taskId: task._id,
        statusId: statusId as Id<"taskStatuses">,
      });
      reportSave("saved");
    } catch (error) {
      reportSave("error");
      toast.error(
        error instanceof Error ? error.message : "Stav se nepovedlo změnit.",
      );
    }
  };

  const handleAssignee = async (value: string) => {
    if (!task) {
      return;
    }
    reportSave("saving");
    try {
      await setAssignee({
        taskId: task._id,
        assigneeId: value === UNASSIGNED ? undefined : (value as Id<"users">),
      });
      reportSave("saved");
    } catch (error) {
      reportSave("error");
      toast.error(
        error instanceof Error ? error.message : "Přiřazení se nepovedlo.",
      );
    }
  };

  const handleRemove = async () => {
    if (!task) {
      return;
    }
    try {
      await removeTask({ taskId: task._id });
      toast.success("Úkol byl smazán.");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Úkol se nepovedlo smazat.",
      );
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* The header is a toolbar and hugs the panel edge; the column below it
          is indented to Notion's gutter, so the two do not line up on purpose. */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 sm:px-6">
        <span className="truncate text-sm text-muted-foreground">
          {task?.projectName}
        </span>
        <div className="-mr-2 ml-auto flex shrink-0 items-center gap-1">
          <TaskSaveIndicator state={saveState} />
          {task?.canRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Smazat úkol"
              onClick={() => setDeleting(true)}
            >
              <Trash2Icon />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Zavřít detail úkolu"
            onClick={onClose}
          >
            <XIcon />
          </Button>
        </div>
      </header>

      {/* `sm:px-14` is the gutter `.workeee-editor` borrows back: the editor's
          own padding then draws the text column, and the block handles land in
          the 3.5rem to its left instead of floating outside the panel. */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-14">
        {task === undefined ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : task === null ? (
          <EmptyState
            title="Úkol není dostupný"
            description="Buď byl smazaný, nebo k němu nemáte přístup."
          >
            <Button type="button" size="lg" variant="outline" onClick={onClose}>
              Zavřít
            </Button>
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-6">
            <TaskTitleField
              taskId={task._id}
              title={task.title}
              onSaveState={reportSave}
            />

            <div className="flex flex-wrap gap-4">
              <div className="flex min-w-48 flex-1 flex-col gap-1.5">
                <Label>Stav</Label>
                <Select value={task.statusId} onValueChange={handleStatus}>
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Vyberte stav" />
                  </SelectTrigger>
                  <SelectContent>
                    {(statuses ?? []).map((status) => (
                      <SelectItem key={status._id} value={status._id}>
                        <StatusDot color={status.color} />
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex min-w-48 flex-1 flex-col gap-1.5">
                <Label>Řešitel</Label>
                <Select
                  value={task.assignee?._id ?? UNASSIGNED}
                  onValueChange={handleAssignee}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Nikdo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Nikdo</SelectItem>
                    {(members ?? []).map((member) => (
                      <SelectItem key={member._id} value={member._id}>
                        <Avatar size="sm">
                          <AvatarImage src={member.image} alt="" />
                          <AvatarFallback>
                            {userInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Verbless, the same rule the notification e-mails follow: Czech
                past tense is gendered, the app does not know anybody's gender,
                and a name is not one. */}
            <p className="text-xs text-muted-foreground">
              Vytvořeno {formatDate(task.createdAt)} ·{" "}
              {task.createdBy?.name ?? "neznámý uživatel"}
            </p>

            {/* No rule above the editor: the body is the panel's main surface,
                not a section of it. The separators start where the sections
                with their own headings do. */}
            {description === undefined ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <TaskDescriptionEditor
                // Remounting on the task id is what keeps "load the document
                // once" true when the same panel is reused for another task.
                key={task._id}
                taskId={task._id}
                initialContent={description?.content ?? null}
                onSaveState={reportSave}
              />
            )}

            <Separator />

            <TaskAttachments taskId={task._id} />

            <Separator />

            <TaskComments taskId={task._id} members={members ?? []} />
          </div>
        )}
      </div>

      {task ? (
        <AlertDialog open={deleting} onOpenChange={setDeleting}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Smazat úkol {task.title}?</AlertDialogTitle>
              <AlertDialogDescription>
                Úkol se smaže natrvalo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <AlertDialogAction onClick={handleRemove}>
                Smazat
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation } from "convex/react";
import { MoreHorizontalIcon, PaletteIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { StatusDeleteDialog } from "@/components/tasks/status-delete-dialog";
import { StatusDot } from "@/components/tasks/status-dot";
import { StatusFormDialog } from "@/components/tasks/status-form-dialog";
import { TaskCard } from "@/components/tasks/task-card";
import { TaskQuickAdd } from "@/components/tasks/task-quick-add";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TASK_STATUS_COLORS,
  TASK_STATUS_COLOR_LABEL,
} from "@/lib/task-status-colors";
import type { BoardStatus, BoardTask } from "@/lib/tasks";
import { cn } from "@/lib/utils";

export function TaskColumn({
  projectId,
  status,
  tasks,
  otherStatuses,
  dragging,
  showEmptyHint,
  selectedTaskId,
  onOpenTask,
}: {
  projectId: Id<"projects">;
  status: BoardStatus;
  tasks: BoardTask[];
  otherStatuses: BoardStatus[];
  dragging: "task" | "column" | null;
  showEmptyHint: boolean;
  selectedTaskId: string | null;
  onOpenTask: (taskId: Id<"tasks">) => void;
}) {
  const updateStatus = useMutation(api.taskStatuses.update);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: status._id,
    data: { type: "column", statusId: status._id },
    // A dragged card must land on the list below, never on the column itself.
    disabled: { draggable: false, droppable: dragging === "task" },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `column:${status._id}`,
    data: { type: "column", statusId: status._id },
    disabled: dragging === "column",
  });

  const handleColor = async (color: BoardStatus["color"]) => {
    try {
      await updateStatus({ statusId: status._id, color });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Barvu se nepovedlo změnit.",
      );
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        // 256 px until the viewport can afford three 288 px columns; see
        // `--breakpoint-board` in globals.css.
        "flex w-64 shrink-0 flex-col gap-2 board:w-72",
        isDragging && "opacity-40",
      )}
    >
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="flex h-8 touch-none items-center gap-2 rounded-lg px-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
      >
        <StatusDot color={status.color} />
        <span className="truncate text-sm font-medium">{status.name}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {tasks.length}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="ml-auto"
              aria-label={`Možnosti stavu ${status.name}`}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <PencilIcon />
              Přejmenovat
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <PaletteIcon />
                Barva
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-40">
                {TASK_STATUS_COLORS.map((color) => (
                  <DropdownMenuItem
                    key={color}
                    onSelect={() => handleColor(color)}
                  >
                    <StatusDot color={color} />
                    {TASK_STATUS_COLOR_LABEL[color]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {status.kind === "custom" ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setDeleting(true)}
                >
                  <Trash2Icon />
                  Smazat
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        ref={setDropRef}
        className={cn(
          "flex max-h-[60dvh] flex-col gap-2 overflow-y-auto rounded-lg px-1 py-1 transition-colors",
          // An empty column still needs a body to drop a card on; a column with
          // cards must not grow a dead strip between the last card and the
          // "Přidat úkol" row.
          tasks.length === 0 && "min-h-20",
          isOver && dragging === "task" && "bg-accent/60",
        )}
      >
        <SortableContext
          items={tasks.map((task) => task._id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task._id}
              task={task}
              selected={task._id === selectedTaskId}
              columnDragging={dragging === "column"}
              onOpen={() => onOpenTask(task._id)}
            />
          ))}
        </SortableContext>
        {showEmptyHint ? (
          <p className="px-1 text-xs text-muted-foreground">Zatím žádné úkoly</p>
        ) : null}
      </div>

      <div className="px-1">
        <TaskQuickAdd
          projectId={projectId}
          statusId={status._id}
          statusName={status.name}
        />
      </div>

      {editing ? (
        <StatusFormDialog
          projectId={projectId}
          status={status}
          open
          onOpenChange={(open) => setEditing(open)}
        />
      ) : null}
      {deleting ? (
        <StatusDeleteDialog
          status={status}
          otherStatuses={otherStatuses}
          taskCount={tasks.length}
          open
          onOpenChange={(open) => setDeleting(open)}
        />
      ) : null}
    </div>
  );
}

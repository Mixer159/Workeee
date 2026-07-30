"use client";

import { useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { BoardTask } from "@/lib/tasks";
import { userInitials } from "@/lib/user";
import { cn } from "@/lib/utils";

/** How far the pointer may travel between press and release and still count as a click. */
const CLICK_SLOP = 5;

export function TaskCard({
  task,
  selected,
  columnDragging,
  onOpen,
}: {
  task: BoardTask;
  selected: boolean;
  columnDragging: boolean;
  onOpen: () => void;
}) {
  const pressedAt = useRef<{ x: number; y: number } | null>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task._id,
    data: { type: "task", statusId: task.statusId },
    // While a column is being dragged, cards must not swallow the drop.
    disabled: { draggable: columnDragging, droppable: columnDragging },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      // dnd-kit's pointer sensor lets a short press through as a click, so the
      // card stays clickable; a press that travelled is a drag, not a click.
      onPointerDown={(event) => {
        pressedAt.current = { x: event.clientX, y: event.clientY };
        listeners?.onPointerDown?.(event);
      }}
      onClick={(event) => {
        const start = pressedAt.current;
        if (
          start &&
          Math.hypot(event.clientX - start.x, event.clientY - start.y) >
            CLICK_SLOP
        ) {
          return;
        }
        onOpen();
      }}
      onKeyDown={(event) => {
        // Enter opens the task; Space is left to dnd-kit's keyboard dragging.
        if (event.key === "Enter") {
          event.preventDefault();
          onOpen();
          return;
        }
        listeners?.onKeyDown?.(event);
      }}
      className={cn(
        "flex cursor-pointer touch-none items-start gap-2 rounded-lg border bg-card p-3 text-left transition-colors outline-none hover:border-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50",
        // Which card the drawer on the right is showing.
        selected && "border-primary ring-3 ring-ring/30",
        isDragging && "opacity-40",
      )}
    >
      <p className="min-w-0 flex-1 text-sm leading-snug break-words">
        {task.title}
      </p>
      {task.assignee ? (
        <Avatar size="sm" title={task.assignee.name}>
          <AvatarImage src={task.assignee.image} alt="" />
          <AvatarFallback>{userInitials(task.assignee.name)}</AvatarFallback>
        </Avatar>
      ) : null}
    </div>
  );
}

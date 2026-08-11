"use client";

import { useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MessageCircleIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { BoardTask, TaskUnread } from "@/lib/tasks";
import { userInitials } from "@/lib/user";
import { plural } from "@convex/lib/plural";
import { cn } from "@/lib/utils";

/** How far the pointer may travel between press and release and still count as a click. */
const CLICK_SLOP = 5;

export function TaskCard({
  task,
  selected,
  columnDragging,
  unread,
  onOpen,
}: {
  task: BoardTask;
  selected: boolean;
  columnDragging: boolean;
  /** Absent = nothing new on this task. */
  unread?: TaskUnread;
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
      // The drawer closes on an outside click, and a card is the one outside
      // that means "show me this one instead" — this marks it as such.
      data-task-card=""
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
        "flex cursor-pointer touch-none items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors outline-none hover:border-foreground/25 focus-visible:ring-3 focus-visible:ring-ring/40",
        // Which card the drawer on the right is showing.
        selected && "border-primary bg-primary/[0.06] hover:border-primary",
        isDragging && "opacity-40",
      )}
    >
      <p className="min-w-0 flex-1 text-sm leading-snug break-words text-card-foreground">
        {task.title}
      </p>
      {/* One indicator per card: the comment count says the most, so it wins;
          the dot only stands in for a task never opened at all. */}
      {unread && unread.unreadComments > 0 ? (
        <span
          title={`${unread.unreadComments} ${plural(unread.unreadComments, "nový komentář", "nové komentáře", "nových komentářů")}`}
          className="flex h-[1.125rem] shrink-0 items-center gap-1 rounded-md bg-primary/15 px-1.5 font-mono text-[0.6875rem] font-medium tabular-nums text-primary"
        >
          <MessageCircleIcon aria-hidden className="size-3" />
          {unread.unreadComments}
        </span>
      ) : unread?.isNew ? (
        <span
          title="Ještě jste ho neotevřeli"
          aria-label="Ještě jste ho neotevřeli"
          className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
        />
      ) : null}
      {task.assignee ? (
        <Avatar size="sm" title={task.assignee.name}>
          <AvatarImage src={task.assignee.image} alt="" />
          <AvatarFallback>{userInitials(task.assignee.name)}</AvatarFallback>
        </Avatar>
      ) : null}
    </div>
  );
}

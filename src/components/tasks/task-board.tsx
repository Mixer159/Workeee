"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Over,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useMutation, useQuery } from "convex/react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { StatusDot } from "@/components/tasks/status-dot";
import { StatusFormDialog } from "@/components/tasks/status-form-dialog";
import { TaskColumn } from "@/components/tasks/task-column";
import { Skeleton } from "@/components/ui/skeleton";
import type { BoardStatus, BoardTask } from "@/lib/tasks";

type Grouping = Map<Id<"taskStatuses">, Id<"tasks">[]>;

/**
 * The project board: one column per task status, cards dragged within and
 * across columns, columns dragged into a new left-to-right order.
 *
 * There is no optimistic-update layer. What a drag keeps locally is a *drag
 * override* — the arrangement the pointer is currently describing — held only
 * until the mutation resolves, then dropped so the server is the truth again.
 * Nothing here syncs server data into state, so no effect ever calls setState.
 */
export function TaskBoard({
  projectId,
  selectedTaskId,
  onOpenTask,
}: {
  projectId: Id<"projects">;
  /** The task the drawer is showing, so its card can say so. */
  selectedTaskId: string | null;
  onOpenTask: (taskId: Id<"tasks">) => void;
}) {
  const statuses = useQuery(api.taskStatuses.list, { projectId });
  const tasks = useQuery(api.tasks.listByProject, { projectId });
  const moveTask = useMutation(api.tasks.move);
  const reorderStatuses = useMutation(api.taskStatuses.reorder);

  const [columnOverride, setColumnOverride] = useState<
    Id<"taskStatuses">[] | null
  >(null);
  const [taskOverride, setTaskOverride] = useState<Grouping | null>(null);
  const [activeTask, setActiveTask] = useState<BoardTask | null>(null);
  const [activeColumn, setActiveColumn] = useState<BoardStatus | null>(null);
  const [addingStatus, setAddingStatus] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  if (statuses === undefined || tasks === undefined) {
    return <BoardSkeleton />;
  }

  const statusById = new Map(statuses.map((status) => [status._id, status]));
  const taskById = new Map(tasks.map((task) => [task._id, task]));

  const columnIds = orderColumns(
    statuses.map((status) => status._id),
    columnOverride,
  );
  const grouping = taskOverride
    ? sanitizeGrouping(taskOverride, columnIds, taskById)
    : groupTasks(tasks, columnIds);
  const boardEmpty = tasks.length === 0;

  const commit = async (run: () => Promise<unknown>, message: string) => {
    try {
      await run();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : message);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const type = event.active.data.current?.type;
    if (type === "column") {
      setActiveColumn(statusById.get(event.active.id as Id<"taskStatuses">) ?? null);
      return;
    }
    setActiveTask(taskById.get(event.active.id as Id<"tasks">) ?? null);
  };

  /**
   * Hovering only ever moves a card **into another column**. Reordering inside a
   * column while the pointer hovers makes the layout shift under the pointer,
   * which produces the next hover, which shifts it back — an endless loop that
   * freezes the tab. The position inside the column is decided on drop.
   */
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.data.current?.type !== "task") {
      return;
    }
    const from = columnOfTask(grouping, active.id as Id<"tasks">);
    const to = targetColumn(grouping, over);
    if (!from || !to || from === to) {
      return;
    }
    const next = arrange(grouping, event);
    if (next) {
      setTaskOverride(next);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const type = event.active.data.current?.type;
    setActiveTask(null);
    setActiveColumn(null);

    if (type === "column") {
      const activeId = event.active.id as Id<"taskStatuses">;
      const overId = columnOf(event.over?.data.current, columnIds);
      if (!overId || overId === activeId) {
        setColumnOverride(null);
        return;
      }
      const from = columnIds.indexOf(activeId);
      const to = columnIds.indexOf(overId);
      if (from < 0 || to < 0) {
        setColumnOverride(null);
        return;
      }
      const ordered = arrayMove(columnIds, from, to);
      setColumnOverride(ordered);
      await commit(
        () => reorderStatuses({ projectId, statusIds: ordered }),
        "Pořadí stavů se nepovedlo uložit.",
      );
      setColumnOverride(null);
      return;
    }

    const taskId = event.active.id as Id<"tasks">;
    const arranged = arrange(grouping, event);
    // Nothing new to say: the card was dropped where it already was and no
    // hover had moved it into another column.
    if (!arranged && taskOverride === null) {
      return;
    }
    const final = arranged ?? grouping;
    setTaskOverride(final);

    const statusId = [...final.entries()].find(([, ids]) =>
      ids.includes(taskId),
    )?.[0];
    if (!statusId) {
      setTaskOverride(null);
      return;
    }
    const column = final.get(statusId) ?? [];
    const index = column.indexOf(taskId);
    await commit(
      () =>
        moveTask({
          taskId,
          statusId,
          previousTaskId: column[index - 1],
          nextTaskId: column[index + 1],
        }),
      "Úkol se nepovedlo přesunout.",
    );
    setTaskOverride(null);
  };

  const handleDragCancel = () => {
    setActiveTask(null);
    setActiveColumn(null);
    setTaskOverride(null);
    setColumnOverride(null);
  };

  const dragging = activeTask ? "task" : activeColumn ? "column" : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      // Columns change height as cards move between them, so their rectangles
      // have to be re-measured during the drag, not just at the start.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="-mx-4 overflow-x-auto px-4 pb-2 lg:-mx-8 lg:px-8">
        <div className="flex min-w-max items-start gap-4">
          <SortableContext
            items={columnIds}
            strategy={horizontalListSortingStrategy}
          >
            {columnIds.map((statusId, index) => {
              const status = statusById.get(statusId);
              if (!status) {
                return null;
              }
              const columnTasks = (grouping.get(statusId) ?? [])
                .map((id) => taskById.get(id))
                .filter((task): task is BoardTask => task !== undefined);
              return (
                <TaskColumn
                  key={statusId}
                  projectId={projectId}
                  status={status}
                  tasks={columnTasks}
                  otherStatuses={statuses.filter(
                    (other) => other._id !== statusId,
                  )}
                  dragging={dragging}
                  showEmptyHint={boardEmpty && index === 0}
                  selectedTaskId={selectedTaskId}
                  onOpenTask={onOpenTask}
                />
              );
            })}
          </SortableContext>

          <button
            type="button"
            onClick={() => setAddingStatus(true)}
            // Sized to its label, not to a column: the ~60 px it gives back is
            // the difference between a three-column board fitting a 1280 px
            // laptop and scrolling on one.
            className="flex h-8 w-fit shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-border px-3 text-sm whitespace-nowrap text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <PlusIcon className="size-4" />
            Přidat stav
          </button>
        </div>
      </div>

      <DragOverlay>
        {activeTask ? (
          <div className="w-64 rounded-lg border bg-card p-3 shadow-md board:w-72">
            <p className="text-sm leading-snug break-words">
              {activeTask.title}
            </p>
          </div>
        ) : activeColumn ? (
          <div className="flex h-8 w-64 items-center gap-2 rounded-lg border bg-card px-2 shadow-md board:w-72">
            <StatusDot color={activeColumn.color} />
            <span className="truncate text-sm font-medium">
              {activeColumn.name}
            </span>
          </div>
        ) : null}
      </DragOverlay>

      {addingStatus ? (
        <StatusFormDialog
          projectId={projectId}
          status={null}
          open
          onOpenChange={(open) => setAddingStatus(open)}
        />
      ) : null}
    </DndContext>
  );
}

/** Server order, replaced by the drag override while one is in flight. */
function orderColumns(
  serverIds: Id<"taskStatuses">[],
  override: Id<"taskStatuses">[] | null,
): Id<"taskStatuses">[] {
  if (!override) {
    return serverIds;
  }
  const known = new Set(serverIds);
  const ordered = override.filter((id) => known.has(id));
  const seen = new Set(ordered);
  return [...ordered, ...serverIds.filter((id) => !seen.has(id))];
}

function groupTasks(
  tasks: BoardTask[],
  columnIds: Id<"taskStatuses">[],
): Grouping {
  const grouping: Grouping = new Map(columnIds.map((id) => [id, []]));
  for (const task of tasks) {
    grouping.get(task.statusId)?.push(task._id);
  }
  return grouping;
}

/** Drop ids the server no longer knows about, keep every column present. */
function sanitizeGrouping(
  grouping: Grouping,
  columnIds: Id<"taskStatuses">[],
  taskById: Map<Id<"tasks">, BoardTask>,
): Grouping {
  const next: Grouping = new Map();
  for (const columnId of columnIds) {
    next.set(
      columnId,
      (grouping.get(columnId) ?? []).filter((id) => taskById.has(id)),
    );
  }
  return next;
}

/** The status a drop target belongs to, whether it is a card or a column. */
function columnOf(
  data: Record<string, unknown> | undefined,
  columnIds: Id<"taskStatuses">[],
): Id<"taskStatuses"> | null {
  const statusId = data?.statusId as Id<"taskStatuses"> | undefined;
  return statusId && columnIds.includes(statusId) ? statusId : null;
}

/** The column a card currently sits in. */
function columnOfTask(
  grouping: Grouping,
  taskId: Id<"tasks">,
): Id<"taskStatuses"> | null {
  for (const [statusId, ids] of grouping) {
    if (ids.includes(taskId)) {
      return statusId;
    }
  }
  return null;
}

/** The column a card is hovering over, be it another card or the column body. */
function targetColumn(grouping: Grouping, over: Over): Id<"taskStatuses"> | null {
  if (over.data.current?.type === "task") {
    return columnOfTask(grouping, over.id as Id<"tasks">);
  }
  return columnOf(over.data.current, [...grouping.keys()]);
}

/**
 * The arrangement the pointer currently describes: the dragged card removed
 * from where it was and inserted where it hovers. Returns null when nothing
 * would change, so hovering does not re-render the board on every pixel.
 */
function arrange(
  grouping: Grouping,
  event: DragOverEvent | DragEndEvent,
): Grouping | null {
  const { active, over } = event;
  if (!over) {
    return null;
  }
  const taskId = active.id as Id<"tasks">;
  const from = columnOfTask(grouping, taskId);
  const to = targetColumn(grouping, over);
  if (!from || !to) {
    return null;
  }

  // Inside one column the card never leaves the list, so the result has to be
  // the swap dnd-kit already previewed: active index moved onto the over index.
  if (from === to) {
    const list = [...(grouping.get(from) ?? [])];
    const activeIndex = list.indexOf(taskId);
    const overIndex =
      over.data.current?.type === "task"
        ? list.indexOf(over.id as Id<"tasks">)
        : list.length - 1;
    if (activeIndex < 0 || overIndex < 0 || activeIndex === overIndex) {
      return null;
    }
    const next: Grouping = new Map(grouping);
    next.set(from, arrayMove(list, activeIndex, overIndex));
    return next;
  }

  const source = [...(grouping.get(from) ?? [])];
  const target = [...(grouping.get(to) ?? [])];
  const currentIndex = source.indexOf(taskId);
  if (currentIndex >= 0) {
    source.splice(currentIndex, 1);
  }

  let index = target.length;
  if (over.data.current?.type === "task") {
    const overIndex = target.indexOf(over.id as Id<"tasks">);
    if (overIndex >= 0) {
      const translated = active.rect.current.translated;
      const below =
        translated !== null &&
        over.rect.top + over.rect.height / 2 < translated.top;
      index = overIndex + (below ? 1 : 0);
    }
  }
  target.splice(index, 0, taskId);

  const next: Grouping = new Map(grouping);
  next.set(from, source);
  next.set(to, target);
  return sameArrangement(grouping, next) ? null : next;
}

function sameArrangement(a: Grouping, b: Grouping): boolean {
  if (a.size !== b.size) {
    return false;
  }
  for (const [key, value] of a) {
    const other = b.get(key);
    if (!other || other.length !== value.length) {
      return false;
    }
    for (let index = 0; index < value.length; index += 1) {
      if (value[index] !== other[index]) {
        return false;
      }
    }
  }
  return true;
}

function BoardSkeleton() {
  return (
    <div className="flex gap-4">
      {[0, 1, 2].map((column) => (
        <div
          key={column}
          className="flex w-64 shrink-0 flex-col gap-2 board:w-72"
        >
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  );
}

"use client";

import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

/**
 * The task detail, on the right of the board it belongs to.
 *
 * Non-modal on purpose: the board keeps working underneath, so another card
 * can be clicked straight into the panel and cards can still be dragged while
 * it is open. That also means no overlay — an overlay would swallow exactly
 * those clicks.
 *
 * Closing is the X, Escape, or a click anywhere outside the panel — with one
 * exception: a click on a task card. That click already means "show me this
 * one instead", and letting it close first would slide the panel out and
 * straight back in. Everything the panel opens for itself (selects, dialogs,
 * the editor's menus) is portalled from inside its React tree, so Radix counts
 * it as inside and it never dismisses.
 */
export function TaskDrawer({
  taskId,
  onClose,
}: {
  taskId: string | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={taskId !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      modal={false}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        showOverlay={false}
        // The panel is one editable surface, not a form with an intro.
        aria-describedby={undefined}
        onPointerDownOutside={(event) => {
          const target = event.target as Element | null;
          if (target?.closest("[data-task-card]")) {
            event.preventDefault();
          }
        }}
        // Only a pointer closes the panel. Focus leaving it is what tabbing to
        // the board does, and that is not a dismissal.
        onFocusOutside={(event) => event.preventDefault()}
        className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-2xl"
      >
        <SheetTitle className="sr-only">Detail úkolu</SheetTitle>
        {taskId ? (
          // Keyed by the task: switching cards loads a fresh panel instead of
          // pushing another task's data into the one being edited.
          <TaskDetailPanel key={taskId} taskId={taskId} onClose={onClose} />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

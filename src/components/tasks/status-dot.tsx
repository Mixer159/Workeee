import { cn } from "@/lib/utils";
import {
  TASK_STATUS_DOT_CLASS,
  type TaskStatusColor,
} from "@/lib/task-status-colors";

/** The color of a status, everywhere it appears next to its name. */
export function StatusDot({
  color,
  className,
}: {
  color: TaskStatusColor;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 shrink-0 rounded-full",
        TASK_STATUS_DOT_CLASS[color],
        className,
      )}
    />
  );
}

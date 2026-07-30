/**
 * The task status palette — the single place a status color key becomes CSS.
 *
 * Colors follow the sanctioned Tailwind alpha convention
 * (`bg-<c>-500/10 text-<c>-700 dark:text-<c>-300 border-<c>-500/20`), so every
 * status works in both themes without a component ever writing a color. The
 * keys mirror the `taskStatusColors` union in `convex/schema.ts`.
 */

export const TASK_STATUS_COLORS = [
  "gray",
  "blue",
  "indigo",
  "violet",
  "amber",
  "orange",
  "red",
  "green",
  "teal",
] as const;

export type TaskStatusColor = (typeof TASK_STATUS_COLORS)[number];

export const TASK_STATUS_COLOR_LABEL: Record<TaskStatusColor, string> = {
  gray: "Šedá",
  blue: "Modrá",
  indigo: "Indigová",
  violet: "Fialová",
  amber: "Jantarová",
  orange: "Oranžová",
  red: "Červená",
  green: "Zelená",
  teal: "Tyrkysová",
};

/** The dot in a column header and in a select item. */
export const TASK_STATUS_DOT_CLASS: Record<TaskStatusColor, string> = {
  gray: "bg-gray-500 dark:bg-gray-400",
  blue: "bg-blue-500 dark:bg-blue-400",
  indigo: "bg-indigo-500 dark:bg-indigo-400",
  violet: "bg-violet-500 dark:bg-violet-400",
  amber: "bg-amber-500 dark:bg-amber-400",
  orange: "bg-orange-500 dark:bg-orange-400",
  red: "bg-red-500 dark:bg-red-400",
  green: "bg-green-500 dark:bg-green-400",
  teal: "bg-teal-500 dark:bg-teal-400",
};

/** The status chip on the task detail page. */
export const TASK_STATUS_BADGE_CLASS: Record<TaskStatusColor, string> = {
  gray: "bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/20",
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  indigo:
    "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
  violet:
    "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
  amber: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  orange:
    "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20",
  red: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
  green: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20",
  teal: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20",
};

/**
 * Ready-made columns offered next to the "new status" form. They are copy, not
 * schema — picking one only prefills the name and the color.
 */
export const TASK_STATUS_TEMPLATES: { name: string; color: TaskStatusColor }[] =
  [
    { name: "Potřeba revize", color: "amber" },
    { name: "Potřeba informace", color: "violet" },
    { name: "Odpověď", color: "teal" },
  ];

export function isTaskStatusColor(value: string): value is TaskStatusColor {
  return (TASK_STATUS_COLORS as readonly string[]).includes(value);
}

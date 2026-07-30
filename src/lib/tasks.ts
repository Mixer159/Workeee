import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";

/**
 * Board shapes, taken straight from what the Convex functions return, so a
 * change on the server shows up as a type error on the board instead of an
 * undefined at runtime.
 */

export type BoardStatus = FunctionReturnType<
  typeof api.taskStatuses.list
>[number];

export type BoardTask = FunctionReturnType<
  typeof api.tasks.listByProject
>[number];

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useDeferredValue,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { FunctionReturnType } from "convex/server";
import { useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

const PAGE_SIZE = 40;

type WorkspaceData = FunctionReturnType<typeof api.workspace.listTasks>;

type WorkspaceContextValue = {
  data: WorkspaceData | undefined;
  activeTaskId: string | null;
  openTask: (taskId: Id<"tasks">) => void;
  closeTask: () => void;
  loadMore: () => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

/**
 * Shared state between the workspace rail and its central task surface.
 * Selection is a shallow URL write, so switching tasks stays immediate while
 * `?ukol=` remains copy-pasteable.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const [limit, setLimit] = useState(PAGE_SIZE);
  // `undefined` means "open the newest task"; `null` is an explicit close.
  const [selectedTaskId, setSelectedTaskId] = useState<
    Id<"tasks"> | null | undefined
  >(() => {
    const taskId = searchParams.get("ukol");
    return taskId ? (taskId as Id<"tasks">) : undefined;
  });

  const result = useQuery(api.workspace.listTasks, { limit });
  // Keep the previous page painted while a larger limit is loading.
  const deferredResult = useDeferredValue(result);
  const data = result ?? deferredResult;

  const openTask = useCallback((taskId: Id<"tasks">) => {
    setSelectedTaskId(taskId);
    writeTaskToAddress(taskId);
  }, []);

  const closeTask = useCallback(() => {
    setSelectedTaskId(null);
    writeTaskToAddress(null);
  }, []);

  const loadMore = useCallback(() => {
    setLimit((current) => Math.min(current + PAGE_SIZE, 100));
  }, []);

  const activeTaskId =
    selectedTaskId === undefined
      ? (data?.items[0]?._id ?? null)
      : selectedTaskId;

  const value = useMemo<WorkspaceContextValue>(
    () => ({ data, activeTaskId, openTask, closeTask, loadMore }),
    [data, activeTaskId, openTask, closeTask, loadMore],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error("useWorkspace musí být uvnitř WorkspaceProvider.");
  }
  return value;
}

function writeTaskToAddress(taskId: Id<"tasks"> | null): void {
  const url = new URL(window.location.href);
  if (taskId) {
    url.searchParams.set("ukol", taskId);
  } else {
    url.searchParams.delete("ukol");
  }
  window.history.replaceState(
    null,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

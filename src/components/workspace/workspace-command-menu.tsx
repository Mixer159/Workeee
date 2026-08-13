"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import {
  WorkspaceCommandMenuDialog,
  type WorkspacePaletteStep,
  type WorkspaceProject,
} from "@/components/workspace/workspace-command-menu-dialog";
import { useWorkspace } from "@/components/workspace/workspace-provider";

type WorkspaceCommandMenuContextValue = {
  openTaskCreator: () => void;
};

const WorkspaceCommandMenuContext =
  createContext<WorkspaceCommandMenuContextValue | null>(null);

/**
 * One command menu instance serves both responsive sidebars. Keeping the
 * dialog above the desktop/mobile split also guarantees a single Cmd+K
 * listener even though both rails stay mounted for responsive layout.
 */
export function WorkspaceCommandMenuProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { data, openTask } = useWorkspace();
  const createTask = useMutation(api.tasks.create);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<WorkspacePaletteStep>("commands");
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedProject, setSelectedProject] =
    useState<WorkspaceProject | null>(null);
  const [pending, setPending] = useState(false);

  const statuses = useQuery(
    api.taskStatuses.list,
    open && selectedProject ? { projectId: selectedProject._id } : "skip",
  );

  const openCommands = useCallback(() => {
    setStep("commands");
    setQuery("");
    setTitle("");
    setSelectedIndex(0);
    setSelectedProject(null);
    setOpen(true);
  }, []);

  const openTaskCreator = useCallback(() => {
    setStep("projects");
    setQuery("");
    setTitle("");
    setSelectedIndex(0);
    setSelectedProject(null);
    setOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLocaleLowerCase("en") === "k"
      ) {
        event.preventDefault();
        openCommands();
      }
    };

    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [openCommands]);

  const needle = normalizeSearch(query);
  const recentTasks = useMemo(() => {
    const tasks = data?.items ?? [];
    if (!needle) {
      return tasks.slice(0, 8);
    }
    return tasks
      .filter((task) =>
        [task.title, task.project.name].some((value) =>
          normalizeSearch(value).includes(needle),
        ),
      )
      .slice(0, 8);
  }, [data?.items, needle]);
  const projects = useMemo(() => {
    const options = data?.projects ?? [];
    if (!needle) {
      return options;
    }
    return options.filter((project) =>
      [project.name, project.organizationName].some((value) =>
        normalizeSearch(value).includes(needle),
      ),
    );
  }, [data?.projects, needle]);
  const showCreateAction =
    !needle || normalizeSearch("Nový úkol vytvořit úkol").includes(needle);
  const optionCount =
    step === "commands"
      ? recentTasks.length + Number(showCreateAction)
      : step === "projects"
        ? projects.length
        : 0;
  const activeIndex =
    optionCount === 0 ? -1 : Math.min(selectedIndex, optionCount - 1);

  const goBack = useCallback(() => {
    setSelectedIndex(0);
    if (step === "title") {
      setStep("projects");
      setTitle("");
      setSelectedProject(null);
      return;
    }
    if (step === "projects") {
      setStep("commands");
      setQuery("");
    }
  }, [step]);

  const chooseProject = useCallback((project: WorkspaceProject) => {
    setSelectedProject(project);
    setTitle("");
    setStep("title");
    setSelectedIndex(0);
  }, []);

  const submitTask = useCallback(async () => {
    const cleanTitle = title.trim();
    const status =
      statuses?.find((option) => option.kind === "todo") ?? statuses?.[0];
    if (!selectedProject || !cleanTitle || !status || pending) {
      return;
    }

    setPending(true);
    try {
      const { taskId } = await createTask({
        projectId: selectedProject._id,
        statusId: status._id,
        title: cleanTitle,
      });
      closeMenu();
      openTask(taskId);
      toast.success("Úkol byl vytvořen.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Úkol se nepovedlo vytvořit.",
      );
    } finally {
      setPending(false);
    }
  }, [closeMenu, createTask, openTask, pending, selectedProject, statuses, title]);

  const selectActiveOption = useCallback(() => {
    if (activeIndex < 0) {
      return;
    }
    if (step === "commands") {
      if (showCreateAction && activeIndex === 0) {
        setStep("projects");
        setQuery("");
        setSelectedIndex(0);
        return;
      }
      const taskIndex = activeIndex - Number(showCreateAction);
      const task = recentTasks[taskIndex];
      if (task) {
        openTask(task._id);
        closeMenu();
      }
      return;
    }
    if (step === "projects") {
      const project = projects[activeIndex];
      if (project) {
        chooseProject(project);
      }
    }
  }, [
    activeIndex,
    chooseProject,
    closeMenu,
    openTask,
    projects,
    recentTasks,
    showCreateAction,
    step,
  ]);

  const handleInputKeyDown = (
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "ArrowDown" && optionCount > 0) {
      event.preventDefault();
      setSelectedIndex((current) => (current + 1) % optionCount);
      return;
    }
    if (event.key === "ArrowUp" && optionCount > 0) {
      event.preventDefault();
      setSelectedIndex((current) => (current - 1 + optionCount) % optionCount);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (step === "title") {
        void submitTask();
      } else {
        selectActiveOption();
      }
      return;
    }
    if (
      event.key === "Backspace" &&
      step !== "commands" &&
      event.currentTarget.value.length === 0
    ) {
      event.preventDefault();
      goBack();
    }
  };

  const contextValue = useMemo(
    () => ({ openTaskCreator }),
    [openTaskCreator],
  );

  return (
    <WorkspaceCommandMenuContext.Provider value={contextValue}>
      {children}
      <WorkspaceCommandMenuDialog
        open={open}
        step={step}
        inputValue={step === "title" ? title : query}
        loading={data === undefined}
        pending={pending}
        query={query}
        recentTasks={recentTasks}
        projects={projects}
        selectedProject={selectedProject}
        statusesLoading={statuses === undefined}
        showCreateAction={showCreateAction}
        activeIndex={activeIndex}
        onOpenChange={setOpen}
        onBack={goBack}
        onInputChange={(value) => {
          setSelectedIndex(0);
          if (step === "title") {
            setTitle(value);
          } else {
            setQuery(value);
          }
        }}
        onInputKeyDown={handleInputKeyDown}
        onHover={setSelectedIndex}
        onShowProjects={() => {
          setStep("projects");
          setQuery("");
          setSelectedIndex(0);
        }}
        onOpenTask={(taskId) => {
          openTask(taskId);
          closeMenu();
        }}
        onChooseProject={chooseProject}
        onSubmit={() => void submitTask()}
      />
    </WorkspaceCommandMenuContext.Provider>
  );
}

export function useWorkspaceCommandMenu(): WorkspaceCommandMenuContextValue {
  const value = useContext(WorkspaceCommandMenuContext);
  if (!value) {
    throw new Error(
      "useWorkspaceCommandMenu musí být uvnitř WorkspaceCommandMenuProvider.",
    );
  }
  return value;
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase("cs");
}

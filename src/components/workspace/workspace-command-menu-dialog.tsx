"use client";

import type {
  KeyboardEventHandler,
  ReactNode,
} from "react";
import type { FunctionReturnType } from "convex/server";
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  SquarePenIcon,
} from "lucide-react";
import { api } from "@convex/_generated/api";
import { ProjectIcon } from "@/components/projects/project-icon";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type WorkspaceTask = FunctionReturnType<
  typeof api.workspace.listTasks
>["items"][number];

export type WorkspaceProject = FunctionReturnType<
  typeof api.workspace.listTasks
>["projects"][number];

export type WorkspacePaletteStep = "commands" | "projects" | "title";

export function WorkspaceCommandMenuDialog({
  open,
  step,
  inputValue,
  loading,
  pending,
  query,
  recentTasks,
  projects,
  selectedProject,
  statusesLoading,
  showCreateAction,
  activeIndex,
  onOpenChange,
  onBack,
  onInputChange,
  onInputKeyDown,
  onHover,
  onShowProjects,
  onOpenTask,
  onChooseProject,
  onSubmit,
}: {
  open: boolean;
  step: WorkspacePaletteStep;
  inputValue: string;
  loading: boolean;
  pending: boolean;
  query: string;
  recentTasks: WorkspaceTask[];
  projects: WorkspaceProject[];
  selectedProject: WorkspaceProject | null;
  statusesLoading: boolean;
  showCreateAction: boolean;
  activeIndex: number;
  onOpenChange: (open: boolean) => void;
  onBack: () => void;
  onInputChange: (value: string) => void;
  onInputKeyDown: KeyboardEventHandler<HTMLInputElement>;
  onHover: (index: number) => void;
  onShowProjects: () => void;
  onOpenTask: (taskId: WorkspaceTask["_id"]) => void;
  onChooseProject: (project: WorkspaceProject) => void;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="grid h-[min(31.5rem,calc(100dvh-2rem))] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-xl p-0 sm:max-w-2xl"
      >
        <DialogTitle className="sr-only">{dialogTitle(step)}</DialogTitle>

        <div className="flex h-14 items-center gap-3 border-b border-border px-4 sm:px-5">
          {step === "commands" ? (
            <SearchIcon className="size-5 shrink-0 text-muted-foreground" />
          ) : (
            <button
              type="button"
              onClick={onBack}
              aria-label="Zpět"
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
            >
              <ArrowLeftIcon className="size-5" />
            </button>
          )}
          <input
            key={step}
            autoFocus
            value={inputValue}
            disabled={pending}
            maxLength={step === "title" ? 200 : undefined}
            aria-label={inputLabel(step)}
            placeholder={inputPlaceholder(step)}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={onInputKeyDown}
            className="h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-lg"
          />
        </div>

        <div className="min-h-0 overflow-y-auto p-2 sm:p-3">
          {step === "commands" ? (
            <CommandResults
              loading={loading}
              query={query}
              recentTasks={recentTasks}
              showCreateAction={showCreateAction}
              activeIndex={activeIndex}
              onHover={onHover}
              onCreate={onShowProjects}
              onOpenTask={onOpenTask}
            />
          ) : step === "projects" ? (
            <ProjectResults
              loading={loading}
              projects={projects}
              activeIndex={activeIndex}
              onHover={onHover}
              onChoose={onChooseProject}
            />
          ) : (
            <TaskTitleStep
              project={selectedProject}
              title={inputValue}
              statusesLoading={statusesLoading}
              pending={pending}
              onSubmit={onSubmit}
            />
          )}
        </div>

        <CommandFooter step={step} />
      </DialogContent>
    </Dialog>
  );
}

function CommandResults({
  loading,
  query,
  recentTasks,
  showCreateAction,
  activeIndex,
  onHover,
  onCreate,
  onOpenTask,
}: {
  loading: boolean;
  query: string;
  recentTasks: WorkspaceTask[];
  showCreateAction: boolean;
  activeIndex: number;
  onHover: (index: number) => void;
  onCreate: () => void;
  onOpenTask: (taskId: WorkspaceTask["_id"]) => void;
}) {
  let index = 0;
  const createIndex = showCreateAction ? index++ : -1;

  return (
    <div aria-label="Příkazy a poslední úkoly">
      {showCreateAction ? (
        <section>
          <GroupLabel>Akce</GroupLabel>
          <CommandRow
            selected={activeIndex === createIndex}
            onMouseEnter={() => onHover(createIndex)}
            onClick={onCreate}
            icon={<SquarePenIcon className="size-5" />}
            title="Nový úkol…"
            trailing={<ChevronRightIcon className="size-5" />}
          />
        </section>
      ) : null}

      {recentTasks.length > 0 ? (
        <section className={showCreateAction ? "mt-4" : undefined}>
          <GroupLabel>Poslední úkoly</GroupLabel>
          {recentTasks.map((task) => {
            const taskIndex = index++;
            return (
              <CommandRow
                key={task._id}
                selected={activeIndex === taskIndex}
                onMouseEnter={() => onHover(taskIndex)}
                onClick={() => onOpenTask(task._id)}
                icon={
                  <ProjectIcon
                    name={task.project.name}
                    emoji={task.project.emoji}
                    iconUrl={task.project.iconUrl}
                    className="size-6"
                  />
                }
                title={task.title}
                subtitle={task.project.name}
              />
            );
          })}
        </section>
      ) : loading ? (
        <EmptyResult>Načítám úkoly…</EmptyResult>
      ) : query.trim() ? (
        <EmptyResult>Žádný příkaz ani úkol neodpovídá hledání.</EmptyResult>
      ) : null}
    </div>
  );
}

function ProjectResults({
  loading,
  projects,
  activeIndex,
  onHover,
  onChoose,
}: {
  loading: boolean;
  projects: WorkspaceProject[];
  activeIndex: number;
  onHover: (index: number) => void;
  onChoose: (project: WorkspaceProject) => void;
}) {
  if (projects.length === 0) {
    return (
      <EmptyResult>
        {loading ? "Načítám projekty…" : "Žádný projekt neodpovídá hledání."}
      </EmptyResult>
    );
  }

  return (
    <div aria-label="Projekty">
      <GroupLabel>Projekty</GroupLabel>
      {projects.map((project, index) => (
        <CommandRow
          key={project._id}
          selected={activeIndex === index}
          onMouseEnter={() => onHover(index)}
          onClick={() => onChoose(project)}
          icon={
            <ProjectIcon
              name={project.name}
              emoji={project.emoji}
              iconUrl={project.iconUrl}
              className="size-7"
            />
          }
          title={project.name}
          subtitle={project.organizationName}
        />
      ))}
    </div>
  );
}

function TaskTitleStep({
  project,
  title,
  statusesLoading,
  pending,
  onSubmit,
}: {
  project: WorkspaceProject | null;
  title: string;
  statusesLoading: boolean;
  pending: boolean;
  onSubmit: () => void;
}) {
  if (!project) {
    return null;
  }
  const disabled = title.trim().length === 0 || statusesLoading || pending;

  return (
    <div>
      <GroupLabel>Vytvořit v projektu</GroupLabel>
      <div className="flex items-center gap-3 px-3 py-2.5">
        <ProjectIcon
          name={project.name}
          emoji={project.emoji}
          iconUrl={project.iconUrl}
          className="size-8"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {project.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {project.organizationName}
          </p>
        </div>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <button
          type="button"
          disabled={disabled}
          onClick={onSubmit}
          className="flex h-11 w-full items-center justify-between rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <span>
            {pending
              ? "Vytvářím úkol…"
              : statusesLoading
                ? "Připravuji projekt…"
                : "Vytvořit úkol"}
          </span>
          <KeyCap inverted>Enter</KeyCap>
        </button>
      </div>
    </div>
  );
}

function CommandRow({
  selected,
  icon,
  title,
  subtitle,
  trailing,
  onMouseEnter,
  onClick,
}: {
  selected: boolean;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={selected ? "true" : undefined}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={cn(
        "flex min-h-12 w-full items-center gap-3 rounded-md px-3 py-2 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 sm:px-4",
        selected
          ? "bg-primary text-primary-foreground"
          : "text-foreground hover:bg-accent",
      )}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center",
          selected ? "text-primary-foreground" : "text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium sm:text-base">
          {title}
        </span>
        {subtitle ? (
          <span
            className={cn(
              "block truncate text-xs",
              selected
                ? "text-primary-foreground/65"
                : "text-muted-foreground",
            )}
          >
            {subtitle}
          </span>
        ) : null}
      </span>
      {trailing ? (
        <span
          className={cn(
            "shrink-0",
            selected
              ? "text-primary-foreground/65"
              : "text-muted-foreground",
          )}
        >
          {trailing}
        </span>
      ) : null}
    </button>
  );
}

function CommandFooter({ step }: { step: WorkspacePaletteStep }) {
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-2 border-t border-border bg-muted/35 px-4 py-2 text-xs text-muted-foreground sm:px-5">
      {step !== "title" ? (
        <span className="hidden items-center gap-1.5 sm:flex">
          <KeyCap>↑</KeyCap>
          <KeyCap>↓</KeyCap>
          Pohyb
        </span>
      ) : null}
      <span className="flex items-center gap-1.5">
        <KeyCap>Enter</KeyCap>
        {step === "title" ? "Vytvořit" : "Vybrat"}
      </span>
      {step !== "commands" ? (
        <span className="hidden items-center gap-1.5 sm:flex">
          <KeyCap>⌫</KeyCap>
          Zpět
        </span>
      ) : null}
      <span className="flex items-center gap-1.5">
        <KeyCap>Esc</KeyCap>
        Zavřít
      </span>
    </div>
  );
}

function KeyCap({
  children,
  inverted = false,
}: {
  children: ReactNode;
  inverted?: boolean;
}) {
  return (
    <kbd
      className={cn(
        "flex min-h-6 min-w-6 items-center justify-center rounded-sm border px-1.5 font-mono text-[0.6875rem] leading-none",
        inverted
          ? "border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground"
          : "border-border bg-background/60 text-foreground",
      )}
    >
      {children}
    </kbd>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 pb-1.5 text-xs font-medium text-muted-foreground sm:px-4">
      {children}
    </p>
  );
}

function EmptyResult({ children }: { children: ReactNode }) {
  return (
    <p className="px-3 py-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function dialogTitle(step: WorkspacePaletteStep): string {
  if (step === "projects") {
    return "Vybrat projekt";
  }
  if (step === "title") {
    return "Vytvořit úkol";
  }
  return "Příkazy";
}

function inputLabel(step: WorkspacePaletteStep): string {
  if (step === "projects") {
    return "Hledat projekt";
  }
  if (step === "title") {
    return "Název nového úkolu";
  }
  return "Hledat příkazy a úkoly";
}

function inputPlaceholder(step: WorkspacePaletteStep): string {
  if (step === "projects") {
    return "Hledat projekt…";
  }
  if (step === "title") {
    return "Název nového úkolu…";
  }
  return "Hledat příkazy a úkoly…";
}

"use client";

import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { MenuIcon } from "lucide-react";
import { Wordmark } from "@/components/layout/wordmark";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { WorkspaceCommandMenuProvider } from "@/components/workspace/workspace-command-menu";
import { WorkspaceProvider } from "@/components/workspace/workspace-provider";
import { WorkspaceSidebar } from "@/components/workspace/workspace-sidebar";
import { useWorkspaceRailWidth } from "@/hooks/use-workspace-rail-width";
import {
  RAIL_WIDTH_MAX,
  RAIL_WIDTH_MIN,
} from "@/lib/workspace-rail";
import { cn } from "@/lib/utils";

/** Keyboard step for the separator, in px per arrow press. */
const RAIL_WIDTH_STEP = 16;

/** Full-height two-pane shell used only by the optional work mode. */
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { width, setWidth, resetWidth } = useWorkspaceRailWidth();
  const [resizing, setResizing] = useState(false);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  function startResize(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    drag.current = { startX: event.clientX, startWidth: width };
    setResizing(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Capture is a convenience, not a requirement — the drag still works
      // while the pointer stays over the handle.
    }
    document.body.classList.add("cursor-col-resize", "select-none");
  }

  function moveResize(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) {
      return;
    }
    setWidth(drag.current.startWidth + event.clientX - drag.current.startX);
  }

  function stopResize() {
    if (!drag.current) {
      return;
    }
    drag.current = null;
    setResizing(false);
    document.body.classList.remove("cursor-col-resize", "select-none");
  }

  function resizeByKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setWidth(width - RAIL_WIDTH_STEP);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setWidth(width + RAIL_WIDTH_STEP);
    }
  }

  return (
    <WorkspaceProvider>
      <WorkspaceCommandMenuProvider>
        <div className="flex h-dvh flex-col overflow-hidden lg:flex-row">
          {/* Desktop rail: a docked strip whose width the user owns. */}
          <div
            className="relative hidden shrink-0 border-r border-sidebar-border lg:block"
            style={{ width }}
          >
            <aside className="h-full bg-sidebar">
              <WorkspaceSidebar />
            </aside>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Šířka panelu úkolů"
              aria-valuenow={width}
              aria-valuemin={RAIL_WIDTH_MIN}
              aria-valuemax={RAIL_WIDTH_MAX}
              title="Táhněte pro změnu šířky, dvojklik vrátí výchozí"
              tabIndex={0}
              onPointerDown={startResize}
              onPointerMove={moveResize}
              onPointerUp={stopResize}
              onPointerCancel={stopResize}
              onLostPointerCapture={stopResize}
              onDoubleClick={resetWidth}
              onKeyDown={resizeByKeyboard}
              className="group absolute inset-y-0 -right-1.5 flex w-3 cursor-col-resize touch-none items-center justify-center outline-none"
            >
              <span
                className={cn(
                  "h-8 w-0.5 rounded-full transition-colors",
                  resizing
                    ? "bg-primary"
                    : "bg-transparent group-hover:bg-sidebar-border group-focus-visible:bg-sidebar-border",
                )}
              />
            </div>
          </div>

          <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur-md lg:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  aria-label="Otevřít úkoly"
                >
                  <MenuIcon />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 bg-sidebar p-0">
                <SheetTitle className="sr-only">Úkoly</SheetTitle>
                <SheetDescription className="sr-only">
                  Úkoly napříč všemi dostupnými projekty.
                </SheetDescription>
                <WorkspaceSidebar onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <Wordmark href="/" />
          </header>

          <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </WorkspaceCommandMenuProvider>
    </WorkspaceProvider>
  );
}

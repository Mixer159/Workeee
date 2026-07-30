"use client";

import { useState, type ReactNode } from "react";
import { MenuIcon } from "lucide-react";
import { SidebarContent } from "@/components/layout/sidebar-content";
import { Wordmark } from "@/components/layout/wordmark";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * Desktop: fixed left sidebar. Mobile (< lg): the same sidebar in a drawer
 * behind a hamburger in the top bar.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border bg-sidebar lg:block">
        <SidebarContent />
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="ghost" size="icon-lg" aria-label="Otevřít menu">
              <MenuIcon />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-sidebar p-0">
            <SheetTitle className="sr-only">Navigace</SheetTitle>
            <SheetDescription className="sr-only">
              Organizace, projekty a nastavení účtu.
            </SheetDescription>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
        <Wordmark href="/" />
      </header>

      <main className="flex-1 lg:pl-64">
        {/* 6xl, not 5xl: the board needs 1088 px for three columns plus "Přidat
            stav", and at 5xl a default project scrolled horizontally on a
            1440 px screen. */}
        <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:px-8 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}

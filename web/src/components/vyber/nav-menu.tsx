"use client";

import { useEffect, useId, useRef, useState } from "react";

export type NavLink = { href: string; label: string; current: boolean };

/**
 * The section links below 1024 px, where the bar has no room for them: a
 * burger button that opens them in a panel under the bar. Escape, a tap
 * outside the bar, choosing a link or widening the window closes it.
 */
export function NavMenu({ links }: { links: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const bar = button.current?.closest("nav");
    const wide = window.matchMedia("(min-width: 1024px)");
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (bar && event.target instanceof Node && !bar.contains(event.target)) setOpen(false);
    };
    const onWide = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    wide.addEventListener("change", onWide);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Zavřít nabídku" : "Otevřít nabídku"}
        data-open={open}
        onClick={() => setOpen((value) => !value)}
        className="nav-burger transition-[background-color] duration-200 ease-out hover:bg-white/10 lg:hidden"
      >
        <span />
        <span />
        <span />
      </button>

      <div id={panelId} className="nav-panel lg:hidden" data-open={open}>
        <ul>
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                aria-current={link.current ? "page" : undefined}
                onClick={() => setOpen(false)}
                className="flex h-12 items-center rounded-inset px-4 text-[1.0625rem] font-medium text-[#dadde3] transition-[background-color,color] duration-200 ease-out hover:bg-white/10 hover:text-white aria-[current=page]:text-white"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

type State = "idle" | "copied" | "failed";

const STROKE = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

/**
 * An icon button in the top right corner of a command block that copies its
 * lines. The icon turns into a check for two seconds; the result also goes to
 * a polite live region, so a screen reader hears it while the button keeps
 * its own name.
 */
export function CopyButton({ lines, label }: { lines: readonly string[]; label: string }) {
  const [state, setState] = useState<State>("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    let next: State = "copied";
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
    } catch {
      next = "failed";
    }
    setState(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        aria-label={label}
        title={state === "copied" ? "Zkopírováno" : "Kopírovat"}
        className="absolute top-2 right-2 inline-flex size-9 items-center justify-center rounded-inset text-[#b9bdc6] transition-[background-color,color] duration-200 ease-out [--focus:#ffffff] hover:bg-white/10 hover:text-white"
      >
        {state === "copied" ? (
          <svg {...STROKE} className="size-[18px] text-[#7ee2b8]">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        ) : (
          <svg {...STROKE} className="size-[18px]">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V6a2 2 0 0 1 2-2h9" />
          </svg>
        )}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied" ? "Zkopírováno" : state === "failed" ? "Kopírování se nepodařilo" : ""}
      </span>
    </>
  );
}

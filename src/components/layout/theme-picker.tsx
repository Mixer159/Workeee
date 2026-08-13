"use client";

import { CheckIcon } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/use-theme";
import { THEMES, type Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemePicker() {
  const { theme, setTheme } = useTheme();

  return (
    <>
      <DropdownMenuLabel>Vzhled</DropdownMenuLabel>
      <div className="grid grid-cols-2 gap-1 p-1 pt-0">
        {THEMES.map((option) => (
          <ThemeOption
            key={option.id}
            theme={option.id}
            label={option.label}
            description={option.description}
            preview={option.preview}
            selected={option.id === theme}
            onSelect={setTheme}
          />
        ))}
      </div>
    </>
  );
}

function ThemeOption({
  theme,
  label,
  description,
  preview,
  selected,
  onSelect,
}: {
  theme: Theme;
  label: string;
  description: string;
  preview: readonly [string, string];
  selected: boolean;
  onSelect: (theme: Theme) => void;
}) {
  return (
    <DropdownMenuItem
      aria-label={`${label}: ${description}`}
      aria-current={selected ? "true" : undefined}
      onSelect={(event) => {
        // Keep the menu open so several palettes can be compared in place.
        event.preventDefault();
        onSelect(theme);
      }}
      className={cn(
        "h-auto min-w-0 flex-col items-stretch gap-1.5 border p-2 focus:border-primary/45",
        selected ? "border-primary/45 bg-accent" : "border-transparent",
      )}
    >
      <span
        aria-hidden
        className="relative h-7 overflow-hidden rounded-md border border-black/10"
        style={{ backgroundColor: preview[0] }}
      >
        <span
          className="absolute inset-y-0 left-0 w-2"
          style={{ backgroundColor: preview[1] }}
        />
        <span
          className="absolute top-1.5 right-1.5 h-1.5 w-7 rounded-sm"
          style={{ backgroundColor: preview[1] }}
        />
        <span className="absolute right-1.5 bottom-1.5 h-1 w-10 rounded-sm bg-black/20" />
      </span>
      <span className="flex min-w-0 items-center gap-1 text-xs font-medium">
        <span className="truncate">{label}</span>
        <CheckIcon
          aria-hidden
          className={cn("ml-auto size-3.5", selected ? "opacity-100" : "opacity-0")}
        />
      </span>
    </DropdownMenuItem>
  );
}

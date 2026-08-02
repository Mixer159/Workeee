"use client";

import { useRef } from "react";
import { Loader2Icon, UploadIcon } from "lucide-react";
import { ProjectIcon } from "@/components/projects/project-icon";
import { Button } from "@/components/ui/button";
import { PROJECT_EMOJIS } from "@/lib/project-emojis";
import { ICON_ACCEPT } from "@/lib/project-icons";
import { cn } from "@/lib/utils";

/**
 * The icon control shared by "Nový projekt" and the project settings.
 *
 * Purely controlled: it renders the current icon, a grid of emoji and the
 * upload button, and hands every choice to its parent. That is what lets the
 * create dialog *stage* a file (there is no project to upload to yet) while the
 * settings dialog writes it immediately, without the two growing two pickers.
 */
export function ProjectIconPicker({
  seed,
  name,
  emoji,
  imageUrl,
  uploading = false,
  disabled = false,
  onSelectEmoji,
  onSelectFile,
  onClear,
}: {
  seed: string;
  name: string;
  emoji: string | null;
  imageUrl: string | null;
  uploading?: boolean;
  disabled?: boolean;
  onSelectEmoji: (emoji: string) => void;
  onSelectFile: (file: File) => void;
  onClear: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const hasIcon = Boolean(emoji || imageUrl);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-medium">Ikona</p>

      <div className="flex items-center gap-3">
        <ProjectIcon
          seed={seed}
          name={name}
          emoji={emoji}
          iconUrl={imageUrl}
          className="size-10 rounded-lg text-base"
        />
        <input
          ref={fileInput}
          type="file"
          accept={ICON_ACCEPT}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Clearing the input is what makes picking the same file twice in a
            // row fire `change` again.
            event.target.value = "";
            if (file) {
              onSelectFile(file);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={disabled || uploading}
          onClick={() => fileInput.current?.click()}
        >
          {uploading ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
          Nahrát obrázek
        </Button>
        {hasIcon ? (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            disabled={disabled || uploading}
            onClick={onClear}
          >
            Odebrat
          </Button>
        ) : null}
      </div>

      <div className="grid max-h-32 grid-cols-8 gap-1 overflow-y-auto rounded-lg border p-2">
        {PROJECT_EMOJIS.map((item) => (
          <button
            key={item}
            type="button"
            disabled={disabled}
            aria-pressed={item === emoji}
            onClick={() => onSelectEmoji(item)}
            className={cn(
              "flex size-8 items-center justify-center rounded-md text-base leading-none transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
              item === emoji ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-muted",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Vyberte emoji, nebo nahrajte čtvercový obrázek (PNG, JPG, WEBP, GIF
        nebo ICO), nejvýš 2 MB.
      </p>
    </div>
  );
}

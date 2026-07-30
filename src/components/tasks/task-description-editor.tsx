"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Block, PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useTheme } from "@/hooks/use-theme";
import { blocknoteCs } from "@/lib/blocknote-cs";
import type { SaveState } from "@/lib/save-state";
import { uploadTaskFile } from "@/lib/upload";

/** How long the editor stays quiet before a change is written. */
const AUTOSAVE_MS = 1000;

/** The copy a failed write toasts with, wherever it is flushed from. */
const SAVE_ERROR = "Popis se nepovedlo uložit.";

/**
 * The task body — a BlockNote document, autosaved.
 *
 * The initial content is passed in **once**, at mount: BlockNote owns the
 * document from then on and pushing every query update back into it would fight
 * whoever is typing. The parent only mounts this component after the query has
 * resolved, and remounts it (via `key`) when the task changes.
 *
 * Saving is reported upwards rather than drawn here: the drawer shows one
 * indicator for the whole task.
 */
export function TaskDescriptionEditor({
  taskId,
  initialContent,
  onSaveState,
}: {
  taskId: Id<"tasks">;
  initialContent: string | null;
  onSaveState: (state: SaveState) => void;
}) {
  const { theme } = useTheme();
  const save = useMutation(api.taskContent.save);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const register = useMutation(api.files.register);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The document waiting to be written, or null when nothing is.
  const pending = useRef<Block[] | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      const uploaded = await uploadTaskFile(
        { generateUploadUrl, register },
        { taskId, file, context: "content" },
      );
      if (!uploaded.url) {
        throw new Error("Soubor se nepovedlo nahrát.");
      }
      return uploaded.url;
    },
    [generateUploadUrl, register, taskId],
  );

  const editor = useCreateBlockNote({
    initialContent: parseContent(initialContent),
    dictionary: blocknoteCs,
    uploadFile,
  });

  // Closing the drawer inside the debounce window must not lose the last edit.
  // The write outlives React here, so it reports nothing and only speaks up
  // when it fails. `save` and `taskId` are stable, so this runs on unmount.
  useEffect(
    () => () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
      const last = pending.current;
      pending.current = null;
      if (last) {
        void save({ taskId, content: JSON.stringify(last) }).catch(() =>
          toast.error(SAVE_ERROR),
        );
      }
    },
    [save, taskId],
  );

  const flush = useCallback(
    async (document: Block[]) => {
      pending.current = null;
      onSaveState("saving");
      try {
        await save({ taskId, content: JSON.stringify(document) });
        onSaveState("saved");
      } catch (error) {
        onSaveState("error");
        toast.error(error instanceof Error ? error.message : SAVE_ERROR);
      }
    },
    [save, taskId, onSaveState],
  );

  const handleChange = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    const document = editor.document;
    pending.current = document;
    saveTimer.current = setTimeout(() => {
      void flush(document);
    }, AUTOSAVE_MS);
  }, [editor, flush]);

  return (
    <section className="workeee-editor">
      <BlockNoteView editor={editor} theme={theme} onChange={handleChange} />
    </section>
  );
}

/**
 * A stored document, or `undefined` for "let BlockNote start with one empty
 * paragraph". An unreadable document must not take the page down — the editor
 * opens empty and the next save overwrites it.
 */
function parseContent(raw: string | null): PartialBlock[] | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as PartialBlock[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

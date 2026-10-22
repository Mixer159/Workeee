"use client";

import { blockHasType } from "@blocknote/core";
import {
  useBlockNoteEditor,
  useComponentsContext,
  useDictionary,
  useEditorState,
} from "@blocknote/react";
import { DownloadIcon } from "lucide-react";
import { saveFile } from "@/lib/file-download";

/**
 * Replaces BlockNote's own download button in the formatting toolbar.
 *
 * Its button does `window.open(url)`, which shows a `.txt` with broken
 * diacritics and saves every other file under its storage UUID. This one saves
 * the bytes under the name the block carries (see `src/lib/file-download.ts`).
 * The selection logic mirrors the original: exactly one selected block that
 * has a `url` prop.
 */
export function EditorFileDownloadButton() {
  const dict = useDictionary();
  const Components = useComponentsContext()!;
  const editor = useBlockNoteEditor();

  const block = useEditorState({
    editor,
    selector: ({ editor }) => {
      const selected = editor.getSelection()?.blocks ?? [
        editor.getTextCursorPosition().block,
      ];
      if (selected.length !== 1) {
        return undefined;
      }
      const block = selected[0]!;
      return blockHasType(block, editor, block.type, {
        url: "string",
        name: "string",
      })
        ? block
        : undefined;
    },
  });

  if (!block || !block.props.url) {
    return null;
  }

  const tooltips = dict.formatting_toolbar.file_download.tooltip;
  const label = tooltips[block.type] ?? tooltips.file;

  return (
    <Components.FormattingToolbar.Button
      className="bn-button"
      label={label}
      mainTooltip={label}
      icon={<DownloadIcon className="size-4" />}
      onClick={() => {
        editor.focus();
        saveFile(block.props.url, block.props.name);
      }}
    />
  );
}

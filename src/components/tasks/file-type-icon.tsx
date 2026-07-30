import {
  FileArchiveIcon,
  FileAudioIcon,
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileVideoIcon,
  ImageIcon,
} from "lucide-react";

/**
 * One icon per family of content type — the only place a MIME string becomes a
 * glyph, so the attachment list and the comment stream never disagree.
 *
 * The branches return elements rather than picking a component into a variable:
 * a component chosen during render is a new component every time as far as React
 * is concerned (`react-hooks/static-components`).
 */
export function FileTypeIcon({
  mimeType,
  className,
}: {
  mimeType: string;
  className?: string;
}) {
  if (mimeType.startsWith("image/")) {
    return <ImageIcon className={className} aria-hidden />;
  }
  if (mimeType.startsWith("audio/")) {
    return <FileAudioIcon className={className} aria-hidden />;
  }
  if (mimeType.startsWith("video/")) {
    return <FileVideoIcon className={className} aria-hidden />;
  }
  if (mimeType.startsWith("text/") || mimeType === "application/pdf") {
    return <FileTextIcon className={className} aria-hidden />;
  }
  if (
    mimeType.includes("zip") ||
    mimeType.includes("compressed") ||
    mimeType.includes("tar")
  ) {
    return <FileArchiveIcon className={className} aria-hidden />;
  }
  if (mimeType.includes("sheet") || mimeType.includes("csv")) {
    return <FileSpreadsheetIcon className={className} aria-hidden />;
  }
  return <FileIcon className={className} aria-hidden />;
}

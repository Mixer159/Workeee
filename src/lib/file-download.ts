import { toast } from "sonner";

/**
 * Save a stored file under its real name.
 *
 * Convex storage serves a blob under its UUID with no `Content-Disposition`
 * and no charset, so a plain link opens a `.txt` inline (Czech text read as
 * Latin-1) and saves everything else as `d540a90d-…` with no extension. The
 * `download` attribute cannot fix that on a cross-origin link, so the bytes are
 * fetched (storage answers CORS for the app's origin) and saved from a
 * same-origin object URL instead. Files are capped at 10 MB, so holding one in
 * memory is fine.
 */
export async function downloadFile(url: string, fileName: string): Promise<void> {
  let blob: Blob;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(String(response.status));
    }
    blob = await response.blob();
  } catch {
    throw new Error("Soubor se nepovedlo stáhnout.");
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = downloadName(fileName, blob.type);
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  // Firefox and Safari read the object URL after the click returns.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}

/** The stored name, or "soubor" with an extension taken from the type. */
export function downloadName(fileName: string, mimeType: string): string {
  const name = fileName.trim();
  if (name.length > 0) {
    return name;
  }
  const subtype = mimeType.split(";")[0]!.split("/")[1]?.trim().toLowerCase();
  const extension = subtype === "jpeg" ? "jpg" : subtype === "plain" ? "txt" : subtype;
  return extension && /^[a-z0-9]+$/.test(extension)
    ? `soubor.${extension}`
    : "soubor";
}

/** `downloadFile` for a click handler: a failure is a toast, not a rejection. */
export function saveFile(url: string, fileName: string): void {
  void downloadFile(url, fileName).catch((error: unknown) =>
    toast.error(
      error instanceof Error ? error.message : "Soubor se nepovedlo stáhnout.",
    ),
  );
}

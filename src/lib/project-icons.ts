/**
 * What a project icon may be, browser side: the `accept` filter of the file
 * input, the size cap and the content type the blob is uploaded under.
 *
 * Everything here is a fail-fast copy of a rule `projects.setIcon` re-checks
 * against the *stored* blob. The server is the authority; this only saves a
 * round trip and says the same sentence while doing it.
 */

/** Mirrors the server cap in `convex/projects.ts`. */
export const MAX_ICON_BYTES = 2 * 1024 * 1024;

/**
 * The file picker's filter. SVG is absent — it is a script surface, and the
 * server blocklists it for the same reason.
 *
 * `.ico` is listed three times on purpose: Chrome names such a file
 * `image/x-icon`, Firefox `image/vnd.microsoft.icon`, and a machine whose
 * registry has no entry for the extension names it nothing at all — there the
 * bare `.ico` is the only thing that gets it past the picker.
 */
export const ICON_ACCEPT =
  "image/png,image/jpeg,image/webp,image/gif,image/x-icon,image/vnd.microsoft.icon,.ico";

/** What Windows favicons arrive as, depending on the browser. */
const ICO_MIME_TYPE = "image/x-icon";

/** The type a browser reports when the operating system could not name a file. */
const UNKNOWN_MIME_TYPE = "application/octet-stream";

/** `image/png;charset=binary` and `IMAGE/PNG` are the same type. */
function baseMimeType(value: string): string {
  return value.split(";")[0]!.trim().toLowerCase();
}

/**
 * The content type the blob is POSTed — and therefore stored — under.
 *
 * `setIcon` trusts the stored type, so a `.ico` the operating system could not
 * name would otherwise reach storage unnamed and be refused as "not an image".
 * The extension is then the only thing left to go on, and trusting it gives
 * away nothing: the browser writes this header itself, so a client that wanted
 * to lie about a file never needed the fallback to do it.
 */
export function iconMimeType(file: File): string {
  const type = baseMimeType(file.type);
  if (type && type !== UNKNOWN_MIME_TYPE) {
    return type;
  }
  return /\.ico$/i.test(file.name) ? ICO_MIME_TYPE : type;
}

/**
 * Reject a file before it leaves the browser, with the sentence the server
 * would have answered with.
 */
export function validateIconFile(file: File): string | null {
  const mimeType = iconMimeType(file);
  if (!mimeType.startsWith("image/") || mimeType === "image/svg+xml") {
    return "Ikona musí být obrázek (PNG, JPG, WEBP, GIF nebo ICO).";
  }
  if (file.size > MAX_ICON_BYTES) {
    return "Obrázek může mít nejvýš 2 MB.";
  }
  return null;
}

"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

export type LightboxImage = { url: string; fileName: string };

/**
 * Full-size view of an image attached to a task or a comment.
 *
 * Convex serves the blob from its own origin and the URL is not worth routing
 * through the Next image optimizer, so this is a plain `<img>` — the same choice
 * `ProjectIcon` makes.
 */
export function ImageLightbox({
  image,
  onClose,
}: {
  image: LightboxImage | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={image !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[min(92vw,64rem)] gap-3 sm:max-w-[min(92vw,64rem)]">
        <DialogTitle className="min-w-0 truncate pr-8 text-sm font-medium">
          {image?.fileName ?? ""}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Náhled přiloženého obrázku
        </DialogDescription>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.url}
            alt={image.fileName}
            className="max-h-[75vh] w-full rounded-lg object-contain"
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ProjectIconPicker } from "@/components/projects/project-icon-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  iconMimeType,
  isSvgFile,
  validateIconFile,
} from "@/lib/project-icons";

/**
 * "Nový projekt": a name and an icon.
 *
 * The icon is *staged*, not uploaded: `projects.generateUploadUrl` is
 * authorized against a project, and there is none until this form is submitted.
 * So an emoji travels with `projects.create`, and an image is uploaded right
 * after it through the ordinary `generateUploadUrl` → `setIcon` path. If that
 * second step fails the project still exists — the toast says so instead of
 * pretending nothing happened.
 */
export function CreateProjectDialog({
  organizationId,
  open,
  onOpenChange,
  onCreated,
}: {
  organizationId: Id<"organizations">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired only on a successful create — the mobile drawer closes with it. */
  onCreated?: () => void;
}) {
  const router = useRouter();
  const fieldId = useId();
  const createProject = useMutation(api.projects.create);
  const generateUploadUrl = useMutation(api.projects.generateUploadUrl);
  const setIcon = useMutation(api.projects.setIcon);
  const setSvgIcon = useMutation(api.projects.setSvgIcon);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string | null>(null);
  // The staged image and its preview URL are one value: the URL is created and
  // revoked where the file changes, never in an effect (`setState` in an effect
  // is a lint error in this repo, and this needs no effect at all).
  const [staged, setStaged] = useState<{ file: File; url: string } | null>(null);
  const [pending, setPending] = useState(false);

  const clearStaged = () => {
    setStaged((current) => {
      if (current) {
        URL.revokeObjectURL(current.url);
      }
      return null;
    });
  };

  const handleSelectFile = (selected: File) => {
    const error = validateIconFile(selected);
    if (error) {
      toast.error(error);
      return;
    }
    const url = URL.createObjectURL(selected);
    setStaged((current) => {
      if (current) {
        URL.revokeObjectURL(current.url);
      }
      return { file: selected, url };
    });
    setEmoji(null);
  };

  const uploadIcon = async (projectId: Id<"projects">, icon: File) => {
    // An SVG takes the other road — see `projects.setSvgIcon`.
    if (isSvgFile(icon)) {
      await setSvgIcon({ projectId, svg: await icon.text() });
      return;
    }
    const uploadUrl = await generateUploadUrl({ projectId });
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": iconMimeType(icon) },
      body: icon,
    });
    if (!response.ok) {
      throw new Error("Nahrání obrázku se nepovedlo.");
    }
    const { storageId } = (await response.json()) as {
      storageId: Id<"_storage">;
    };
    const result = await setIcon({ projectId, storageId });
    if (!result.ok) {
      throw new Error(result.error);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    try {
      const { projectId } = await createProject({
        organizationId,
        name,
        emoji: emoji ?? undefined,
      });
      if (staged) {
        try {
          await uploadIcon(projectId, staged.file);
        } catch (error) {
          toast.error(
            error instanceof Error
              ? `Projekt je založený, ale ikonu se nepovedlo nahrát: ${error.message}`
              : "Projekt je založený, ale ikonu se nepovedlo nahrát.",
          );
        }
      }
      setName("");
      setEmoji(null);
      clearStaged();
      toast.success("Projekt je založený.");
      onOpenChange(false);
      onCreated?.();
      router.push(`/projekt/${projectId}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Projekt se nepovedlo založit.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nový projekt</DialogTitle>
          <DialogDescription>
            Vidí ho všichni členové s přístupem k celé organizaci.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fieldId}>Název</Label>
            <Input
              id={fieldId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Např. Redesign webu"
              maxLength={60}
              required
              autoFocus
              className="h-9"
            />
          </div>

          <ProjectIconPicker
            seed={organizationId}
            name={name}
            emoji={emoji}
            imageUrl={staged?.url ?? null}
            disabled={pending}
            onSelectEmoji={(value) => {
              setEmoji(value === emoji ? null : value);
              clearStaged();
            }}
            onSelectFile={handleSelectFile}
            onClear={() => {
              setEmoji(null);
              clearStaged();
            }}
          />

          <Button type="submit" size="lg" disabled={pending}>
            {pending ? (
              <>
                <Loader2Icon className="animate-spin" />
                Zakládám…
              </>
            ) : (
              "Vytvořit"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

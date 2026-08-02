"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { ArchiveIcon, ArchiveRestoreIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { NameForm } from "@/components/forms/name-form";
import { InvitesPanel } from "@/components/invites/invites-panel";
import { ProjectIconPicker } from "@/components/projects/project-icon-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { iconMimeType, validateIconFile } from "@/lib/project-icons";

type Project = {
  _id: Id<"projects">;
  organizationId: Id<"organizations">;
  name: string;
  archived: boolean;
  emoji: string | null;
  iconUrl: string | null;
};

export function ProjectSettingsDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const rename = useMutation(api.projects.rename);
  const setArchived = useMutation(api.projects.setArchived);
  const generateUploadUrl = useMutation(api.projects.generateUploadUrl);
  const setIcon = useMutation(api.projects.setIcon);
  const setEmoji = useMutation(api.projects.setEmoji);
  const removeIcon = useMutation(api.projects.removeIcon);
  const [uploading, setUploading] = useState(false);

  const handleRename = async (name: string) => {
    try {
      await rename({ projectId: project._id, name });
      toast.success("Název projektu byl uložen.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Název se nepovedlo uložit.",
      );
    }
  };

  const handleFile = async (file: File) => {
    if (uploading) {
      return;
    }
    const invalid = validateIconFile(file);
    if (invalid) {
      toast.error(invalid);
      return;
    }
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl({ projectId: project._id });
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": iconMimeType(file) },
        body: file,
      });
      if (!response.ok) {
        throw new Error("Nahrání souboru se nepovedlo.");
      }
      const { storageId } = (await response.json()) as {
        storageId: Id<"_storage">;
      };
      const result = await setIcon({ projectId: project._id, storageId });
      if (!result.ok) {
        throw new Error(result.error);
      }
      toast.success("Ikona byla nahrána.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Ikonu se nepovedlo nahrát.",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleEmoji = async (emoji: string) => {
    try {
      await setEmoji({ projectId: project._id, emoji });
      toast.success("Ikona byla uložena.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Ikonu se nepovedlo uložit.",
      );
    }
  };

  const handleRemoveIcon = async () => {
    try {
      await removeIcon({ projectId: project._id });
      toast.success("Ikona byla odebrána.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Ikonu se nepovedlo odebrat.",
      );
    }
  };

  const handleArchive = async () => {
    const archived = !project.archived;
    try {
      await setArchived({ projectId: project._id, archived });
      toast.success(
        archived ? "Projekt byl archivován." : "Projekt byl obnoven.",
      );
      if (archived) {
        onOpenChange(false);
        router.push("/");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Akce se nepovedla.",
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* No `DialogDescription`: it could only list the sections that follow.
          `aria-describedby={undefined}` is how Radix is told that on purpose. */}
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[85dvh] overflow-y-auto sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>Nastavení projektu</DialogTitle>
        </DialogHeader>

        <div className="flex min-w-0 flex-col gap-6">
          <NameForm
            key={project.name}
            label="Název"
            initialName={project.name}
            onSubmit={handleRename}
          />

          <Separator />

          <ProjectIconPicker
            seed={project._id}
            name={project.name}
            emoji={project.emoji}
            imageUrl={project.iconUrl}
            uploading={uploading}
            onSelectEmoji={handleEmoji}
            onSelectFile={handleFile}
            onClear={handleRemoveIcon}
          />

          <Separator />

          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Pozvánky do projektu</p>
              <p className="text-xs text-muted-foreground">
                Pozvaný uvidí jen tento projekt, nic dalšího z organizace.
              </p>
            </div>
            <InvitesPanel
              organizationId={project.organizationId}
              projectId={project._id}
            />
          </div>

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">
                {project.archived ? "Obnovit projekt" : "Archivovat projekt"}
              </p>
              <p className="text-xs text-muted-foreground">
                {project.archived
                  ? "Projekt se vrátí do seznamu v levém panelu."
                  : "Projekt zmizí ze seznamu, data zůstanou zachovaná."}
              </p>
            </div>
            <Button
              type="button"
              variant={project.archived ? "outline" : "destructive"}
              size="lg"
              onClick={handleArchive}
            >
              {project.archived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
              {project.archived ? "Obnovit" : "Archivovat"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

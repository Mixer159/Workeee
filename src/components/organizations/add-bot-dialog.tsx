"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { BotIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MEMBER_ACCESS_LABEL, type MemberAccess } from "@/lib/organization";

/**
 * "Přidat bota" — a manager puts one of **their own** bots into this
 * organization. Rendered only when there is a bot left to add, so a manager
 * without bots never sees a button that leads nowhere.
 *
 * A `limited` manager can only hand out `limited` access, and only to
 * projects they can open; the server enforces the same rule.
 */
export function AddBotButton({
  organizationId,
  viewerAccess,
}: {
  organizationId: Id<"organizations">;
  viewerAccess: MemberAccess;
}) {
  const bots = useQuery(api.bots.listMine, { organizationId });
  const [open, setOpen] = useState(false);

  const available = (bots ?? []).filter((bot) => !bot.inOrganization);
  if (available.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="self-start"
        onClick={() => setOpen(true)}
      >
        <BotIcon />
        Přidat bota
      </Button>
      {open ? (
        <AddBotDialog
          organizationId={organizationId}
          viewerAccess={viewerAccess}
          bots={available}
          onOpenChange={setOpen}
        />
      ) : null}
    </>
  );
}

function AddBotDialog({
  organizationId,
  viewerAccess,
  bots,
  onOpenChange,
}: {
  organizationId: Id<"organizations">;
  viewerAccess: MemberAccess;
  bots: { _id: Id<"users">; name: string }[];
  onOpenChange: (open: boolean) => void;
}) {
  const projects = useQuery(api.projects.listVisible, { organizationId });
  const addBot = useMutation(api.bots.addToOrganization);
  const [botId, setBotId] = useState<Id<"users">>(bots[0]._id);
  const [access, setAccess] = useState<MemberAccess>(viewerAccess);
  const [projectIds, setProjectIds] = useState<Id<"projects">[]>([]);
  const [pending, setPending] = useState(false);

  const accessOptions: MemberAccess[] =
    viewerAccess === "full" ? ["full", "limited"] : ["limited"];
  const canSubmit = access === "full" || projectIds.length > 0;

  const toggleProject = (projectId: Id<"projects">, checked: boolean) => {
    setProjectIds((current) =>
      checked
        ? [...current, projectId]
        : current.filter((id) => id !== projectId),
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || !canSubmit) {
      return;
    }
    setPending(true);
    try {
      await addBot({
        organizationId,
        botId,
        access,
        ...(access === "limited" ? { projectIds } : {}),
      });
      toast.success("Bot je v organizaci.");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Bota se nepovedlo přidat.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Přidat bota</DialogTitle>
          <DialogDescription>
            Bot bude v organizaci vidět jako člen se jménem a odznakem Bot.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-bot-bot">Bot</Label>
            <Select
              value={botId}
              onValueChange={(value) => setBotId(value as Id<"users">)}
            >
              <SelectTrigger id="add-bot-bot" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bots.map((bot) => (
                  <SelectItem key={bot._id} value={bot._id}>
                    {bot.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="add-bot-access">Přístup</Label>
            <Select
              value={access}
              onValueChange={(value) => setAccess(value as MemberAccess)}
            >
              <SelectTrigger id="add-bot-access" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accessOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {MEMBER_ACCESS_LABEL[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {access === "limited" ? (
            <ul className="flex max-h-60 flex-col gap-2 overflow-y-auto">
              {(projects ?? []).map((project) => (
                <li key={project._id} className="flex items-center justify-between gap-3">
                  <Label htmlFor={`add-bot-${project._id}`} className="font-normal">
                    {project.name}
                  </Label>
                  <Switch
                    id={`add-bot-${project._id}`}
                    checked={projectIds.includes(project._id)}
                    onCheckedChange={(checked) => toggleProject(project._id, checked)}
                  />
                </li>
              ))}
            </ul>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending || !canSubmit}>
              {pending ? <Loader2Icon className="animate-spin" /> : null}
              Přidat
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

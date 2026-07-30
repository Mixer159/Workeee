"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CopyIcon, LinkIcon, Loader2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { copyToClipboard } from "@/lib/clipboard";
import { formatExpiry } from "@/lib/format";
import {
  DEFAULT_INVITE_EXPIRY,
  INVITE_EXPIRY_OPTIONS,
  INVITE_STATUS_BADGE,
  INVITE_STATUS_LABEL,
  inviteLink,
  type InviteExpiryPreset,
  type InviteStatus,
} from "@/lib/invites";

/**
 * Invite management for one scope: the whole organization when `projectId` is
 * absent, a single project when it is present. Managers only — the server
 * returns an empty list to everyone else.
 */
export function InvitesPanel({
  organizationId,
  projectId,
}: {
  organizationId: Id<"organizations">;
  projectId?: Id<"projects">;
}) {
  // Optional args are omitted, never sent as `undefined`.
  const scope = projectId ? { organizationId, projectId } : { organizationId };
  const invites = useQuery(api.invites.list, scope);
  const createInvite = useMutation(api.invites.create);
  const revokeInvite = useMutation(api.invites.revoke);
  const [expiry, setExpiry] = useState<InviteExpiryPreset>(
    DEFAULT_INVITE_EXPIRY,
  );
  const [pending, setPending] = useState(false);

  const handleCreate = async () => {
    if (pending) {
      return;
    }
    setPending(true);
    try {
      const { code } = await createInvite({ ...scope, expiry });
      await copyToClipboard(inviteLink(code), "Odkaz na pozvánku je ve schránce.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Pozvánku se nepovedlo vytvořit.",
      );
    } finally {
      setPending(false);
    }
  };

  const handleRevoke = async (inviteId: Id<"invites">) => {
    try {
      await revokeInvite({ inviteId });
      toast.success("Pozvánka byla zrušena.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Pozvánku se nepovedlo zrušit.",
      );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={expiry}
          onValueChange={(value) => setExpiry(value as InviteExpiryPreset)}
        >
          <SelectTrigger className="w-36" aria-label="Platnost pozvánky">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INVITE_EXPIRY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" onClick={handleCreate} disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <LinkIcon />}
          Vytvořit pozvánku
        </Button>
      </div>

      {invites === undefined ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : invites.length === 0 ? (
        <p className="text-sm text-muted-foreground">Zatím žádné pozvánky.</p>
      ) : (
        <ul className="divide-y divide-border">
          {invites.map((invite) => (
            <li
              key={invite._id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
            >
              <code className="font-mono text-sm tracking-widest">
                {invite.code}
              </code>
              <Badge
                variant="outline"
                className={INVITE_STATUS_BADGE[invite.status as InviteStatus]}
              >
                {INVITE_STATUS_LABEL[invite.status as InviteStatus]}
              </Badge>
              {projectId ? null : (
                <span className="text-xs text-muted-foreground">
                  {invite.projectName ?? "Celá organizace"}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {formatExpiry(invite.expiresAt, invite.status === "expired")}
              </span>
              <span className="text-xs text-muted-foreground">
                použito {invite.usedCount}×
              </span>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Kopírovat odkaz"
                  onClick={() =>
                    copyToClipboard(
                      inviteLink(invite.code),
                      "Odkaz je ve schránce.",
                    )
                  }
                >
                  <LinkIcon />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Kopírovat kód"
                  onClick={() =>
                    copyToClipboard(invite.code, "Kód je ve schránce.")
                  }
                >
                  <CopyIcon />
                </Button>
                {invite.status === "active" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Zrušit pozvánku"
                    onClick={() => handleRevoke(invite._id)}
                  >
                    <XIcon />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

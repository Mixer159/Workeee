"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  MEMBER_ACCESS_LABEL,
  ORGANIZATION_ROLE_LABEL,
  ORGANIZATION_ROLE_OPTIONS,
  type MemberAccess,
  type OrganizationRole,
} from "@/lib/organization";
import { userInitials } from "@/lib/user";

type PendingRemoval = { userId: Id<"users">; name: string };

export function MembersTable({
  organizationId,
  canManage,
  viewerRole,
}: {
  organizationId: Id<"organizations">;
  canManage: boolean;
  viewerRole: OrganizationRole;
}) {
  const members = useQuery(api.organizations.members, { organizationId });
  const updateRole = useMutation(api.organizations.updateMemberRole);
  const removeMember = useMutation(api.organizations.removeMember);
  const [removing, setRemoving] = useState<PendingRemoval | null>(null);

  const handleRoleChange = async (
    userId: Id<"users">,
    role: OrganizationRole,
  ) => {
    try {
      await updateRole({ organizationId, userId, role });
      toast.success("Role byla změněna.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Roli se nepovedlo změnit.",
      );
    }
  };

  const handleRemove = async () => {
    if (!removing) {
      return;
    }
    try {
      await removeMember({ organizationId, userId: removing.userId });
      toast.success(`${removing.name} byl odebrán z organizace.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Člena se nepovedlo odebrat.",
      );
    } finally {
      setRemoving(null);
    }
  };

  if (members === undefined) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  const ownerCount = members.filter((member) => member.role === "owner").length;

  return (
    <>
      <ul className="divide-y divide-border">
        {members.map((member) => {
          const isLastOwner = member.role === "owner" && ownerCount === 1;
          const canAct =
            canManage &&
            !isLastOwner &&
            (viewerRole === "owner" || member.role !== "owner");
          const roleOptions =
            viewerRole === "owner"
              ? ORGANIZATION_ROLE_OPTIONS
              : ORGANIZATION_ROLE_OPTIONS.filter((role) => role !== "owner");

          return (
            <li
              key={member.membershipId}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3"
            >
              <Avatar className="size-8">
                {member.image ? <AvatarImage src={member.image} alt="" /> : null}
                <AvatarFallback>
                  {userInitials(member.name, member.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{member.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {member.email}
                </span>
              </div>

              <div className="flex flex-col items-end gap-1">
                <Badge variant="outline">
                  {MEMBER_ACCESS_LABEL[member.access as MemberAccess]}
                </Badge>
                {member.access === "limited" && member.projects.length > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {member.projects.map((project) => project.name).join(", ")}
                  </span>
                ) : null}
              </div>

              {canAct ? (
                <Select
                  value={member.role}
                  onValueChange={(value) =>
                    handleRoleChange(member.userId, value as OrganizationRole)
                  }
                >
                  <SelectTrigger
                    size="sm"
                    className="w-32"
                    aria-label={`Role — ${member.name}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ORGANIZATION_ROLE_LABEL[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="w-32 text-sm text-muted-foreground">
                  {ORGANIZATION_ROLE_LABEL[member.role as OrganizationRole]}
                </span>
              )}

              {canAct ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Odebrat ${member.name}`}
                  onClick={() =>
                    setRemoving({ userId: member.userId, name: member.name })
                  }
                >
                  <Trash2Icon />
                </Button>
              ) : (
                <span className="size-8" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ul>

      <AlertDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odebrat člena?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing?.name} ztratí přístup ke všem projektům této organizace.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove}>Odebrat</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

"use client";

import type { ReactNode } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HIDE_LOCK_LABELS,
  type HideOption,
  type VisibilityMember,
} from "@/lib/task-visibility";
import { userInitials } from "@/lib/user";

/**
 * The "Skrýt před" menu: one checkbox per project member, checked = the task
 * is hidden from them. Controlled — the task detail writes every toggle
 * straight to the server, the create flows only stage the list until the task
 * exists. Toggling keeps the menu open, so several people are one visit.
 */
export function HideFromMenu({
  options,
  readOnly = false,
  note,
  onToggle,
  onOpenChange,
  align = "start",
  children,
}: {
  options: HideOption<VisibilityMember>[];
  readOnly?: boolean;
  /** One muted line under the list, e.g. who may change it. */
  note?: string;
  onToggle: (userId: Id<"users">, hidden: boolean) => void;
  onOpenChange?: (open: boolean) => void;
  align?: "start" | "end";
  /** The trigger. */
  children: ReactNode;
}) {
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-72 max-h-80">
        <DropdownMenuLabel>Skrýt před</DropdownMenuLabel>
        {options.length === 0 ? (
          <p className="px-1.5 py-1 text-sm text-muted-foreground">
            V projektu nikdo další není.
          </p>
        ) : (
          options.map(({ member, hidden, lock }) => (
            <DropdownMenuCheckboxItem
              key={member._id}
              checked={hidden}
              disabled={readOnly || lock !== null}
              // Keep the menu open: hiding from three people is three clicks,
              // not three visits.
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(checked) => onToggle(member._id, checked)}
            >
              <Avatar size="sm">
                <AvatarImage src={member.image} alt="" />
                <AvatarFallback>{userInitials(member.name)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate">{member.name}</span>
              {lock ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {HIDE_LOCK_LABELS[lock]}
                </span>
              ) : null}
            </DropdownMenuCheckboxItem>
          ))
        )}
        {note ? (
          <p className="px-1.5 pt-2 pb-1 text-xs text-muted-foreground">{note}</p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

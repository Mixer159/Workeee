"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  KeyRoundIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";
import { CreateOrganizationDialog } from "@/components/organizations/create-organization-dialog";
import { JoinOrganizationDialog } from "@/components/organizations/join-organization-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrganization } from "@/hooks/use-current-organization";

export function OrganizationSwitcher({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { organizations, organization, canManage, setOrganizationId, isLoading } =
    useCurrentOrganization();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  if (isLoading) {
    return <Skeleton className="h-9 w-full" />;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full justify-between font-normal"
          >
            <span className="truncate">
              {organization ? organization.name : "Žádná organizace"}
            </span>
            <ChevronsUpDownIcon className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
        >
          {organizations?.map((item) => (
            <DropdownMenuItem
              key={item._id}
              onSelect={() => setOrganizationId(item._id)}
            >
              <CheckIcon
                className={
                  item._id === organization?._id ? "opacity-100" : "opacity-0"
                }
              />
              <span className="truncate">{item.name}</span>
            </DropdownMenuItem>
          ))}
          {organizations && organizations.length > 0 ? (
            <DropdownMenuSeparator />
          ) : null}
          {organization && canManage ? (
            <DropdownMenuItem asChild>
              <Link href="/nastaveni/organizace" onClick={onNavigate}>
                <SettingsIcon />
                Nastavení organizace
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setCreateOpen(true);
            }}
          >
            <PlusIcon />
            Nová organizace
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setJoinOpen(true);
            }}
          >
            <KeyRoundIcon />
            Připojit se kódem
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrganizationDialog open={createOpen} onOpenChange={setCreateOpen} />
      <JoinOrganizationDialog open={joinOpen} onOpenChange={setJoinOpen} />
    </>
  );
}

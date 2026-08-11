"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronsUpDownIcon,
  LogOutIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useTheme } from "@/hooks/use-theme";
import { authClient } from "@/lib/auth-client";
import { userInitials } from "@/lib/user";

export function UserMenu() {
  const router = useRouter();
  const user = useCurrentUser();
  const { theme, toggleTheme } = useTheme();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (signingOut) {
      return;
    }
    setSigningOut(true);
    try {
      const { error } = await authClient.signOut();
      if (error) {
        throw error;
      }
      router.replace("/prihlaseni");
    } catch {
      setSigningOut(false);
      toast.error("Odhlášení se nepovedlo. Zkuste to prosím znovu.");
    }
  };

  if (user === undefined) {
    return <Skeleton className="h-13 w-full rounded-lg" />;
  }

  if (user === null) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-13 w-full justify-start gap-2.5 rounded-lg px-2 text-left"
        >
          <Avatar className="size-8">
            {user.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback>{userInitials(user.name, user.email)}</AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[0.8125rem] font-medium">{user.name}</span>
            <span className="truncate text-[0.6875rem] font-normal text-muted-foreground">
              {user.email}
            </span>
          </span>
          <ChevronsUpDownIcon className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
        {/* Personal, not organization-wide — which is why it hangs off the
            person and not off the organization switcher above. The full label:
            the rail's "Upozornění" is the feed, and one word must not name two
            doors on one screen. */}
        <DropdownMenuItem asChild>
          <Link href="/nastaveni/upozorneni">
            <SettingsIcon />
            Nastavení upozornění
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault();
            toggleTheme();
          }}
        >
          {/* The label names what the click does, not what is on now — a sun
              icon next to "Tmavý režim" said two opposite things. */}
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          {theme === "dark" ? "Světlý režim" : "Tmavý režim"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={signingOut}
          onSelect={(event) => {
            event.preventDefault();
            void handleSignOut();
          }}
        >
          <LogOutIcon />
          Odhlásit se
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

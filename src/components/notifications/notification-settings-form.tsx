"use client";

import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";

/**
 * The one control of `/nastaveni/upozorneni`.
 *
 * It writes on change, the way everything else in this app does — there is no
 * Uložit button. Success is silent, only a failure toasts.
 *
 * The switch has **no local state**: it is driven by the query, and the flip
 * feels instant because the mutation carries an optimistic update. A `useState`
 * mirror would have to be synced back from the query in an effect, which is
 * both a `setState` in `useEffect` (this repo's lint forbids it) and a race
 * with the server.
 */
export function NotificationSettingsForm() {
  const settings = useQuery(api.notifications.settings);
  const setTaskEmails = useMutation(
    api.notifications.setTaskEmails,
  ).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.notifications.settings, {});
    if (current) {
      store.setQuery(
        api.notifications.settings,
        {},
        { ...current, taskEmails: args.enabled },
      );
    }
  });

  if (settings === undefined) {
    return <Skeleton className="h-10 w-full" />;
  }

  if (settings === null) {
    return null;
  }

  const handleChange = async (enabled: boolean) => {
    try {
      await setTaskEmails({ enabled });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nastavení se nepovedlo uložit.",
      );
    }
  };

  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex flex-col gap-1">
        <Label htmlFor="task-emails" className="text-sm font-medium">
          Posílat e-mailem
        </Label>
        <p className="text-sm text-muted-foreground">
          Chodí na {settings.email}.
        </p>
      </div>
      <Switch
        id="task-emails"
        checked={settings.taskEmails}
        onCheckedChange={(enabled) => void handleChange(enabled)}
      />
    </div>
  );
}

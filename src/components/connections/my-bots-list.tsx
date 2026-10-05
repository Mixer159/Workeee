"use client";

import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { BotAvatar } from "@/components/connections/bot-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";

/**
 * The bots this person owns. They are created by the bot itself — its first
 * `sync_bot_identity` — so an empty list is the normal state before the first
 * connection, and the copy says what to do about it.
 */
export function MyBotsList() {
  const bots = useQuery(api.bots.listMine, {});

  if (bots === undefined) {
    return <Skeleton className="h-12 w-full" />;
  }

  if (bots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Zatím žádný bot. Objeví se tu, jakmile se poprvé připojí a zavolá
        sync_bot_identity.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {bots.map((bot) => (
        <li key={bot._id} className="flex items-center gap-3 py-3">
          <BotAvatar name={bot.name} image={bot.image} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{bot.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {bot.lastSyncedAt
                ? `Profil naposledy synchronizován ${formatDateTime(bot.lastSyncedAt)}`
                : "Profil zatím nesynchronizován"}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

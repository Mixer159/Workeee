"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { Loader2Icon } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** What `botWebhooks.list` says about one bot — never the secret itself. */
export type BotWebhookConfig = {
  url: string;
  hasSecret: boolean;
  headerName: string | null;
};

/**
 * "Webhook" — the organization owner tells Workeee where to POST when the bot
 * is mentioned or handed a task. Mounted only while open, so every opening
 * starts from what the server holds.
 *
 * The stored key is never shown, and there is no way to show it: the query
 * only answers `hasSecret`. An empty key field therefore means "keep the one
 * you have", which the server reads the same way.
 */
export function BotWebhookDialog({
  organizationId,
  bot,
  webhook,
  onOpenChange,
}: {
  organizationId: Id<"organizations">;
  bot: { userId: Id<"users">; name: string };
  webhook: BotWebhookConfig | null;
  onOpenChange: (open: boolean) => void;
}) {
  const setWebhook = useMutation(api.botWebhooks.set);
  const clearWebhook = useMutation(api.botWebhooks.clear);
  const [url, setUrl] = useState(webhook?.url ?? "");
  const [secret, setSecret] = useState("");
  const [headerName, setHeaderName] = useState(webhook?.headerName ?? "");
  const [pending, setPending] = useState<"save" | "clear" | null>(null);

  const hasSecret = webhook?.hasSecret ?? false;
  const canSubmit = url.trim().length > 0 && (hasSecret || secret.length > 0);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || !canSubmit) {
      return;
    }
    setPending("save");
    try {
      await setWebhook({
        organizationId,
        botId: bot.userId,
        url,
        headerName,
        ...(secret.length > 0 ? { secret } : {}),
      });
      toast.success("Webhook je uložený.");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Webhook se nepovedlo uložit.",
      );
    } finally {
      setPending(null);
    }
  };

  const handleClear = async () => {
    if (pending) {
      return;
    }
    setPending("clear");
    try {
      await clearWebhook({ organizationId, botId: bot.userId });
      toast.success("Webhook je odebraný.");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Webhook se nepovedlo odebrat.",
      );
    } finally {
      setPending(null);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Webhook</DialogTitle>
          <DialogDescription>
            Když někdo bota {bot.name} zmíní v komentáři nebo mu přiřadí úkol,
            Workeee pošle na tuto adresu POST.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bot-webhook-url">URL</Label>
            <Input
              id="bot-webhook-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://"
              maxLength={2048}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bot-webhook-secret">Klíč</Label>
            <Input
              id="bot-webhook-secret"
              type="password"
              // Not a login: a browser that offered a saved password here
              // would send it to the bot.
              autoComplete="new-password"
              spellCheck={false}
              placeholder={hasSecret ? "uložen — ponechte prázdné" : "16 až 256 znaků"}
              maxLength={256}
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              aria-describedby="bot-webhook-secret-hint"
            />
            <p id="bot-webhook-secret-hint" className="text-xs text-muted-foreground">
              Přijde v hlavičce <span className="font-mono">Authorization: Bearer</span>.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bot-webhook-header">Vlastní hlavička</Label>
            <Input
              id="bot-webhook-header"
              autoComplete="off"
              spellCheck={false}
              placeholder="Nepovinné, třeba X-Webhook-Secret"
              maxLength={64}
              value={headerName}
              onChange={(event) => setHeaderName(event.target.value)}
              aria-describedby="bot-webhook-header-hint"
            />
            <p id="bot-webhook-header-hint" className="text-xs text-muted-foreground">
              Klíč se pošle i v ní.
            </p>
          </div>

          <DialogFooter className={webhook ? "sm:justify-between" : undefined}>
            {webhook ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={pending !== null}
                onClick={handleClear}
              >
                {pending === "clear" ? <Loader2Icon className="animate-spin" /> : null}
                Odebrat
              </Button>
            ) : null}
            <Button type="submit" disabled={pending !== null || !canSubmit}>
              {pending === "save" ? <Loader2Icon className="animate-spin" /> : null}
              Uložit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

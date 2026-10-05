"use client";

import { useId, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { BotIcon, KeyRoundIcon, Loader2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { NewTokenDialog } from "@/components/connections/new-token-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatDateTime } from "@/lib/format";

/**
 * The personal API tokens of `/nastaveni/propojeni`: name one, get the secret
 * once, revoke it later. The list never shows a secret — the server does not
 * have one to show, only its hash and the first few characters.
 */
export function ApiTokensPanel() {
  const fieldId = useId();
  const tokens = useQuery(api.apiTokens.list);
  const createToken = useAction(api.apiTokens.create);
  const revokeToken = useMutation(api.apiTokens.revoke);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  // The freshly minted secret. Lives only as long as the dialog showing it.
  const [minted, setMinted] = useState<string | null>(null);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || name.trim().length === 0) {
      return;
    }
    setPending(true);
    try {
      const { token } = await createToken({ name });
      setMinted(token);
      setName("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Token se nepovedlo vytvořit.",
      );
    } finally {
      setPending(false);
    }
  };

  const handleRevoke = async (tokenId: Id<"apiTokens">) => {
    try {
      await revokeToken({ tokenId });
      toast.success("Token byl zrušen.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Token se nepovedlo zrušit.",
      );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleCreate} className="flex flex-col gap-1.5">
        <Label htmlFor={fieldId}>Název tokenu</Label>
        <div className="flex items-center gap-2">
          <Input
            id={fieldId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Např. Codie v Groku"
            maxLength={60}
            className="h-9 max-w-sm"
          />
          <Button
            type="submit"
            size="lg"
            disabled={pending || name.trim().length === 0}
          >
            {pending ? <Loader2Icon className="animate-spin" /> : <KeyRoundIcon />}
            Vytvořit token
          </Button>
        </div>
      </form>

      {tokens === undefined ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : tokens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Zatím žádné tokeny.</p>
      ) : (
        <ul className="divide-y divide-border">
          {tokens.map((token) => (
            <li
              key={token._id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
            >
              <span className="text-sm font-medium">{token.name}</span>
              <code className="font-mono text-xs text-muted-foreground">
                {token.tokenPrefix}…
              </code>
              {token.revoked ? <Badge variant="outline">Zrušený</Badge> : null}
              {token.bot ? (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <BotIcon className="size-3.5" aria-hidden="true" />
                  {token.bot.name}
                </span>
              ) : null}
              <span className="text-xs text-muted-foreground">
                vytvořen {formatDate(token.createdAt)}
              </span>
              <span className="text-xs text-muted-foreground">
                {token.lastUsedAt
                  ? `naposledy použit ${formatDateTime(token.lastUsedAt)}`
                  : "zatím nepoužit"}
              </span>
              {token.revoked ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto"
                  aria-label={`Zrušit token ${token.name}`}
                  onClick={() => handleRevoke(token._id)}
                >
                  <XIcon />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <NewTokenDialog
        token={minted}
        onOpenChange={(open) => {
          if (!open) {
            setMinted(null);
          }
        }}
      />
    </div>
  );
}

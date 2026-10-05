"use client";

import { CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { copyToClipboard } from "@/lib/clipboard";
import { mcpClientConfig } from "@/lib/mcp";

/**
 * The one moment a token's secret is visible. Closing the dialog drops it from
 * memory, and the server never had it in readable form — so the copy says so,
 * plainly, before the person clicks away.
 */
export function NewTokenDialog({
  token,
  onOpenChange,
}: {
  token: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={token !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Token je vytvořený</DialogTitle>
          <DialogDescription>
            Zkopírujte si ho hned. Po zavření ho už nikdo neuvidí, ani Workeee.
          </DialogDescription>
        </DialogHeader>
        {token ? (
          <div className="flex flex-col gap-3">
            <code className="block rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs break-all">
              {token}
            </code>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => copyToClipboard(token, "Token je ve schránce.")}
              >
                <CopyIcon />
                Kopírovat token
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  copyToClipboard(
                    mcpClientConfig(token),
                    "Konfigurace MCP je ve schránce.",
                  )
                }
              >
                <CopyIcon />
                Kopírovat konfiguraci MCP
              </Button>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Hotovo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

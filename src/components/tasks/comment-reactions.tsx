"use client";

import { useState, type FormEvent } from "react";
import type { FunctionReturnType } from "convex/server";
import { useMutation } from "convex/react";
import { SmilePlusIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { plural } from "@convex/lib/plural";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type CommentReaction = FunctionReturnType<
  typeof api.comments.listByTask
>[number]["reactions"][number];

const QUICK_REACTIONS = ["👍", "❤️", "😂", "🎉", "😮", "😢", "🙌", "👀"] as const;

/** Grouped emoji reactions and their picker, anchored directly to one comment. */
export function CommentReactions({
  commentId,
  reactions,
}: {
  commentId: Id<"comments">;
  reactions: CommentReaction[];
}) {
  const toggleReaction = useMutation(api.commentReactions.toggle);
  const [open, setOpen] = useState(false);
  const [customEmoji, setCustomEmoji] = useState("");
  const [pendingEmoji, setPendingEmoji] = useState<string | null>(null);

  const toggle = async (emoji: string) => {
    if (pendingEmoji) {
      return;
    }
    setPendingEmoji(emoji);
    try {
      await toggleReaction({ commentId, emoji });
      setCustomEmoji("");
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Reakci se nepovedlo uložit.",
      );
    } finally {
      setPendingEmoji(null);
    }
  };

  const submitCustom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (customEmoji.trim()) {
      void toggle(customEmoji);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          aria-pressed={reaction.reactedByMe}
          aria-label={`${reaction.emoji}, ${reaction.count} ${plural(
            reaction.count,
            "reakce",
            "reakce",
            "reakcí",
          )}${reaction.reactedByMe ? ", vaše reakce" : ""}`}
          disabled={pendingEmoji !== null}
          onClick={() => void toggle(reaction.emoji)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-transparent px-2 text-xs tabular-nums transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-50",
            reaction.reactedByMe &&
              "border-primary/60 bg-primary/10 text-foreground hover:bg-primary/15",
          )}
        >
          <span className="text-sm leading-none">{reaction.emoji}</span>
          <span>{reaction.count}</span>
        </button>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Přidat reakci"
            disabled={pendingEmoji !== null}
            className={cn(reactions.length === 0 && "-ml-1")}
          >
            <SmilePlusIcon />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={12}
          onEscapeKeyDown={(event) => event.stopPropagation()}
        >
          <div className="grid grid-cols-8 gap-1">
            {QUICK_REACTIONS.map((emoji) => (
              <Button
                key={emoji}
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Reagovat ${emoji}`}
                disabled={pendingEmoji !== null}
                onClick={() => void toggle(emoji)}
                className="text-lg"
              >
                {emoji}
              </Button>
            ))}
          </div>

          <form onSubmit={submitCustom} className="mt-3 flex gap-2 border-t border-border pt-3">
            <label htmlFor={`reaction-${commentId}`} className="sr-only">
              Libovolné emoji
            </label>
            <Input
              id={`reaction-${commentId}`}
              value={customEmoji}
              onChange={(event) => setCustomEmoji(event.currentTarget.value)}
              placeholder="Jiné emoji"
              autoComplete="off"
              maxLength={32}
              disabled={pendingEmoji !== null}
              className="h-8"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!customEmoji.trim() || pendingEmoji !== null}
            >
              Přidat
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}

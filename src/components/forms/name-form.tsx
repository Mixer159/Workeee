"use client";

import { useId, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Rename control shared by the organization and project settings. Mount it with
 * `key={name}` so it picks up a rename made in another tab.
 */
export function NameForm({
  label,
  initialName,
  submitLabel = "Uložit",
  onSubmit,
}: {
  label: string;
  initialName: string;
  submitLabel?: string;
  onSubmit: (name: string) => Promise<void>;
}) {
  const fieldId = useId();
  const [name, setName] = useState(initialName);
  const [pending, setPending] = useState(false);
  const dirty = name.trim() !== initialName.trim();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || !dirty) {
      return;
    }
    setPending(true);
    try {
      await onSubmit(name);
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      <Label htmlFor={fieldId}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={fieldId}
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={60}
          required
          className="h-9 max-w-sm"
        />
        <Button type="submit" size="lg" variant="outline" disabled={pending || !dirty}>
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

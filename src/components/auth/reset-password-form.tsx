"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 256;

/**
 * Step two of the reset: the page the e-mailed link lands on.
 *
 * Better Auth's callback has already checked the token once and put it in
 * `?token=` — or put `?error=INVALID_TOKEN` there instead. Without a usable
 * token the card only offers the way back to asking for a new link. The token
 * is checked again by `resetPassword` itself, so a link that expired while the
 * page sat open fails with the same message rather than silently.
 *
 * Every session that knew the old password is revoked server-side, so the
 * person signs in fresh afterwards; the done state links there.
 */
export function ResetPasswordForm({
  token,
  invalid,
}: {
  token: string | null;
  invalid: boolean;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const usable = token !== null && !invalid;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || !token) {
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Heslo musí mít alespoň ${MIN_PASSWORD_LENGTH} znaků.`);
      return;
    }
    if (password !== confirmation) {
      toast.error("Hesla se neshodují.");
      return;
    }
    setPending(true);
    const { error } = await authClient.resetPassword({
      newPassword: password,
      token,
    });
    setPending(false);
    if (error) {
      toast.error(authErrorMessage(error));
      return;
    }
    setDone(true);
  };

  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle>Nové heslo</CardTitle>
        <CardDescription>
          {done
            ? "Heslo je změněné. Přihlaste se s ním."
            : usable
              ? "Zvolte si nové heslo k účtu."
              : "Odkaz pro obnovu hesla je neplatný nebo už vypršel. Požádejte o nový."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {usable && !done ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Nové heslo</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                autoFocus
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={MAX_PASSWORD_LENGTH}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Alespoň {MIN_PASSWORD_LENGTH} znaků.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmation">Nové heslo znovu</Label>
              <Input
                id="confirmation"
                type="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={MAX_PASSWORD_LENGTH}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={pending}
              className="w-full"
            >
              {pending ? (
                <>
                  <Loader2Icon className="animate-spin" />
                  Ukládám…
                </>
              ) : (
                "Nastavit heslo"
              )}
            </Button>
          </form>
        ) : (
          <p className="text-sm">
            <Link
              href={done ? "/prihlaseni" : "/obnova-hesla"}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {done ? "Přihlásit se" : "Poslat nový odkaz"}
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

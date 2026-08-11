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
import { goAfterAuth } from "@/lib/auth-redirect";

/**
 * `inviteCode` carries a pending invite through the auth detour: after signing
 * in we land back on the join page instead of the dashboard.
 */
export function SignInForm({ inviteCode }: { inviteCode?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    const { error } = await authClient.signIn.email({
      email: email.trim(),
      password,
    });
    if (error) {
      setPending(false);
      toast.error(authErrorMessage(error));
      return;
    }
    goAfterAuth(inviteCode);
  };

  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle>Přihlášení</CardTitle>
        {/* "Pracovní prostor" was a word this app uses nowhere else. */}
        <CardDescription>Pokračujte do svých projektů.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Heslo</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending ? (
              <>
                <Loader2Icon className="animate-spin" />
                Přihlašuji…
              </>
            ) : (
              "Přihlásit se"
            )}
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">
          Nemáte účet?{" "}
          <Link
            href={
              inviteCode
                ? `/registrace?invite=${encodeURIComponent(inviteCode)}`
                : "/registrace"
            }
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Vytvořte si ho
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

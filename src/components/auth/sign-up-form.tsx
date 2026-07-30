"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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

const MAX_NAME_LENGTH = 60;
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 256;

/**
 * `inviteCode` carries a pending invite through the auth detour: after signing
 * up we land back on the join page instead of the dashboard.
 */
export function SignUpForm({ inviteCode }: { inviteCode?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) {
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error("Heslo musí mít alespoň 12 znaků.");
      return;
    }
    setPending(true);
    const { error } = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
    });
    if (error) {
      setPending(false);
      toast.error(authErrorMessage(error));
      return;
    }
    router.push(inviteCode ? `/join/${encodeURIComponent(inviteCode)}` : "/");
  };

  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle>Vytvoření účtu</CardTitle>
        {/* With a pending invite the next step is decided already — promising a
            choice of organizations would be wrong. */}
        <CardDescription>
          {inviteCode
            ? "Hned potom pozvánku přijmete."
            : "Za chvíli budete moct založit organizaci nebo se k nějaké připojit."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Jméno</Label>
            <Input
              id="name"
              type="text"
              autoComplete="name"
              required
              maxLength={MAX_NAME_LENGTH}
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-9"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-9"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Heslo</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              maxLength={MAX_PASSWORD_LENGTH}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-9"
            />
            <p className="text-xs text-muted-foreground">Alespoň 12 znaků.</p>
          </div>
          <Button type="submit" size="lg" disabled={pending} className="w-full">
            {pending ? (
              <>
                <Loader2Icon className="animate-spin" />
                Zakládám účet…
              </>
            ) : (
              "Založit účet"
            )}
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">
          Už účet máte?{" "}
          <Link
            href={
              inviteCode
                ? `/prihlaseni?invite=${encodeURIComponent(inviteCode)}`
                : "/prihlaseni"
            }
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Přihlaste se
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

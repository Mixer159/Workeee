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

/** Where the link in the e-mail lands. Relative: Better Auth resolves it against SITE_URL. */
const RESET_PAGE = "/nove-heslo";

/**
 * Step one of the reset: ask for the address, send the link.
 *
 * The server answers "sent" whether or not the address has an account — that is
 * Better Auth's own anti-enumeration behaviour — so the confirmation copy says
 * "if", and there is nothing to retry from here except waiting for the mail.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) {
      return;
    }
    setPending(true);
    const address = email.trim();
    const { error } = await authClient.requestPasswordReset({
      email: address,
      redirectTo: RESET_PAGE,
    });
    setPending(false);
    if (error) {
      toast.error(authErrorMessage(error));
      return;
    }
    setSentTo(address);
  };

  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle>Obnova hesla</CardTitle>
        <CardDescription>
          {sentTo
            ? `Pokud k adrese ${sentTo} patří účet, přišel na ni odkaz pro nastavení nového hesla. Platí hodinu.`
            : "Pošleme vám odkaz, kterým si nastavíte nové heslo."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sentTo ? null : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
                  Odesílám…
                </>
              ) : (
                "Poslat odkaz"
              )}
            </Button>
          </form>
        )}
        <p className={sentTo ? "text-sm" : "mt-4 text-sm text-muted-foreground"}>
          <Link
            href="/prihlaseni"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Zpět na přihlášení
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

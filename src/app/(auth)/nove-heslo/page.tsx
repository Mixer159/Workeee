import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Nové heslo do Workeee",
};

/**
 * Better Auth's reset callback lands here with `?token=<valid>` or, when the
 * link is stale or reused, `?error=INVALID_TOKEN`. Both are read once on the
 * server and handed to the form; the URL is never written back.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  return (
    <ResetPasswordForm token={token ?? null} invalid={error !== undefined} />
  );
}

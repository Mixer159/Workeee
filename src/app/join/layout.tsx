import type { ReactNode } from "react";
import { Wordmark } from "@/components/layout/wordmark";

export default function JoinLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12">
      <Wordmark />
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

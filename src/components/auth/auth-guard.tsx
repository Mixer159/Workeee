"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Client-side route gate. Advisory only — every Convex function re-authorizes
 * on the server.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useConvexAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/prihlaseni");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return <AuthGuardSkeleton />;
  }

  return <>{children}</>;
}

function AuthGuardSkeleton() {
  return (
    <div className="flex min-h-dvh">
      <div className="hidden w-64 shrink-0 flex-col gap-4 border-r border-sidebar-border bg-sidebar p-4 lg:flex">
        <Skeleton className="h-9 w-full" />
        <div className="flex flex-col gap-2 pt-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
        <Skeleton className="mt-auto h-12 w-full" />
      </div>
      <div className="flex-1 p-6">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-3 h-4 w-72" />
      </div>
    </div>
  );
}

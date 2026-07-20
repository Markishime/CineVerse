"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";

/**
 * Gates children behind Firebase sign-in.
 * Catalog browsing stays free; playback / personal features require an account.
 */
export function AuthGate({
  children,
  title = "Sign in to continue",
  description = "Create a free unlimited account to watch trailers, track seasons, and save your library. No subscription fees.",
  className,
}: {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
}) {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div className={className}>
        <div className="h-48 skeleton rounded-2xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div
        className={`relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-8 text-center ${className ?? ""}`}
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)]/20 text-[var(--primary-light)]">
          <Lock className="h-6 w-6" />
        </div>
        <h3 className="mt-4 font-display text-xl font-semibold text-white">
          {title}
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--text-secondary)]">
          {description}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/login">
            <Button>Sign in</Button>
          </Link>
          <Link href="/signup">
            <Button variant="secondary">Create free account</Button>
          </Link>
        </div>
        <p className="mt-4 text-xs text-[var(--text-muted)]">
          Free forever · Unlimited browsing · Google or email
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

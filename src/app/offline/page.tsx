import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-3xl font-bold">You&apos;re offline</h1>
      <p className="mt-2 text-[var(--text-muted)]">
        The CineVerse shell is available offline. Cached pages and your guest
        watchlist still work when possible.
      </p>
      <Link href="/" className="mt-6">
        <Button>Retry</Button>
      </Link>
    </div>
  );
}

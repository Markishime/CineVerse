import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--primary-light)]">
        Connection
      </p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-white">
        You&apos;re offline
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
        The CineVerse shell stays available offline. Cached pages and your guest
        list still work when possible.
      </p>
      <Link href="/" className="mt-8">
        <Button>Retry</Button>
      </Link>
    </div>
  );
}

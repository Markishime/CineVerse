import { Suspense } from "react";
import { WatchPage } from "@/components/content/watch-page";

/**
 * Legal in-app watch page.
 * Plays only rights-approved sources (Cloudflare Stream, PD, official YouTube, etc.).
 * Uses legal/cloud playback resolution; embed fallbacks are AutoEmbed / VidCore / 2Embed only.
 */
export default async function WatchRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ season?: string; episode?: string; play?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[var(--background)]">
          <div className="h-48 w-full max-w-4xl skeleton rounded-2xl mx-4" />
        </div>
      }
    >
      <WatchPage
        slug={slug}
        season={sp.season ? Number(sp.season) : undefined}
        episode={sp.episode ? Number(sp.episode) : undefined}
        play={sp.play}
      />
    </Suspense>
  );
}

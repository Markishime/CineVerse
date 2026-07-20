"use client";

import { useState } from "react";
import { ExternalLink, Film, Maximize2, Play } from "lucide-react";
import type { Trailer, WatchProvider } from "@/types/content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { YouTubeMoviePlayer } from "./youtube-movie-player";
import { HlsPlayer } from "./hls-player";
import { VimeoPlayer } from "./vimeo-player";
import { StreamPlayer } from "./stream-player";

export type WatchAvailability = "watch_now" | "trailer_only" | "unavailable";

export interface LegalFullSource {
  type: "archive" | "youtube" | "hls" | "mp4" | "vimeo" | "cloudflare";
  embedUrl: string;
  label: string;
  sourceType?: string;
  attributionText?: string;
  rightsHolder?: string;
  youtubeVideoId?: string;
  vimeoVideoId?: string;
  cloudflareVideoUid?: string;
  cloudflareCustomerCode?: string;
  cloudflareToken?: string;
}

interface MediaPlayerProps {
  title: string;
  trailer?: Trailer | null;
  legalFull?: LegalFullSource | null;
  eligible?: boolean;
  reason?: string;
  autoOpenTrailer?: boolean;
  autoOpenFull?: boolean;
  providers?: WatchProvider[];
  className?: string;
  keepInApp?: boolean;
  onProgress?: (seconds: number) => void;
  onComplete?: () => void;
}

/**
 * In-app player for CineVerse legal streaming:
 * - Official YouTube embeds (full or trailer) via IFrame API
 * - Archive.org public-domain prints
 * - HLS/MP4 for owned/licensed short-lived signed URLs
 * - Vimeo for licensed embeds
 * - Cloudflare Stream for owned/licensed full movies & episodes
 * Never uses TMDB as a stream source. Never restreams commercial platforms.
 */
export function MediaPlayer({
  title,
  trailer,
  legalFull,
  eligible,
  autoOpenTrailer,
  autoOpenFull,
  providers = [],
  className,
  keepInApp = true,
  onProgress,
  onComplete,
}: MediaPlayerProps) {
  const canFull = Boolean(eligible && legalFull);
  const trailerKey = trailer?.key?.trim();
  const hasTrailer = Boolean(trailer?.site === "youtube" && trailerKey);

  const availability: WatchAvailability = canFull
    ? "watch_now"
    : hasTrailer
      ? "trailer_only"
      : "unavailable";

  return (
    <MediaPlayerInner
      key={`${title}-${canFull ? "full" : "std"}-${trailerKey ?? "none"}-${autoOpenFull ? "af" : ""}-${autoOpenTrailer ? "at" : ""}`}
      title={title}
      trailer={trailer}
      legalFull={legalFull}
      canFull={canFull}
      hasTrailer={hasTrailer}
      availability={availability}
      autoOpenTrailer={autoOpenTrailer}
      autoOpenFull={autoOpenFull}
      trailerKey={trailerKey}
      providers={providers}
      className={className}
      keepInApp={keepInApp}
      onProgress={onProgress}
      onComplete={onComplete}
    />
  );
}

function MediaPlayerInner({
  title,
  trailer,
  legalFull,
  canFull,
  hasTrailer,
  availability,
  autoOpenTrailer,
  autoOpenFull,
  trailerKey,
  providers,
  className,
  keepInApp,
  onProgress,
  onComplete,
}: {
  title: string;
  trailer?: Trailer | null;
  legalFull?: LegalFullSource | null;
  canFull: boolean;
  hasTrailer: boolean;
  availability: WatchAvailability;
  autoOpenTrailer?: boolean;
  autoOpenFull?: boolean;
  trailerKey?: string;
  providers: WatchProvider[];
  className?: string;
  keepInApp: boolean;
  onProgress?: (seconds: number) => void;
  onComplete?: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "trailer" | "full">(() => {
    // Prefer full when available and not explicitly opening trailer
    if (canFull && (autoOpenFull || !autoOpenTrailer)) return "full";
    // Trailer only when explicitly requested — never hijack Watch Now
    if (hasTrailer && autoOpenTrailer) return "trailer";
    if (canFull) return "full";
    return "idle";
  });

  const youtubeFullId =
    legalFull?.youtubeVideoId ||
    (legalFull?.type === "youtube"
      ? legalFull.embedUrl.match(/(?:embed\/|v=)([a-zA-Z0-9_-]{6,20})/)?.[1]
      : undefined);

  const vimeoId =
    legalFull?.vimeoVideoId ||
    (legalFull?.type === "vimeo"
      ? legalFull.embedUrl.match(/video\/(\d+)/)?.[1]
      : undefined);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[var(--glow-primary)]">
        {mode === "trailer" && trailerKey ? (
          <YouTubeMoviePlayer
            videoId={trailerKey}
            title={`${title} official trailer`}
            autoplay
          />
        ) : mode === "full" && legalFull ? (
          legalFull.type === "youtube" && youtubeFullId ? (
            <YouTubeMoviePlayer
              videoId={youtubeFullId}
              title={`${title} full playback`}
              autoplay
              onProgress={onProgress}
              onComplete={onComplete}
            />
          ) : legalFull.type === "vimeo" && vimeoId ? (
            <VimeoPlayer
              videoId={vimeoId}
              onProgress={onProgress}
              onComplete={onComplete}
            />
          ) : legalFull.type === "cloudflare" &&
            (legalFull.cloudflareVideoUid ||
              legalFull.embedUrl.includes("cloudflarestream.com")) ? (
            <StreamPlayer
              videoUid={
                legalFull.cloudflareVideoUid ||
                legalFull.embedUrl.match(
                  /cloudflarestream\.com\/([a-zA-Z0-9_-]+)/,
                )?.[1] ||
                ""
              }
              title={`${title} full playback`}
              customerCode={legalFull.cloudflareCustomerCode}
              token={legalFull.cloudflareToken}
              autoplay
            />
          ) : legalFull.type === "archive" ? (
            <iframe
              key={`full-archive-${legalFull.embedUrl}`}
              title={`${title} full playback`}
              src={`${legalFull.embedUrl}${legalFull.embedUrl.includes("?") ? "&" : "?"}autoplay=1`}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          ) : legalFull.type === "hls" ||
            legalFull.embedUrl.includes(".m3u8") ? (
            <HlsPlayer
              src={legalFull.embedUrl}
              autoPlay
              onProgress={onProgress}
              onComplete={onComplete}
            />
          ) : (
            <video
              key={`full-video-${legalFull.embedUrl}`}
              className="absolute inset-0 h-full w-full bg-black"
              controls
              playsInline
              autoPlay
              controlsList="nodownload"
              src={legalFull.embedUrl}
              onTimeUpdate={(e) =>
                onProgress?.((e.target as HTMLVideoElement).currentTime)
              }
              onEnded={() => onComplete?.()}
            >
              Your browser does not support in-app video playback.
            </video>
          )
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-gradient-to-br from-[#12121a] via-[var(--background)] to-[#0a0a10] p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary)]/25 text-[var(--primary-light)] ring-1 ring-white/10">
              <Film className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <p className="font-display text-xl font-semibold text-white">
                {title}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                {availability === "watch_now"
                  ? "Ready to play in CineVerse"
                  : availability === "trailer_only"
                    ? "Official trailer ready"
                    : "Trailer and free legal links available below"}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {canFull && (
                <Button
                  variant="gold"
                  size="lg"
                  className="watch-now-cta !text-black"
                  onClick={() => setMode("full")}
                >
                  <Maximize2 className="h-4 w-4 !text-black" />
                  Watch Now
                </Button>
              )}
              {hasTrailer && (
                <Button size="lg" onClick={() => setMode("trailer")}>
                  <Play className="h-4 w-4" />
                  Watch Trailer
                </Button>
              )}
            </div>
          </div>
        )}

        {(mode === "trailer" || mode === "full") && (
          <div className="pointer-events-none absolute left-3 top-3 z-10">
            <Badge tone={mode === "full" ? "gold" : "primary"}>
              {mode === "full" ? "Full stream" : "Official trailer"}
            </Badge>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canFull && (
          <Button
            size="sm"
            variant={mode === "full" ? "gold" : "secondary"}
            className={mode === "full" ? "watch-now-cta !text-black" : undefined}
            onClick={() => setMode("full")}
          >
            <Play
              className={cn(
                "h-3.5 w-3.5",
                mode === "full" && "!text-black",
              )}
            />
            Watch Now
          </Button>
        )}
        {hasTrailer && (
          <Button
            size="sm"
            variant={mode === "trailer" ? "default" : "secondary"}
            onClick={() => setMode("trailer")}
          >
            <Play className="h-3.5 w-3.5" />
            Watch Trailer
          </Button>
        )}
        {(mode === "trailer" || mode === "full") && (
          <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
            Close
          </Button>
        )}
        {!keepInApp && trailer?.site === "youtube" && trailer.key && (
          <a
            href={`https://www.youtube.com/watch?v=${trailer.key.trim()}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" variant="outline">
              <ExternalLink className="h-3.5 w-3.5" />
              Open on YouTube
            </Button>
          </a>
        )}
      </div>

      {canFull && legalFull?.attributionText && (
        <p className="text-xs text-[var(--text-muted)]">
          {legalFull.attributionText}
        </p>
      )}

      {!canFull && providers.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <p className="mb-2 text-xs font-medium text-[var(--text-muted)]">
            Also available on
          </p>
          <div className="flex flex-wrap gap-2">
            {providers.map((p) =>
              p.link ? (
                <a
                  key={`${p.id}-${p.type}`}
                  href={p.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Badge
                    tone={
                      p.type === "free"
                        ? "primary"
                        : p.type === "flatrate"
                          ? "cyan"
                          : "muted"
                    }
                  >
                    {p.name} ↗
                  </Badge>
                </a>
              ) : (
                <Badge
                  key={`${p.id}-${p.type}`}
                  tone={
                    p.type === "free"
                      ? "primary"
                      : p.type === "flatrate"
                        ? "cyan"
                        : "muted"
                  }
                >
                  {p.name}
                </Badge>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}

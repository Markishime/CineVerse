"use client";

import Link from "next/link";
import Image from "next/image";
import { memo, useState } from "react";
import { Info, Play, Star } from "lucide-react";
import type { Content } from "@/types/content";
import { cn, formatScore } from "@/lib/utils";
import { displayTitle, primaryScore } from "@/lib/content/normalize";
import { Badge } from "@/components/ui/badge";
import {
  getDetailsHref,
  getWatchHref,
} from "@/lib/content/watch-href";
import { AddToListButton } from "@/components/content/add-to-list-button";
import { useContinueProgress } from "@/hooks/use-continue-progress";
import { useAuthStore } from "@/stores/auth-store";
import {
  posterFallbackLabel,
  resizeTmdbImage,
  resolveCardImageUrl,
} from "@/lib/content/posters";

const typeTone: Record<
  Content["contentType"],
  "primary" | "cyan" | "accent" | "gold"
> = {
  movie: "primary",
  series: "cyan",
  anime: "accent",
  kdrama: "gold",
  cdrama: "gold",
  jdrama: "gold",
  thaidrama: "gold",
};

const typeLabel: Record<Content["contentType"], string> = {
  movie: "Movie",
  series: "Series",
  anime: "Anime",
  kdrama: "K-Drama",
  cdrama: "C-Drama",
  jdrama: "J-Drama",
  thaidrama: "Thai Drama",
};

function ContentCardBase({
  content,
  className,
  wide = false,
  animeTitlePreference = "english",
  rank,
  priority = false,
}: {
  content: Content;
  className?: string;
  wide?: boolean;
  animeTitlePreference?: "english" | "romaji" | "native";
  rank?: number;
  /** Eager-load the image (first visible cards only) */
  priority?: boolean;
}) {
  const title = displayTitle(content, animeTitlePreference);
  const score = primaryScore(content);
  const watchHref = getWatchHref(content);
  const detailsHref = getDetailsHref(content);
  const progress = useContinueProgress(content.id);
  const user = useAuthStore((s) => s.user);
  const [imgFailed, setImgFailed] = useState(false);
  // Always resolve a displayable URL (real art or local SVG — never blank)
  const preferred = resolveCardImageUrl(content, { preferBackdrop: wide });
  const src = imgFailed
    ? posterFallbackLabel(title, content.contentType)
    : resizeTmdbImage(preferred, wide ? "w780" : "w342");
  const meta = [
    content.year,
    content.runtime ? `${content.runtime}m` : null,
    content.seasonCount && content.contentType !== "movie"
      ? `${content.seasonCount} season${content.seasonCount === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);
  // Grid callers pass w-full; carousel rows use fixed widths.
  const fluid = Boolean(className?.includes("w-full"));

  return (
    <article
      className={cn(
        "group relative flex-none",
        !fluid &&
          (wide
            ? "w-[220px] min-w-[220px] sm:w-[280px] sm:min-w-[280px]"
            : "w-[140px] min-w-[140px] sm:w-[160px] sm:min-w-[160px]"),
        className,
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-lg bg-[var(--surface)] ring-1 ring-white/10",
          "transition-[transform,box-shadow] duration-300 ease-out",
          // hover: only applies on hover-capable devices (Tailwind v4)
          "group-hover:z-10 group-hover:scale-[1.06] group-hover:shadow-[0_18px_44px_-14px_rgba(0,0,0,0.9)] group-hover:ring-white/30",
          "group-focus-within:ring-2 group-focus-within:ring-[var(--ring)]",
          wide ? "aspect-video" : "aspect-[2/3]",
        )}
      >
        <Link
          prefetch={false}
          href={watchHref}
          className="absolute inset-0 block focus-visible:outline-none"
          aria-label={`Play ${title}`}
        >
          {src ? (
            <Image
              src={src}
              alt={title}
              fill
              sizes={wide ? "(max-width:768px) 220px, 280px" : "160px"}
              className="object-cover"
              loading={priority ? "eager" : "lazy"}
              unoptimized
              onError={() => setImgFailed(true)}
            />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center bg-[var(--surface-elevated)] p-2 text-center text-xs font-semibold text-white">
              {title}
            </span>
          )}
        </Link>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

        {rank != null ? (
          <span className="pointer-events-none absolute left-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-md bg-[var(--gold)] px-1.5 text-xs font-bold text-black shadow">
            {rank}
          </span>
        ) : (
          <Badge
            tone={typeTone[content.contentType]}
            className="pointer-events-none absolute left-2 top-2 !px-1.5 !py-0.5 !text-[10px]"
          >
            {typeLabel[content.contentType]}
          </Badge>
        )}

        {content.mature && (
          <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-[var(--danger)] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
            18+
          </span>
        )}

        {/* Quick actions: hover/focus on desktop, always visible on touch */}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1.5 p-2 transition-opacity duration-200",
            "opacity-100 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
            progress != null && "pb-3",
          )}
        >
          <Link
            prefetch={false}
            href={user ? watchHref : "/login"}
            aria-label={user ? `Play ${title}` : `Sign in to watch ${title}`}
            className="pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shadow-lg transition hover:scale-105 hover:bg-white/90 active:scale-95"
          >
            <Play className="h-4 w-4 fill-current" aria-hidden />
          </Link>
          <AddToListButton
            content={content}
            variant="icon"
            className="pointer-events-auto"
          />
          <Link
            href={detailsHref}
            aria-label={`More info about ${title}`}
            className="pointer-events-auto ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/40 bg-black/60 text-white backdrop-blur-sm transition hover:border-white hover:bg-black/80 active:scale-95"
          >
            <Info className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        {progress != null && (
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-white/25"
            role="progressbar"
            aria-label="Watch progress"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-[var(--primary)]"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      <Link
        href={detailsHref}
        className="mt-2 block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <h3 className="line-clamp-1 font-display text-sm font-semibold leading-snug text-white transition-colors group-hover:text-[var(--primary-light)]">
          {title}
        </h3>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          {score != null && (
            <span className="inline-flex items-center gap-0.5 font-semibold text-[var(--gold)]">
              <Star className="h-3 w-3 fill-current" aria-hidden />
              {formatScore(score)}
            </span>
          )}
          <span className="truncate">{meta.join(" · ")}</span>
        </p>
      </Link>
    </article>
  );
}

export const ContentCard = memo(ContentCardBase);

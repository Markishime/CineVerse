"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Play, Star } from "lucide-react";
import type { Content } from "@/types/content";
import { cn, formatScore } from "@/lib/utils";
import { displayTitle, primaryScore } from "@/lib/content/normalize";
import { Badge } from "@/components/ui/badge";
import {
  getDetailsHref,
  getTrailerHref,
  getWatchHref,
  hasOfficialTrailer,
} from "@/lib/content/watch-href";
import { AddToListButton } from "@/components/content/add-to-list-button";
import { useAuthStore } from "@/stores/auth-store";
import { cardHover } from "@/lib/motion";
import {
  posterFallbackLabel,
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

export function ContentCard({
  content,
  className,
  wide = false,
  animeTitlePreference = "english",
  rank,
}: {
  content: Content;
  className?: string;
  wide?: boolean;
  animeTitlePreference?: "english" | "romaji" | "native";
  rank?: number;
}) {
  const title = displayTitle(content, animeTitlePreference);
  const score = primaryScore(content);
  const canWatch = Boolean(content.playable || content.providerIds?.tmdb);
  const trailer = hasOfficialTrailer(content);
  const watchHref = getWatchHref(content);
  const trailerHref = getTrailerHref(content);
  const detailsHref = getDetailsHref(content);
  const [imgFailed, setImgFailed] = useState(false);
  const user = useAuthStore((s) => s.user);
  const reduce = useReducedMotion();
  // Always resolve a displayable URL (real art or local SVG — never blank)
  const preferred = resolveCardImageUrl(content, { preferBackdrop: wide });
  const src = imgFailed
    ? posterFallbackLabel(title, content.contentType)
    : preferred;

  return (
    <motion.article
      initial="rest"
      whileHover={reduce ? undefined : "hover"}
      animate="rest"
      variants={reduce ? undefined : cardHover}
      className={cn(
        // GPU-only hover (transform): keeps homepage rows at 60fps.
        "group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[var(--surface)]",
        "will-change-transform",
        "hover:border-white/18 hover:shadow-[0_14px_40px_-18px_rgba(0,0,0,0.8)]",
        "focus-within:border-[var(--primary)]/40 focus-within:ring-2 focus-within:ring-[var(--ring)]",
        wide ? "min-w-[220px] sm:min-w-[280px]" : "min-w-[140px] w-[140px] sm:w-[160px]",
        canWatch && "ring-1 ring-[var(--gold)]/40",
        className,
      )}
    >
      <Link
        href={watchHref}
        className={cn(
          "relative w-full overflow-hidden bg-[var(--background-secondary)] focus-visible:outline-none",
          wide ? "aspect-[16/9]" : "aspect-[2/3]",
        )}
        aria-label={`Watch Now: ${title}`}
      >
        {src ? (
          <Image
            src={src}
            alt={title}
            fill
            sizes={wide ? "(max-width:768px) 80vw, 280px" : "160px"}
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
            unoptimized
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-elevated)] p-2 text-center text-xs font-semibold text-white">
            {title}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/20" />

        {/* Play affordance: pure CSS opacity fade on hover / keyboard focus. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--gold)] text-black shadow-xl">
            <Play className="h-4 w-4 fill-current" aria-hidden />
          </span>
        </div>

        {rank != null && (
          <span className="absolute left-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-[var(--gold)] px-1.5 text-xs font-bold text-black shadow">
            {rank}
          </span>
        )}

        {content.mature && (
          <span className="absolute right-2 top-2 rounded-md bg-[var(--danger)] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
            18+
          </span>
        )}

        <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-1">
          <Badge tone={typeTone[content.contentType]}>
            {typeLabel[content.contentType]}
          </Badge>
          {score != null && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold text-[var(--gold)]">
              <Star className="h-3 w-3 fill-current" aria-hidden />
              {formatScore(score)}
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <Link
          href={detailsHref}
          className="min-w-0 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          <h3 className="line-clamp-2 font-display text-sm font-semibold leading-snug text-white transition-colors hover:text-[var(--primary-light)]">
            {title}
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            {[content.year, content.runtime ? `${content.runtime}m` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </Link>
        <div className="mt-auto flex flex-col gap-1.5">
          <Link
            href={user ? watchHref : "/login"}
            className="watch-now-cta inline-flex min-h-9 items-center justify-center gap-1 rounded-lg bg-[var(--gold)] px-2 py-1.5 text-[11px] font-bold !text-black transition duration-150 hover:brightness-110 active:scale-[0.98]"
          >
            <Play className="h-3 w-3 fill-current !text-black" aria-hidden />
            {user ? "Watch Now" : "Sign in to Watch"}
          </Link>
          <AddToListButton content={content} className="w-full" />
          {trailer && (
            <Link
              href={trailerHref}
              className="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border border-white/10 bg-transparent px-2 py-1.5 text-[11px] font-semibold text-white transition duration-150 hover:bg-white/8"
            >
              <Play className="h-3 w-3" aria-hidden />
              Trailer
            </Link>
          )}
        </div>
      </div>
    </motion.article>
  );
}

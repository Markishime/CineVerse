"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Play, Star } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
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
import { springSoft } from "@/lib/motion";

const typeTone: Record<
  Content["contentType"],
  "primary" | "cyan" | "accent" | "gold"
> = {
  movie: "primary",
  series: "cyan",
  anime: "accent",
  kdrama: "gold",
};

const typeLabel: Record<Content["contentType"], string> = {
  movie: "Movie",
  series: "Series",
  anime: "Anime",
  kdrama: "K-Drama",
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
  // Gold ring when free legal full OR TMDb embed path is available
  const canWatch = Boolean(content.playable || content.providerIds?.tmdb);
  const trailer = hasOfficialTrailer(content);
  // Always route Watch Now through full playback (hydrate resolves TMDb for anime)
  const watchHref = getWatchHref(content);
  const trailerHref = getTrailerHref(content);
  const detailsHref = getDetailsHref(content);
  const [imgFailed, setImgFailed] = useState(false);
  const reduce = useReducedMotion();
  const src =
    !imgFailed &&
    ((wide && content.backdrop?.url) || content.poster?.url || "");

  return (
    <motion.div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[var(--surface)] shadow-sm",
        wide ? "min-w-[220px] sm:min-w-[280px]" : "min-w-[140px] w-[140px] sm:w-[160px]",
        canWatch && "ring-1 ring-[var(--gold)]/50",
        className,
      )}
      whileHover={reduce ? undefined : { y: -6, scale: 1.02 }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={springSoft}
    >
      <Link
        href={watchHref}
        className={cn(
          "relative w-full overflow-hidden bg-[#0c0c12] focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
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
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            unoptimized
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1a1a28] to-[#2a2040] p-2 text-center text-xs font-semibold text-white">
            {title}
          </div>
        )}
        {/* Strong bottom scrim so overlays stay readable */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/30" />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--gold)] text-[#1a1408] shadow-xl">
            <Play className="h-5 w-5 fill-current" />
          </span>
        </div>

        {rank != null && (
          <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--gold)] text-xs font-bold text-[#1a1408] shadow">
            {rank}
          </span>
        )}

        {content.mature && (
          <span className="absolute right-2 top-2 rounded-md bg-[var(--danger)] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white shadow-lg">
            18+
          </span>
        )}

        <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-1">
          <Badge tone={typeTone[content.contentType]}>
            {typeLabel[content.contentType]}
          </Badge>
          {score != null && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-[var(--gold)]">
              <Star className="h-3 w-3 fill-current" />
              {formatScore(score)}
            </span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 bg-[var(--surface)] p-2.5">
        <Link href={detailsHref} className="min-w-0">
          <h3 className="line-clamp-2 font-display text-sm font-semibold leading-snug text-white hover:text-[var(--primary-light)]">
            {title}
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            {[content.year, content.runtime ? `${content.runtime}m` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </Link>
        <div className="mt-auto flex flex-col gap-1.5">
          <Link
            href={watchHref}
            className="watch-now-cta inline-flex items-center justify-center gap-1 rounded-lg bg-[var(--gold)] px-2 py-1.5 text-[11px] font-bold !text-black transition hover:brightness-110"
          >
            <Play className="h-3 w-3 fill-current !text-black" />
            Watch Now
          </Link>
          <AddToListButton content={content} className="w-full" />
          {trailer && (
            <Link
              href={trailerHref}
              className="inline-flex items-center justify-center gap-1 rounded-lg bg-white/12 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/20"
            >
              <Play className="h-3 w-3" />
              Watch Trailer
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}

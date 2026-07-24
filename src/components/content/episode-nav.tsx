"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TmdbTvDetail } from "@/lib/embed/tmdb-fetcher";

interface EpisodeNavProps {
  tmdbId: number;
  season: number;
  episode: number;
  tvShow: TmdbTvDetail | null;
  className?: string;
}

/**
 * Episode navigation bar for TV shows.
 * Shows prev/next buttons, season selector, and next-episode auto-play context.
 */
export function EpisodeNav({
  tmdbId,
  season,
  episode,
  tvShow,
  className,
}: EpisodeNavProps) {
  if (!tvShow) return null;

  const seasons = tvShow.seasons.filter((s) => s.season_number > 0);
  const currentSeason = seasons.find((s) => s.season_number === season);
  const totalEpisodesInSeason = currentSeason?.episode_count ?? 0;
  const totalSeasons = seasons.length;

  const hasPrev = episode > 1 || season > 1;
  const hasNext = episode < totalEpisodesInSeason || season < totalSeasons;

  // Compute prev/next episode numbers
  const prevEpisode = episode > 1 ? episode - 1 : undefined;
  const prevSeason = episode > 1 ? season : season > 1 ? season - 1 : undefined;
  const prevEpNum =
    prevEpisode !== undefined
      ? prevEpisode
      : season > 1
        ? (seasons.find((s) => s.season_number === season - 1)?.episode_count ?? 1)
        : undefined;

  const nextEpisode =
    episode < totalEpisodesInSeason ? episode + 1 : undefined;
  const nextSeason =
    episode < totalEpisodesInSeason ? season : season < totalSeasons ? season + 1 : undefined;
  const nextEpNum = nextEpisode !== undefined ? nextEpisode : 1;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Season tabs */}
      {seasons.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Season
          </span>
          {seasons.map((s) => (
            <Link
              key={s.id}
              href={`/watch/tv/${tmdbId}/${s.season_number}/1`}
            >
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  s.season_number === season
                    ? "bg-[var(--primary)] text-white shadow-[var(--glow-primary)]"
                    : "bg-white/10 text-[var(--text-secondary)] hover:bg-white/15 hover:text-white",
                )}
              >
                {s.season_number}
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* Prev / Next navigation */}
      <div className="flex items-center justify-between gap-2">
        <div>
          {hasPrev && prevSeason !== undefined && prevEpNum !== undefined && (
            <Link href={`/watch/tv/${tmdbId}/${prevSeason}/${prevEpNum}`}>
              <Button size="sm" variant="secondary">
                <ChevronLeft className="h-4 w-4" />
                Prev Episode
              </Button>
            </Link>
          )}
        </div>

        <Badge tone="muted" className="text-xs">
          S{String(season).padStart(2, "0")} &middot; E
          {String(episode).padStart(2, "0")}
          {totalEpisodesInSeason > 0 && (
            <span className="ml-1 text-[var(--text-muted)]">
              / {totalEpisodesInSeason}
            </span>
          )}
        </Badge>

        <div>
          {hasNext && nextSeason !== undefined && (
            <Link href={`/watch/tv/${tmdbId}/${nextSeason}/${nextEpNum}`}>
              <Button size="sm" variant="secondary">
                Next Episode
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Episode list for current season */}
      {currentSeason && (
        <details className="group rounded-xl border border-white/10 bg-white/[0.03]">
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-white [&::-webkit-details-marker]:hidden">
            <span>
              Episodes &middot; {currentSeason.name || `Season ${season}`}
            </span>
            <SkipForward className="h-4 w-4 rotate-90 transition-transform group-open:rotate-270" />
          </summary>
          <div
            className="scroll-contain max-h-64 space-y-0.5 border-t border-white/10 p-2"
            data-lenis-prevent
            data-lenis-prevent-wheel
            data-lenis-prevent-touch
          >
            {Array.from({ length: totalEpisodesInSeason }, (_, i) => i + 1).map(
              (ep) => (
                <Link
                  key={ep}
                  href={`/watch/tv/${tmdbId}/${season}/${ep}`}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    ep === episode
                      ? "bg-[var(--primary)]/20 text-white"
                      : "text-[var(--text-secondary)] hover:bg-white/5 hover:text-white",
                  )}
                >
                  <span className="w-6 font-mono text-xs text-[var(--text-muted)]">
                    {String(ep).padStart(2, "0")}
                  </span>
                  <span className="flex-1">
                    {ep === episode ? (
                      <span className="font-medium">Now playing</span>
                    ) : (
                      `Episode ${ep}`
                    )}
                  </span>
                </Link>
              ),
            )}
          </div>
        </details>
      )}
    </div>
  );
}

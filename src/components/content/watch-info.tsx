"use client";

import Image from "next/image";
import Link from "next/link";
import { Star, Clock, Calendar, Film, Users, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TmdbMovieDetail, TmdbTvDetail, TmdbEpisodeDetail } from "@/lib/embed/tmdb-fetcher";

interface WatchInfoProps {
  mediaType: "movie" | "tv";
  tmdbId: number;
  movie?: TmdbMovieDetail | null;
  tvShow?: TmdbTvDetail | null;
  episode?: TmdbEpisodeDetail | null;
  season?: number;
  episodeNum?: number;
  className?: string;
}

function formatRuntime(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatScore(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return "—";
  return score.toFixed(1);
}

/** Watch page info sidebar — metadata, cast, and context for the title */
export function WatchInfo({
  mediaType,
  tmdbId,
  movie,
  tvShow,
  episode,
  season,
  episodeNum,
  className,
}: WatchInfoProps) {
  const detail = mediaType === "movie" ? movie : tvShow;
  const title = mediaType === "movie" ? movie?.title : tvShow?.name;
  const overview = episode?.overview || detail?.overview;
  const genres = detail?.genres ?? [];
  const rating = detail?.vote_average;
  const year = (mediaType === "movie" ? movie?.release_date : tvShow?.first_air_date)?.slice(0, 4);
  const runtime = episode?.runtime || (mediaType === "movie" ? movie?.runtime : tvShow?.episode_run_time?.[0]);
  const tagline = detail?.tagline;
  const status = detail?.status;
  const seasons = tvShow?.seasons ?? [];

  // Extract cast from the appended credits
  const credits = (detail as TmdbMovieDetail & { credits?: { cast?: Array<{ name: string; character: string; profile_path: string | null }> } })?.credits;
  const cast = credits?.cast?.slice(0, 10) ?? [];

  return (
    <div className={cn("space-y-6", className)}>
      {/* Title + badges */}
      <div>
        {episode && season && episodeNum && (
          <p className="mb-1 text-sm font-medium text-[var(--primary-light)]">
            Season {season} &middot; Episode {episodeNum}
          </p>
        )}
        <h1 className="font-display text-2xl font-bold text-white sm:text-3xl">
          {title || "Loading..."}
        </h1>
        {tagline && (
          <p className="mt-1 text-sm italic text-[var(--text-muted)]">
            &ldquo;{tagline}&rdquo;
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {year && <Badge tone="muted">{year}</Badge>}
          {rating != null && rating > 0 && (
            <Badge tone="gold">
              <Star className="mr-1 h-3 w-3 fill-current" />
              {formatScore(rating)}
            </Badge>
          )}
          {runtime && runtime > 0 && (
            <Badge tone="muted">
              <Clock className="mr-1 h-3 w-3" />
              {formatRuntime(runtime)}
            </Badge>
          )}
          {status && (
            <Badge tone="muted">
              <Calendar className="mr-1 h-3 w-3" />
              {status.replace(/_/g, " ")}
            </Badge>
          )}
        </div>
        {genres.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {genres.map((g) => (
              <Badge key={g.id} tone="primary" className="text-[10px]">
                {g.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Overview */}
      {overview && (
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
          {overview}
        </p>
      )}

      {/* Cast */}
      {cast.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <Users className="h-4 w-4" />
            Cast
          </h3>
          <div className="space-y-2">
            {cast.map((member, i) => (
              <div key={`${member.name}-${i}`} className="flex items-center gap-3">
                <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/10">
                  {member.profile_path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w45${member.profile_path}`}
                      alt={member.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-[var(--text-muted)]">
                      {member.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">
                    {member.name}
                  </p>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    {member.character}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TV Seasons navigation */}
      {mediaType === "tv" && seasons.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <Film className="h-4 w-4" />
            Seasons
          </h3>
          <div className="flex flex-wrap gap-2">
            {seasons
              .filter((s) => s.season_number > 0)
              .map((s) => (
                <Link
                  key={s.id}
                  href={`/watch/tv/${tmdbId}/${s.season_number}/1`}
                >
                  <Badge
                    tone={s.season_number === season ? "primary" : "muted"}
                    className="cursor-pointer transition-colors hover:bg-[var(--primary)]/30"
                  >
                    S{s.season_number}
                  </Badge>
                </Link>
              ))}
          </div>
        </section>
      )}

      {/* External links */}
      <div className="flex flex-wrap gap-2">
        <a
          href={`https://www.themoviedb.org/movie/${tmdbId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button size="sm" variant="outline">
            <ExternalLink className="h-3.5 w-3.5" />
            TMDb
          </Button>
        </a>
        {tvShow?.created_by && tvShow.created_by.length > 0 && (
          <p className="flex items-center text-xs text-[var(--text-muted)]">
            Created by {tvShow.created_by.map((c) => c.name).join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}

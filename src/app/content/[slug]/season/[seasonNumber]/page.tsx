"use client";

import Image from "next/image";
import Link from "next/link";
import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, Film, Play } from "lucide-react";
import {
  fetchContentBySlug,
  fetchEpisodes,
  fetchSeasons,
} from "@/lib/api/content";
import { displayTitle } from "@/lib/content/normalize";
import { getWatchHref } from "@/lib/content/watch-href";
import { formatRuntime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Season episode list — every episode opens the full episode player
 * (series / anime / kdrama), never a title trailer.
 */
export default function SeasonPage({
  params,
}: {
  params: Promise<{ slug: string; seasonNumber: string }>;
}) {
  const { slug, seasonNumber } = use(params);
  const seasonNum = Number(seasonNumber);

  const { data: content } = useQuery({
    queryKey: ["content", slug],
    queryFn: () => fetchContentBySlug(slug),
  });

  const { data: seasons } = useQuery({
    queryKey: ["seasons", content?.id],
    queryFn: () => fetchSeasons(content!.id),
    enabled: Boolean(content?.id),
  });

  const season = seasons?.seasons.find((s) => s.seasonNumber === seasonNum);

  const {
    data: episodes,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["episodes", season?.id],
    queryFn: () => fetchEpisodes(season!.id),
    enabled: Boolean(season?.id),
  });

  const title = content ? displayTitle(content) : "…";
  const seasonLabel = season?.name || `Season ${seasonNum}`;
  const otherSeasons =
    seasons?.seasons.filter((s) => s.seasonNumber !== seasonNum) ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-24 sm:px-6">
      <Link
        href={content ? `/content/${encodeURIComponent(content.slug || content.id)}` : `/content/${slug}`}
        className="text-sm text-[var(--primary-light)]"
      >
        ← Back to title
      </Link>
      <h1 className="mt-4 font-display text-3xl font-bold text-white">
        {title}
        <span className="text-[var(--text-secondary)]"> · {seasonLabel}</span>
      </h1>
      {season?.overview ? (
        <p className="mt-2 text-sm text-[var(--text-secondary)] line-clamp-3">
          {season.overview}
        </p>
      ) : (
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Select an episode to stream the full episode — not a trailer.
        </p>
      )}

      {otherSeasons.length > 0 && content && (
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="self-center text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Seasons
          </span>
          {seasons!.seasons.map((s) => (
            <Link
              key={s.id}
              href={`/content/${encodeURIComponent(content.slug || content.id)}/season/${s.seasonNumber}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                s.seasonNumber === seasonNum
                  ? "bg-[var(--primary)] text-white"
                  : "bg-white/10 text-[var(--text-secondary)] hover:bg-white/15 hover:text-white"
              }`}
            >
              {s.name || `S${s.seasonNumber}`}
            </Link>
          ))}
        </div>
      )}

      {isLoading && (
        <div className="mt-8 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 skeleton rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <p className="mt-8 text-[var(--danger)]">
          Could not load episodes. Try again shortly.
        </p>
      )}

      <ul className="mt-8 space-y-3">
        {content &&
          episodes?.episodes.map((ep) => {
            const watchHref = getWatchHref(content, {
              season: seasonNum,
              episode: ep.episodeNumber,
            });
            return (
              <li
                key={ep.id}
                className="flex gap-4 overflow-hidden rounded-xl surface-card p-3 sm:p-4"
              >
                <Link
                  href={watchHref}
                  className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-elevated)] sm:h-24 sm:w-40"
                >
                  {ep.stillPath ? (
                    <Image
                      src={ep.stillPath}
                      alt=""
                      fill
                      className="object-cover transition hover:scale-105"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[var(--text-muted)]">
                      <Film className="h-6 w-6 opacity-40" />
                    </div>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition hover:opacity-100">
                    <Play className="h-8 w-8 fill-white text-white" />
                  </span>
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium text-white">
                      <span className="text-[var(--text-muted)]">
                        E{ep.episodeNumber}.
                      </span>{" "}
                      {ep.name || `Episode ${ep.episodeNumber}`}
                    </p>
                    <Badge tone="gold" className="watch-now-cta !text-black">
                      Full episode
                    </Badge>
                  </div>
                  {ep.overview ? (
                    <p className="mt-1 text-sm text-[var(--text-secondary)] line-clamp-3">
                      {ep.overview}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                    {ep.airDate ? (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {ep.airDate}
                      </span>
                    ) : null}
                    {ep.runtime != null && ep.runtime > 0 ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRuntime(ep.runtime)}
                      </span>
                    ) : null}
                    <Link href={watchHref}>
                      <Button
                        size="sm"
                        variant="gold"
                        className="watch-now-cta !text-black"
                      >
                        <Play className="h-3.5 w-3.5 !text-black" />
                        Watch episode
                      </Button>
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
      </ul>

      {!isLoading && !isError && (episodes?.episodes.length ?? 0) === 0 && (
        <div className="mt-8 rounded-xl border border-white/10 bg-white/5 p-6 text-center">
          <p className="font-medium text-white">No episode list yet</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Try another season, or open Watch Now from the title page.
          </p>
          {content && (
            <Link
              href={getWatchHref(content, { season: seasonNum, episode: 1 })}
              className="mt-4 inline-block text-sm text-[var(--primary-light)]"
            >
              Play season {seasonNum} episode 1
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

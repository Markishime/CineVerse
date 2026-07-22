"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Share2, SkipForward } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { VideoPlayer } from "@/components/content/video-player";
import { WatchInfo } from "@/components/content/watch-info";
import { EpisodeNav } from "@/components/content/episode-nav";
import { Button } from "@/components/ui/button";
import { tmdbBackdropUrl } from "@/lib/embed/tmdb-fetcher";
import {
  saveContinueWatching,
  saveTvProgress,
} from "@/lib/content/watch-progress";
import type {
  TmdbTvDetail,
  TmdbEpisodeDetail,
} from "@/lib/embed/tmdb-fetcher";
import { useAuthStore } from "@/stores/auth-store";

interface WatchTvClientProps {
  tmdbId: number;
  tvShow: TmdbTvDetail;
  episode: TmdbEpisodeDetail | null;
  season: number;
  episodeNum: number;
  genreIds?: number[];
}

function currentSeasonEpCount(tvShow: TmdbTvDetail, season: number): number {
  return (
    tvShow.seasons.find((s) => s.season_number === season)?.episode_count ?? 12
  );
}

/** Origin language/country → specific Asian-drama type (or null). Anime excluded. */
function detectDramaType(
  originalLanguage: string | undefined,
  originCountries: string[] | undefined,
  isAnime: boolean,
): "kdrama" | "cdrama" | "jdrama" | "thaidrama" | null {
  if (isAnime) return null;
  const lang = (originalLanguage ?? "").toLowerCase();
  const countries = (originCountries ?? []).map((c) => c.toUpperCase());
  if (lang === "ko" || countries.includes("KR")) return "kdrama";
  if (
    lang === "zh" ||
    lang === "cn" ||
    countries.some((c) => ["CN", "TW", "HK"].includes(c))
  )
    return "cdrama";
  if (lang === "ja" || countries.includes("JP")) return "jdrama";
  if (lang === "th" || countries.includes("TH")) return "thaidrama";
  return null;
}

/**
 * Client component for the TV watch page.
 * Handles the interactive video player, episode navigation,
 * next-episode auto-play countdown, and cinematic UI.
 */
export function WatchTvClient({
  tmdbId,
  tvShow,
  episode,
  season,
  episodeNum,
  genreIds = [],
}: WatchTvClientProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [shareMsg, setShareMsg] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const backdrop = tmdbBackdropUrl(tvShow.backdrop_path, "w1280");

  // Detect anime from TMDb genre (16 = Animation) + Japanese language
  const isAnime =
    genreIds.includes(16) && tvShow.original_language === "ja";

  // Detect Asian drama (live-action) by original language, excluding anime.
  const originCountries = (tvShow as { origin_country?: string[] })
    .origin_country;
  const dramaContentType = detectDramaType(
    tvShow.original_language,
    originCountries,
    isAnime,
  );

  // Find next episode for auto-play
  const nextEpisode = useMemo(() => {
    const currentSeason = tvShow.seasons.find(
      (s) => s.season_number === season && s.season_number > 0,
    );
    if (!currentSeason) return null;

    if (episodeNum < currentSeason.episode_count) {
      return { season, episode: episodeNum + 1 };
    }

    // Try next season
    const sortedSeasons = tvShow.seasons
      .filter((s) => s.season_number > 0)
      .sort((a, b) => a.season_number - b.season_number);
    const currentIdx = sortedSeasons.findIndex(
      (s) => s.season_number === season,
    );
    if (currentIdx >= 0 && currentIdx < sortedSeasons.length - 1) {
      const nextS = sortedSeasons[currentIdx + 1];
      if (nextS.episode_count > 0) {
        return { season: nextS.season_number, episode: 1 };
      }
    }

    return null;
  }, [tvShow, season, episodeNum]);

  // Auto-play next episode countdown
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      if (nextEpisode) {
        router.push(
          `/watch/tv/${tmdbId}/${nextEpisode.season}/${nextEpisode.episode}`,
        );
      } else {
        // Use timeout to avoid synchronous setState in effect
        const t = window.setTimeout(() => setCountdown(null), 0);
        return () => window.clearTimeout(t);
      }
      return;
    }
    const t = window.setTimeout(
      () => setCountdown((c) => (c == null ? null : c - 1)),
      1000,
    );
    return () => window.clearTimeout(t);
  }, [countdown, nextEpisode, router, tmdbId]);

  const share = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      setShareMsg("Link copied!");
      window.setTimeout(() => setShareMsg(""), 2000);
    } catch {
      setShareMsg("Could not copy link");
    }
  };

  const epTitle = episode?.name || `Episode ${episodeNum}`;
  const fullTitle = `${tvShow.name} · S${String(season).padStart(2, "0")}E${String(episodeNum).padStart(2, "0")} — ${epTitle}`;

  return (
    <div className="relative min-h-dvh bg-[var(--background)] pb-24 pt-16">
      {/* Cinematic backdrop blur */}
      {backdrop && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[50vh] overflow-hidden opacity-25">
          <Image
            src={backdrop}
            alt=""
            fill
            className="object-cover blur-3xl scale-110"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--background)]/60 to-[var(--background)]" />
        </div>
      )}

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
        {/* Top bar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href={`/content/${tmdbId}`}>
              <Button variant="secondary" size="sm">
                <ArrowLeft className="h-4 w-4" />
                Details
              </Button>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {shareMsg && (
              <span className="text-xs font-medium text-[var(--success)]">
                {shareMsg}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => void share()}>
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        </div>

        {/* Video player — anime uses AniList/MAL-aware multi-backend chain */}
        <VideoPlayer
          tmdbId={tmdbId}
          mediaType="tv"
          season={season}
          episode={episodeNum}
          title={isAnime ? tvShow.name : fullTitle}
          originalLanguage={tvShow.original_language}
          contentType={
            isAnime ? "anime" : dramaContentType ?? "series"
          }
          year={
            tvShow.first_air_date
              ? Number(tvShow.first_air_date.slice(0, 4))
              : null
          }
          autoPlay
          onProviderLoad={() => {
            // Save progress so user resumes from this episode next time
            saveTvProgress(tmdbId, season, episodeNum);
            const poster = tvShow.poster_path
              ? `https://image.tmdb.org/t/p/w500${tvShow.poster_path}`
              : null;
            const bg = tvShow.backdrop_path
              ? `https://image.tmdb.org/t/p/w780${tvShow.backdrop_path}`
              : null;
            // Heuristic content type from genre / origin
            const isAnimeCw =
              (tvShow.genres ?? []).some((g) => /animation/i.test(g.name)) &&
              tvShow.original_language === "ja";
            const contentType =
              isAnimeCw
                ? "anime"
                : detectDramaType(
                    tvShow.original_language,
                    (tvShow as { origin_country?: string[] }).origin_country,
                    isAnimeCw,
                  ) ?? "series";
            saveContinueWatching(
              {
                contentId: `tmdb_tv_${tmdbId}`,
                slug: `tmdb-tv-${tmdbId}`,
                title: tvShow.name,
                contentType,
                posterUrl: poster,
                backdropUrl: bg,
                tmdbId,
                year: tvShow.first_air_date
                  ? Number(tvShow.first_air_date.slice(0, 4))
                  : null,
                href: `/watch/tv/${tmdbId}/${season}/${episodeNum}`,
                season,
                episode: episodeNum,
                percent: Math.min(
                  95,
                  Math.round(
                    ((episodeNum - 1) /
                      Math.max(1, currentSeasonEpCount(tvShow, season))) *
                      100,
                  ) + 8,
                ),
              },
              user?.uid,
            );
            setCountdown(null);
          }}
        />

        {/* Next episode auto-play countdown */}
        {countdown != null && nextEpisode && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-4 py-3 text-sm">
            <span className="text-white">
              Next episode in{" "}
              <strong className="text-[var(--primary-light)]">{countdown}s</strong>
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setCountdown(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => setCountdown(0)}
              >
                <SkipForward className="h-4 w-4" />
                Play now
              </Button>
            </div>
          </div>
        )}

        {/* Episode navigation */}
        <div className="mt-4">
          <EpisodeNav
            tmdbId={tmdbId}
            season={season}
            episode={episodeNum}
            tvShow={tvShow}
          />
        </div>

        {/* Show info + episode details */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px]">
          <WatchInfo
            mediaType="tv"
            tmdbId={tmdbId}
            tvShow={tvShow}
            episode={episode}
            season={season}
            episodeNum={episodeNum}
          />

          {/* Poster + still sidebar */}
          <aside className="space-y-4">
            {/* Episode still */}
            {episode?.still_path && (
              <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10">
                <Image
                  src={`https://image.tmdb.org/t/p/w500${episode.still_path}`}
                  alt={epTitle}
                  fill
                  className="object-cover"
                  unoptimized
                  priority
                />
              </div>
            )}
            {/* Show poster */}
            {tvShow.poster_path && (
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10">
                <Image
                  src={`https://image.tmdb.org/t/p/w500${tvShow.poster_path}`}
                  alt={tvShow.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
            <Link href={`/content/${tmdbId}`}>
              <Button variant="outline" className="w-full">
                Full details
              </Button>
            </Link>
          </aside>
        </div>
      </div>
    </div>
  );
}

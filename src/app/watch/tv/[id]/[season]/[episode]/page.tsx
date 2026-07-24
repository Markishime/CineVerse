import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  fetchTmdbTvShow,
  fetchTmdbEpisode,
  tmdbBackdropUrl,
} from "@/lib/embed/tmdb-fetcher";
import { fallbackEpisode, fallbackTvShow } from "@/lib/embed/tmdb-fallbacks";
import { WatchTvClient } from "./client";

interface Props {
  params: Promise<{ id: string; season: string; episode: string }>;
}

/**
 * TV watch page — /watch/tv/[id]/[season]/[episode]
 *
 * Server component that fetches TMDb metadata for the show and episode,
 * then renders the embedded video player with auto-fallback between providers.
 *
 * Playback works even when TMDB_ACCESS_TOKEN is missing on Vercel — we fall
 * back to minimal metadata so the page never hard-404s for a valid tmdb id.
 *
 * URL examples:
 *   /watch/tv/1399/1/1    — Game of Thrones S01E01
 *   /watch/tv/94997/3/5   — One Piece S03E05
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, season, episode } = await params;
  const tmdbId = Number(id);
  const seasonNum = Number(season);
  const episodeNum = Number(episode);

  if (
    !Number.isFinite(tmdbId) ||
    !Number.isFinite(seasonNum) ||
    !Number.isFinite(episodeNum)
  ) {
    return { title: "Watch · CineVerse" };
  }

  const tvShow = await fetchTmdbTvShow(tmdbId);
  if (!tvShow) {
    return { title: "Watch · CineVerse" };
  }

  const ep = await fetchTmdbEpisode(tmdbId, seasonNum, episodeNum);

  return {
    title: `Watch ${tvShow.name} S${String(seasonNum).padStart(2, "0")}E${String(episodeNum).padStart(2, "0")} · CineVerse`,
    description:
      ep?.overview?.slice(0, 160) || tvShow.overview?.slice(0, 160) || "",
    openGraph: {
      title: `Watch ${tvShow.name} S${String(seasonNum).padStart(2, "0")}E${String(episodeNum).padStart(2, "0")}`,
      description:
        ep?.overview?.slice(0, 200) || tvShow.overview?.slice(0, 200) || "",
      images: tvShow.backdrop_path
        ? [{ url: tmdbBackdropUrl(tvShow.backdrop_path, "w1280") || "" }]
        : undefined,
    },
  };
}

export default async function WatchTvPage({ params }: Props) {
  const { id, season, episode } = await params;
  const tmdbId = Number(id);
  const seasonNum = Number(season);
  const episodeNum = Number(episode);

  if (
    !Number.isFinite(tmdbId) ||
    tmdbId <= 0 ||
    !Number.isFinite(seasonNum) ||
    !Number.isFinite(episodeNum) ||
    seasonNum < 1 ||
    episodeNum < 1
  ) {
    return (
      <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display text-2xl font-bold text-white">
          Invalid episode link
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          This watch URL is missing a valid show or episode id.
        </p>
      </div>
    );
  }

  const liveShow = await fetchTmdbTvShow(tmdbId);
  const tvShow =
    liveShow ?? fallbackTvShow(tmdbId, seasonNum, episodeNum);

  // Only redirect season/episode bounds when we have real TMDB data
  if (liveShow) {
    const validSeason = liveShow.seasons.find(
      (s) => s.season_number === seasonNum && s.season_number > 0,
    );
    if (!validSeason) {
      redirect(`/watch/tv/${tmdbId}/1/1`);
    }
    if (episodeNum > validSeason.episode_count) {
      redirect(`/watch/tv/${tmdbId}/${seasonNum}/1`);
    }
  }

  const ep =
    (await fetchTmdbEpisode(tmdbId, seasonNum, episodeNum)) ??
    fallbackEpisode(seasonNum, episodeNum);

  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-[var(--background)] pt-16">
          <div className="mx-auto max-w-7xl space-y-4 px-4">
            <div className="aspect-video skeleton rounded-2xl" />
            <div className="h-24 skeleton rounded-xl" />
          </div>
        </div>
      }
    >
      <WatchTvClient
        tmdbId={tmdbId}
        tvShow={tvShow}
        episode={ep}
        season={seasonNum}
        episodeNum={episodeNum}
        genreIds={tvShow.genres?.map((g) => g.id) ?? []}
      />
    </Suspense>
  );
}

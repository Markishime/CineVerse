import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  fetchTmdbTvShow,
  fetchTmdbEpisode,
  tmdbBackdropUrl,
} from "@/lib/embed/tmdb-fetcher";
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
 * URL examples:
 *   /watch/tv/1399/1/1    — Game of Thrones S01E01
 *   /watch/tv/94997/3/5   — One Piece S03E05
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, season, episode } = await params;
  const tmdbId = Number(id);
  const seasonNum = Number(season);
  const episodeNum = Number(episode);

  if (!Number.isFinite(tmdbId) || !Number.isFinite(seasonNum) || !Number.isFinite(episodeNum)) {
    return { title: "Watch · CineVerse" };
  }

  const tvShow = await fetchTmdbTvShow(tmdbId);
  if (!tvShow) {
    return { title: "Show not found · CineVerse" };
  }

  const ep = await fetchTmdbEpisode(tmdbId, seasonNum, episodeNum);

  return {
    title: `Watch ${tvShow.name} S${String(seasonNum).padStart(2, "0")}E${String(episodeNum).padStart(2, "0")} · CineVerse`,
    description: ep?.overview?.slice(0, 160) || tvShow.overview?.slice(0, 160) || "",
    openGraph: {
      title: `Watch ${tvShow.name} S${String(seasonNum).padStart(2, "0")}E${String(episodeNum).padStart(2, "0")}`,
      description: ep?.overview?.slice(0, 200) || tvShow.overview?.slice(0, 200) || "",
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
    !Number.isFinite(seasonNum) ||
    !Number.isFinite(episodeNum) ||
    seasonNum < 1 ||
    episodeNum < 1
  ) {
    notFound();
  }

  const tvShow = await fetchTmdbTvShow(tmdbId);

  if (!tvShow) {
    notFound();
  }

  // Redirect to season 1, episode 1 if the season doesn't exist
  const validSeason = tvShow.seasons.find(
    (s) => s.season_number === seasonNum && s.season_number > 0,
  );
  if (!validSeason) {
    redirect(`/watch/tv/${tmdbId}/1/1`);
  }

  // Redirect to episode 1 if the episode doesn't exist
  if (episodeNum > validSeason.episode_count) {
    redirect(`/watch/tv/${tmdbId}/${seasonNum}/1`);
  }

  const ep = await fetchTmdbEpisode(tmdbId, seasonNum, episodeNum);

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

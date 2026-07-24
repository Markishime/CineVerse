import { Suspense } from "react";
import type { Metadata } from "next";
import { fetchTmdbMovie, tmdbBackdropUrl } from "@/lib/embed/tmdb-fetcher";
import { fallbackMovie } from "@/lib/embed/tmdb-fallbacks";
import { WatchMovieClient } from "./client";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Movie watch page — /watch/movie/[id]
 *
 * Server component that fetches TMDb metadata and renders the embedded
 * video player with auto-fallback between providers (AutoEmbed → VidCore → 2Embed).
 *
 * The [id] is the TMDb movie ID (e.g., /watch/movie/550 for Fight Club).
 * Playback does not require TMDB metadata — if the API key is missing on
 * Vercel we still render the player with a minimal fallback title.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const tmdbId = Number(id);
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    return { title: "Watch · CineVerse" };
  }

  const movie = await fetchTmdbMovie(tmdbId);
  if (!movie) {
    return { title: `Watch · CineVerse` };
  }

  return {
    title: `Watch ${movie.title} · CineVerse`,
    description: movie.overview?.slice(0, 160) || `Watch ${movie.title} on CineVerse`,
    openGraph: {
      title: `Watch ${movie.title}`,
      description: movie.overview?.slice(0, 200) || "",
      images: movie.backdrop_path
        ? [{ url: tmdbBackdropUrl(movie.backdrop_path, "w1280") || "" }]
        : undefined,
    },
  };
}

export default async function WatchMoviePage({ params }: Props) {
  const { id } = await params;
  const tmdbId = Number(id);

  // Only reject non-numeric / invalid ids — never 404 just because TMDB is down
  if (!Number.isFinite(tmdbId) || tmdbId <= 0) {
    return (
      <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display text-2xl font-bold text-white">
          Invalid title link
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          This watch URL is missing a valid catalog id.
        </p>
      </div>
    );
  }

  const movie = (await fetchTmdbMovie(tmdbId)) ?? fallbackMovie(tmdbId);

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
      <WatchMovieClient tmdbId={tmdbId} movie={movie} />
    </Suspense>
  );
}

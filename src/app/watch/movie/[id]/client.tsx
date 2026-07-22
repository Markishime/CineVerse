"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Share2 } from "lucide-react";
import { VideoPlayer } from "@/components/content/video-player";
import { WatchInfo } from "@/components/content/watch-info";
import { Button } from "@/components/ui/button";
import { tmdbBackdropUrl } from "@/lib/embed/tmdb-fetcher";
import type { TmdbMovieDetail } from "@/lib/embed/tmdb-fetcher";
import { useEffect, useState } from "react";
import { saveContinueWatching } from "@/lib/content/watch-progress";
import { useAuthStore } from "@/stores/auth-store";

interface WatchMovieClientProps {
  tmdbId: number;
  movie: TmdbMovieDetail;
}

/** Detect Asian-drama type for regional movies (Korean, Chinese, Japanese, Thai). */
function detectDramaType(
  originalLanguage: string | undefined,
): "kdrama" | "cdrama" | "jdrama" | "thaidrama" | null {
  const lang = (originalLanguage ?? "").toLowerCase();
  if (lang === "ko") return "kdrama";
  if (lang === "zh" || lang === "cn") return "cdrama";
  if (lang === "ja") return "jdrama";
  if (lang === "th") return "thaidrama";
  return null;
}

/**
 * Client component for the movie watch page.
 * Handles the interactive video player, share functionality, and cinematic UI.
 */
export function WatchMovieClient({ tmdbId, movie }: WatchMovieClientProps) {
  const user = useAuthStore((s) => s.user);
  const [shareMsg, setShareMsg] = useState("");
  const backdrop = tmdbBackdropUrl(movie.backdrop_path, "w1280");

  // Detect anime movie: Animation genre (16) + Japanese language
  const isAnimeMovie =
    (movie.genres ?? []).some((g) => g.id === 16) &&
    movie.original_language === "ja";
  // Detect regional drama movies so they use drama-specific embed providers
  const dramaType = isAnimeMovie
    ? null
    : detectDramaType(movie.original_language);
  const contentType = isAnimeMovie ? "anime" : dramaType ?? "movie";
  const year = movie.release_date
    ? Number(movie.release_date.slice(0, 4))
    : null;

  useEffect(() => {
    const poster = movie.poster_path
      ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
      : null;
    const bg = movie.backdrop_path
      ? `https://image.tmdb.org/t/p/w780${movie.backdrop_path}`
      : null;
    saveContinueWatching(
      {
        contentId: isAnimeMovie
          ? `tmdb_anime_movie_${tmdbId}`
          : `tmdb_movie_${tmdbId}`,
        slug: `tmdb-movie-${tmdbId}`,
        title: movie.title,
        contentType,
        posterUrl: poster,
        backdropUrl: bg,
        tmdbId,
        year,
        href: `/watch/movie/${tmdbId}`,
        percent: 28,
      },
      user?.uid,
    );
  }, [tmdbId, movie, user?.uid, isAnimeMovie, contentType, year]);

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

        {/* Video player — anime films use anime-only backends (Cinezo, AnimePahe, …) */}
        <VideoPlayer
          tmdbId={tmdbId}
          mediaType="movie"
          title={movie.title}
          originalLanguage={movie.original_language}
          contentType={contentType}
          animeFormat={isAnimeMovie ? "MOVIE" : undefined}
          year={year}
          autoPlay
        />

        {/* Movie info */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px]">
          <WatchInfo
            mediaType="movie"
            tmdbId={tmdbId}
            movie={movie}
          />

          {/* Poster sidebar */}
          <aside className="space-y-4">
            {movie.poster_path && (
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10">
                <Image
                  src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                  alt={movie.title}
                  fill
                  className="object-cover"
                  unoptimized
                  priority
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

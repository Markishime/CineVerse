/**
 * Watch routing helpers.
 * Watch Now → play full episodes/movies via TMDb embed when available.
 * Watch Trailer → official trailer only (never mixed into Watch Now).
 */

import type { Content } from "@/types/content";
import { getLastWatchedEpisode } from "./watch-progress";

export function contentPathKey(c: Pick<Content, "slug" | "id">): string {
  const raw = c.slug && c.slug !== "title" ? c.slug : c.id;
  return encodeURIComponent(raw || c.id);
}

/** Movie vs TV embed path — prefer explicit TMDb media type over contentType. */
function isMovieWatch(
  c: Pick<Content, "contentType" | "providerIds" | "animeFormat">,
): boolean {
  // Anime series (Demon Slayer, etc.) must NEVER use the movie path even if a
  // bad tmdbMediaType="movie" leaked from external links — that plays the wrong film.
  if (c.contentType === "anime") {
    return c.animeFormat === "MOVIE";
  }
  if (c.providerIds?.tmdbMediaType === "movie") return true;
  if (c.providerIds?.tmdbMediaType === "tv") return false;
  if (c.contentType === "movie") return true;
  return false;
}

/**
 * Watch Now — start playback of the title (movie full, or TV S1E1 / resume).
 * Always requests full playback. Trailers use getTrailerHref only.
 *
 * Correctness rules:
 * - Anime ALWAYS uses the slug path so AniList/MAL identity is preserved and
 *   the player can refuse a mismatched TMDB film (wrong-title bug).
 * - Live-action only routes to /watch/movie|tv/{tmdbId} with trusted TMDB.
 */
export function getWatchHref(
  c: Pick<
    Content,
    | "slug"
    | "id"
    | "playable"
    | "trailer"
    | "contentType"
    | "providerIds"
    | "animeFormat"
  >,
  opts?: { season?: number; episode?: number },
): string {
  // Anime: always slug — keeps AniList id + forces TV embeds for series
  if (c.contentType === "anime") {
    const key = contentPathKey(c);
    const params = new URLSearchParams();
    params.set("play", "full");
    if (c.animeFormat !== "MOVIE") {
      params.set("season", String(opts?.season ?? 1));
      params.set("episode", String(opts?.episode ?? 1));
    }
    return `/watch/${key}?${params.toString()}`;
  }

  const tmdbId = c.providerIds?.tmdb;
  const mediaType = c.providerIds?.tmdbMediaType;
  const hasTrustedTmdb =
    Boolean(tmdbId && Number.isFinite(tmdbId)) &&
    (mediaType === "movie" ||
      mediaType === "tv" ||
      c.contentType === "movie" ||
      c.contentType === "series" ||
      c.contentType === "kdrama" ||
      c.contentType === "cdrama" ||
      c.contentType === "jdrama" ||
      c.contentType === "thaidrama");

  if (hasTrustedTmdb && tmdbId) {
    if (isMovieWatch(c)) {
      return `/watch/movie/${tmdbId}`;
    }
    const season = opts?.season ?? 1;
    const episode = opts?.episode ?? 1;
    if (!opts?.season && !opts?.episode) {
      const last = getLastWatchedEpisode(tmdbId);
      if (last) {
        return `/watch/tv/${tmdbId}/${last.season}/${last.episode}`;
      }
    }
    return `/watch/tv/${tmdbId}/${season}/${episode}`;
  }

  const key = contentPathKey(c);
  const params = new URLSearchParams();
  params.set("play", "full");
  if (opts?.season != null) params.set("season", String(opts.season));
  if (opts?.episode != null) params.set("episode", String(opts.episode));
  return `/watch/${key}?${params.toString()}`;
}

/** Official trailer page (always slug-based legal player). */
export function getTrailerHref(
  c: Pick<Content, "slug" | "id" | "trailer">,
): string {
  const key = contentPathKey(c);
  return `/watch/${key}?play=trailer`;
}

export function getDetailsHref(c: Pick<Content, "slug" | "id">): string {
  return `/content/${contentPathKey(c)}`;
}

export function hasOfficialTrailer(
  c: Pick<Content, "trailer">,
): boolean {
  const key = c.trailer?.key;
  // Exact 11-char YouTube id only — reject truncated/dead keys
  return Boolean(
    c.trailer?.site === "youtube" &&
      key &&
      /^[\w-]{11}$/.test(key.trim()),
  );
}

export function watchCtaLabel(
  c: Pick<Content, "playable" | "trailer" | "providerIds">,
): "Watch Now" | "Watch Trailer" | "Open" {
  // Always offer Watch Now — anime/series hydrate TMDb on open (like Attack on Titan).
  // Dedicated "Watch Trailer" buttons use getTrailerHref separately.
  void c;
  return "Watch Now";
}

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
  if (c.providerIds?.tmdbMediaType === "movie") return true;
  if (c.providerIds?.tmdbMediaType === "tv") return false;
  if (c.contentType === "movie") return true;
  // AniList movie / ONA feature films mapped as anime
  if (
    c.contentType === "anime" &&
    (c.animeFormat === "MOVIE" || c.animeFormat === "SPECIAL")
  ) {
    // Without tmdbMediaType, default SPECIAL/OVA-style to TV episode path
    return c.animeFormat === "MOVIE";
  }
  return false;
}

/**
 * Watch Now — start playback of the title (movie full, or TV S1E1 / resume).
 * Always requests full playback. Trailers use getTrailerHref only.
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
  const tmdbId = c.providerIds?.tmdb;

  if (tmdbId && Number.isFinite(tmdbId)) {
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

  // No TMDb yet — open slug watch page; hydrate will resolve TMDb and redirect
  // when possible. Never send Watch Now to play=trailer.
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
  return Boolean(c.trailer?.site === "youtube" && c.trailer?.key);
}

export function watchCtaLabel(
  c: Pick<Content, "playable" | "trailer" | "providerIds">,
): "Watch Now" | "Watch Trailer" | "Open" {
  // Always offer Watch Now — anime/series hydrate TMDb on open (like Attack on Titan).
  // Dedicated "Watch Trailer" buttons use getTrailerHref separately.
  void c;
  return "Watch Now";
}

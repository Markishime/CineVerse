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
 *
 * Correctness rules:
 * - Only route to /watch/movie|tv/{tmdbId} when we have an explicit tmdb id
 *   AND a matching media type (or clear movie/tv contentType).
 * - Anime with only AniList/MAL (no tmdb) must stay on slug path so the
 *   VideoPlayer uses anime-native embeds — never a guessed wrong TMDb film.
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
  const mediaType = c.providerIds?.tmdbMediaType;
  const hasTrustedTmdb =
    Boolean(tmdbId && Number.isFinite(tmdbId)) &&
    // Require explicit media type OR clear non-anime content type so we never
    // send an anime card to a random live-action TMDb id.
    (mediaType === "movie" ||
      mediaType === "tv" ||
      c.contentType === "movie" ||
      c.contentType === "series" ||
      c.contentType === "kdrama" ||
      c.contentType === "cdrama" ||
      c.contentType === "jdrama" ||
      c.contentType === "thaidrama" ||
      // Anime only when media type is known (set by hydrate / provider)
      (c.contentType === "anime" &&
        (mediaType === "movie" || mediaType === "tv")));

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

  // Slug path: correct title identity; player uses anilist/mal/tmdb after hydrate.
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

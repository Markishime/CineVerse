import type { AnimeFormat, ContentType } from "@/types/content";

/** Genres that indicate scripted narrative drama suitable for K-drama. */
const KDRAMA_GENRE_HINTS = new Set([
  "drama",
  "romance",
  "comedy",
  "thriller",
  "crime",
  "fantasy",
  "history",
  "historical",
  "action",
  "adventure",
  "mystery",
  "family",
  "war",
  "sci-fi",
  "science fiction",
  "soap",
  "medical",
  "legal",
  "political",
  "melodrama",
]);

/** Non-scripted / non-narrative formats to exclude from K-drama. */
const KDRAMA_EXCLUDED_GENRES = new Set([
  "news",
  "reality",
  "talk",
  "talk show",
  "variety",
  "game show",
  "music",
  "sport",
  "sports",
  "documentary",
  "kids",
  "animation",
  "award show",
  "awards",
  "competition",
]);

const ALLOWED_ANIME_FORMATS: AnimeFormat[] = [
  "TV",
  "MOVIE",
  "OVA",
  "ONA",
  "SPECIAL",
  "SHORT",
];

export interface KDramaCandidate {
  isTv: boolean;
  originalLanguage?: string | null;
  originCountries?: string[];
  genres?: Array<{ name: string } | string>;
  typeLabel?: string | null;
  /** Admin override wins when set. */
  override?: ContentType | null;
}

export interface AnimeCandidate {
  format?: string | null;
  isAdult?: boolean;
  hasTitle?: boolean;
  hasCover?: boolean;
  mediaType?: string | null;
  override?: ContentType | null;
}

function genreNames(
  genres?: Array<{ name: string } | string>,
): string[] {
  if (!genres) return [];
  return genres.map((g) =>
    (typeof g === "string" ? g : g.name).toLowerCase().trim(),
  );
}

/**
 * Classify a TV title as K-drama when it is a scripted Korean series
 * with a narrative genre. Admin overrides take precedence.
 */
export function isKDrama(candidate: KDramaCandidate): boolean {
  if (candidate.override != null) {
    return candidate.override === "kdrama";
  }
  if (!candidate.isTv) return false;

  const lang = (candidate.originalLanguage ?? "").toLowerCase();
  const countries = (candidate.originCountries ?? []).map((c) =>
    c.toUpperCase(),
  );
  const isKorean =
    lang === "ko" || countries.includes("KR") || countries.includes("KOR");
  if (!isKorean) return false;

  const names = genreNames(candidate.genres);
  if (names.some((n) => KDRAMA_EXCLUDED_GENRES.has(n))) return false;

  const type = (candidate.typeLabel ?? "").toLowerCase();
  if (
    type.includes("reality") ||
    type.includes("talk") ||
    type.includes("news") ||
    type.includes("variety") ||
    type.includes("documentary")
  ) {
    return false;
  }

  if (names.length === 0) {
    // Korean scripted series without genre metadata — allow with caution
    return true;
  }

  return names.some((n) => KDRAMA_GENRE_HINTS.has(n));
}

/**
 * Accept AniList anime formats suitable for CineVerse catalog.
 * Exclude manga, novels, adult-only, and empty metadata.
 */
export function isValidAnime(candidate: AnimeCandidate): boolean {
  if (candidate.override != null) {
    return candidate.override === "anime";
  }

  if (candidate.isAdult) return false;
  if (candidate.mediaType && candidate.mediaType.toUpperCase() !== "ANIME") {
    return false;
  }
  if (!candidate.hasTitle) return false;
  if (!candidate.hasCover) return false;

  const format = normalizeAnimeFormat(candidate.format);
  if (!format || format === "MUSIC" || format === "UNKNOWN") return false;
  return ALLOWED_ANIME_FORMATS.includes(format);
}

export function normalizeAnimeFormat(
  format?: string | null,
): AnimeFormat | undefined {
  if (!format) return undefined;
  const f = format.toUpperCase().replace(/[\s-]/g, "_");
  switch (f) {
    case "TV":
    case "TV_SHORT":
      return f === "TV_SHORT" ? "SHORT" : "TV";
    case "MOVIE":
      return "MOVIE";
    case "OVA":
      return "OVA";
    case "ONA":
      return "ONA";
    case "SPECIAL":
      return "SPECIAL";
    case "SHORT":
      return "SHORT";
    case "MUSIC":
      return "MUSIC";
    default:
      return "UNKNOWN";
  }
}

/**
 * Resolve final content type from providers + overrides.
 */
export function resolveContentType(input: {
  isAnime?: boolean;
  isKDrama?: boolean;
  isMovie?: boolean;
  isTv?: boolean;
  override?: ContentType | null;
}): ContentType {
  if (input.override) return input.override;
  if (input.isAnime) return "anime";
  if (input.isKDrama) return "kdrama";
  if (input.isMovie) return "movie";
  if (input.isTv) return "series";
  return "movie";
}

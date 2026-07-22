import type { AnimeFormat, ContentType, DramaContentType } from "@/types/content";
import { DRAMA_META } from "@/types/content";

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

/** Origin lookup: language / country → specific drama type. */
const DRAMA_LANG_TO_TYPE: Record<string, DramaContentType> = {};
const DRAMA_COUNTRY_TO_TYPE: Record<string, DramaContentType> = {};
for (const [type, meta] of Object.entries(DRAMA_META) as Array<
  [DramaContentType, (typeof DRAMA_META)[DramaContentType]]
>) {
  for (const l of meta.languages) DRAMA_LANG_TO_TYPE[l.toLowerCase()] = type;
  for (const c of meta.countries) DRAMA_COUNTRY_TO_TYPE[c.toUpperCase()] = type;
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
 * Classify a TV title into a specific Asian-drama type (K/C/J/Thai) when it is
 * a scripted series from that country with a narrative genre. Returns null when
 * it is not an Asian drama. Admin overrides take precedence.
 *
 * NOTE: anime must be classified BEFORE this (Japanese animation would match
 * jdrama by language otherwise). Callers pass only non-anime TV here.
 */
export function classifyDrama(
  candidate: KDramaCandidate,
): DramaContentType | null {
  if (candidate.override != null) {
    return (["kdrama", "cdrama", "jdrama", "thaidrama"] as const).includes(
      candidate.override as DramaContentType,
    )
      ? (candidate.override as DramaContentType)
      : null;
  }
  if (!candidate.isTv) return null;

  const lang = (candidate.originalLanguage ?? "").toLowerCase();
  const countries = (candidate.originCountries ?? []).map((c) =>
    c.toUpperCase(),
  );

  // Resolve origin → drama type. Country takes precedence over language.
  let dramaType: DramaContentType | null = null;
  for (const c of countries) {
    if (DRAMA_COUNTRY_TO_TYPE[c]) {
      dramaType = DRAMA_COUNTRY_TO_TYPE[c];
      break;
    }
  }
  if (!dramaType && DRAMA_LANG_TO_TYPE[lang]) {
    dramaType = DRAMA_LANG_TO_TYPE[lang];
  }
  if (!dramaType) return null;

  const names = genreNames(candidate.genres);
  if (names.some((n) => KDRAMA_EXCLUDED_GENRES.has(n))) return null;

  const type = (candidate.typeLabel ?? "").toLowerCase();
  if (
    type.includes("reality") ||
    type.includes("talk") ||
    type.includes("news") ||
    type.includes("variety") ||
    type.includes("documentary")
  ) {
    return null;
  }

  if (names.length === 0) {
    // Scripted series without genre metadata — allow with caution
    return dramaType;
  }

  return names.some((n) => KDRAMA_GENRE_HINTS.has(n)) ? dramaType : null;
}

/**
 * Back-compat boolean: true only for Korean drama.
 * Prefer `classifyDrama` for the specific country type.
 */
export function isKDrama(candidate: KDramaCandidate): boolean {
  return classifyDrama(candidate) === "kdrama";
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
  /** Specific Asian-drama type (K/C/J/Thai). Wins over isKDrama when set. */
  dramaType?: DramaContentType | null;
  isMovie?: boolean;
  isTv?: boolean;
  override?: ContentType | null;
}): ContentType {
  if (input.override) return input.override;
  if (input.isAnime) return "anime";
  if (input.dramaType) return input.dramaType;
  if (input.isKDrama) return "kdrama";
  if (input.isMovie) return "movie";
  if (input.isTv) return "series";
  return "movie";
}

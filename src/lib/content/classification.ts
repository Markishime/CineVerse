import type {
  AnimeFormat,
  Content,
  ContentType,
  DramaContentType,
} from "@/types/content";
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
  genres?: Array<{ id?: number | string; name: string } | string>;
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
  genres?: Array<{ id?: number | string; name: string } | string>,
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
  // Genre id "16" (TMDB Animation) must never classify as live-action drama
  if (
    (candidate.genres ?? []).some((g) => {
      if (typeof g === "string") return false;
      return String(g.id) === "16";
    })
  ) {
    return null;
  }

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
    case "FILM":
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

/** Theatrical anime films only — Anime Movies tab. */
const ANIME_MOVIE_FORMATS = new Set<string>(["MOVIE"]);

/** Episodic anime — Anime Series tab (TV / OVA / ONA / SPECIAL / SHORT). */
const ANIME_SERIES_FORMATS = new Set<string>([
  "TV",
  "OVA",
  "ONA",
  "SPECIAL",
  "SHORT",
]);

/**
 * True when an anime title belongs on the Anime Movies tab.
 * Requires explicit MOVIE format (never treat missing format as a film).
 */
export function isAnimeMovieFormat(
  c: Pick<Content, "contentType" | "animeFormat" | "providerIds">,
): boolean {
  if (c.contentType !== "anime") return false;
  if (c.animeFormat && ANIME_MOVIE_FORMATS.has(c.animeFormat)) return true;
  // TMDB anime films always set animeFormat=MOVIE; if missing, check media type.
  if (!c.animeFormat && c.providerIds?.tmdbMediaType === "movie") return true;
  return false;
}

/**
 * True when an anime title belongs on the Anime Series tab.
 * Never includes theatrical films. Missing format defaults to series when the
 * provider media type is tv / unknown (most AniList TV entries have format set).
 */
export function isAnimeSeriesFormat(
  c: Pick<Content, "contentType" | "animeFormat" | "providerIds">,
): boolean {
  if (c.contentType !== "anime") return false;
  if (isAnimeMovieFormat(c)) return false;
  if (c.animeFormat && ANIME_SERIES_FORMATS.has(c.animeFormat)) return true;
  // No format / unknown — treat as series only when not a movie media type.
  if (!c.animeFormat || c.animeFormat === "UNKNOWN") {
    return c.providerIds?.tmdbMediaType !== "movie";
  }
  return false;
}

/**
 * Match catalog `animeFormat` query param ("movie" | "series") to a title.
 */
export function matchesAnimeFormatCategory(
  c: Pick<Content, "contentType" | "animeFormat" | "providerIds">,
  category: "movie" | "series",
): boolean {
  return category === "movie" ? isAnimeMovieFormat(c) : isAnimeSeriesFormat(c);
}

/**
 * True when a title is anime / animation and must not appear in live-action
 * drama rows (especially Popular J-dramas — JP origin includes lots of anime).
 */
export function isAnimeLikeContent(
  c: Pick<
    Content,
    "contentType" | "animeFormat" | "genres" | "tags"
  >,
): boolean {
  if (c.contentType === "anime") return true;
  if (c.animeFormat) return true;
  if (c.genres?.some((g) => /anim/i.test(g.name) || g.id === "16")) {
    return true;
  }
  if (
    c.tags?.some((t) =>
      /^(anime|animation)$/i.test(t) ||
      /(^|[\s_-])anime([\s_-]|$)/i.test(t),
    )
  ) {
    return true;
  }
  return false;
}

/**
 * True for the general Series catalog only — never anime and never Asian dramas
 * (K/C/J/Thai). Those have their own tabs.
 */
export function isGeneralSeriesOnly(
  c: Pick<
    Content,
    "contentType" | "language" | "countries" | "genres" | "tags" | "animeFormat"
  >,
): boolean {
  if (c.contentType !== "series") return false;
  if (c.animeFormat) return false;
  if (c.genres?.some((g) => /anim/i.test(g.name) || g.id === "16")) {
    return false;
  }
  if (c.tags?.some((t) => /anime|animation/i.test(t))) return false;

  // Asian drama origins live under Dramas tabs, not Series.
  const dramaCountries = new Set(["KR", "JP", "CN", "TW", "HK", "TH"]);
  if (c.countries?.some((cn) => dramaCountries.has(cn.toUpperCase()))) {
    return false;
  }
  const dramaLangs = new Set(["ko", "ja", "zh", "th", "cn"]);
  if (c.language && dramaLangs.has(c.language.toLowerCase())) {
    return false;
  }
  return true;
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

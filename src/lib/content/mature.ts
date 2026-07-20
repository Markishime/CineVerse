/**
 * Mature / 18+ content rules for CineVerse.
 *
 * Mature library (and mature home rows) show ONLY explicit sexual content:
 *   nudity, sex, erotica, hentai — NOT violence-only, crime TV-MA, or soft ecchi.
 *
 * When settings.matureContent is OFF, the same explicit titles are hidden
 * from home, catalogs, search, and discover.
 */

import type { Content, ContentType } from "@/types/content";

/** Tags that prove sexual / nude explicit content */
const EXPLICIT_SEXUAL_TAGS = new Set([
  "nudity",
  "sex",
  "sexual",
  "sexual-content",
  "sexual content",
  "erotica",
  "erotic",
  "hentai",
  "explicit",
  "xxx",
  "softcore",
  "hardcore",
  "pornographic",
  "adult-anime",
  "anilist-adult",
  "jikan-rx",
  "nc-17",
]);

/** Overview keywords (metadata only — for seed / edge cases) */
const SEXUAL_OVERVIEW =
  /\b(nudity|nude|sex(ual)?|erotica|erotic|hentai|pornograph|lovemaking|intercourse)\b/i;

/** Violence-only / non-sexual “mature” — never enough alone for the library */
const NON_SEXUAL_ONLY = new Set([
  "violence",
  "dark fantasy",
  "horror",
  "gore",
  "thriller",
  "crime",
  "war",
  "action",
]);

function tagList(
  c: Pick<Content, "tags"> | null | undefined,
): string[] {
  return (c?.tags ?? []).map((t) => t.toLowerCase().trim());
}

function hasExplicitSexualTag(tags: string[]): boolean {
  for (const t of tags) {
    if (EXPLICIT_SEXUAL_TAGS.has(t)) return true;
    if (t.includes("nudity") || t.includes("hentai") || t.includes("erotica")) {
      return true;
    }
    if (t.includes("sexual") || t === "sex") return true;
    // "explicit" alone counts when paired with mature/18+ context
    if (t === "explicit") return true;
  }
  return false;
}

/**
 * True only for explicit sexual content (nudity / sex / erotica / hentai).
 * Used by Mature library tabs (movies, series, anime, kdrama) and home 18+ rows.
 */
export function isExplicitSexualContent(
  c:
    | Pick<
        Content,
        "mature" | "ageRating" | "tags" | "contentType" | "overview" | "title"
      >
    | null
    | undefined,
): boolean {
  if (!c) return false;

  const tags = tagList(c);
  const rating = (c.ageRating ?? "").trim();
  const overview = c.overview ?? "";

  // ── Anime: AniList isAdult / Jikan Rx / sexual tags only ──
  if (c.contentType === "anime") {
    if (tags.includes("anilist-adult") || tags.includes("jikan-rx")) return true;
    if (tags.includes("hentai") || tags.includes("adult-anime")) return true;
    if (hasExplicitSexualTag(tags)) return true;
    if (/Rx\s*-?\s*Hentai|^18\+$/i.test(rating)) return true;
    // mature:true alone is not enough (violence anime must not pass)
    if (c.mature && hasExplicitSexualTag(tags)) return true;
    if (c.mature && SEXUAL_OVERVIEW.test(overview)) return true;
    return false;
  }

  // ── Movies / series / kdrama ──
  if (hasExplicitSexualTag(tags)) return true;

  // NC-17 is often sexual; keep if overview or tags support, or always NC-17
  if (/^NC-17$/i.test(rating) || rating.toUpperCase().includes("NC-17")) {
    return true;
  }

  // TMDB adult flag is mapped to ageRating 18+ + mature
  if (
    c.mature &&
    (rating === "18+" || /adult/i.test(rating)) &&
    (hasExplicitSexualTag(tags) || SEXUAL_OVERVIEW.test(overview) || tags.includes("18+"))
  ) {
    // Require more than violence-only tags
    const onlyViolence =
      tags.some((t) => NON_SEXUAL_ONLY.has(t)) &&
      !hasExplicitSexualTag(tags) &&
      !SEXUAL_OVERVIEW.test(overview) &&
      !tags.includes("18+") &&
      !tags.includes("adult-themes");
    if (onlyViolence) return false;
  }

  if (c.mature && hasExplicitSexualTag(tags)) return true;
  if (c.mature && SEXUAL_OVERVIEW.test(overview)) return true;

  // Seed/provider: mature + (18+ or adult-themes) + not violence-only
  if (c.mature) {
    const sexualHint =
      tags.includes("18+") ||
      tags.includes("adult") ||
      tags.includes("adult-themes") ||
      tags.includes("mature");
    const violenceOnly =
      tags.some((t) => NON_SEXUAL_ONLY.has(t)) &&
      !hasExplicitSexualTag(tags) &&
      !SEXUAL_OVERVIEW.test(overview);
    if (sexualHint && !violenceOnly && hasExplicitSexualTag(tags)) return true;
    if (sexualHint && SEXUAL_OVERVIEW.test(overview)) return true;
    // mature + explicit/nudity already handled; mature + 18+ without sexual = reject
    if (hasExplicitSexualTag(tags)) return true;
  }

  return false;
}

/**
 * Gate for hiding titles when 18+ is OFF.
 * Same as explicit sexual content — we only restrict real adult material.
 */
export function isMatureContent(
  c:
    | Pick<
        Content,
        "mature" | "ageRating" | "tags" | "contentType" | "overview" | "title"
      >
    | null
    | undefined,
): boolean {
  return isExplicitSexualContent(c);
}

/** @deprecated use isExplicitSexualContent */
export function isAccurateAdultAnime(
  c:
    | Pick<
        Content,
        "mature" | "ageRating" | "tags" | "contentType" | "overview" | "title"
      >
    | null
    | undefined,
): boolean {
  if (!c) return false;
  if (c.contentType && c.contentType !== "anime") return false;
  return isExplicitSexualContent(c);
}

/** Drop every explicit title when includeMature is false. */
export function filterByMatureFlag<
  T extends Pick<
    Content,
    "mature" | "ageRating" | "tags" | "contentType" | "overview" | "title"
  >,
>(items: T[], includeMature: boolean): T[] {
  if (includeMature) return items;
  return items.filter((c) => !isExplicitSexualContent(c));
}

/**
 * Normalize flags: only mark mature when sexual/explicit signals exist.
 * Strips false positives (violence-only R / TV-MA / dark fantasy).
 */
export function applyMatureFlag(c: Content): Content {
  if (isExplicitSexualContent(c)) {
    return {
      ...c,
      mature: true,
      ageRating: c.ageRating || "18+",
      tags: Array.from(
        new Set([
          ...(c.tags ?? []),
          "18+",
          "mature",
          "explicit",
          ...(c.contentType === "anime" ? ["adult-anime", "anime"] : []),
        ]),
      ),
    };
  }

  // Clear false mature flags (e.g. violence-only seeds / R-rated action)
  if (c.mature || (c.tags ?? []).some((t) => /18\+|mature|adult/i.test(t))) {
    const cleanedTags = (c.tags ?? []).filter((t) => {
      const x = t.toLowerCase();
      return ![
        "18+",
        "mature",
        "adult",
        "adult-themes",
        "explicit",
        "adult-anime",
        "anilist-adult",
        "jikan-rx",
        "nudity",
        "hentai",
        "erotica",
        "sex",
        "sexual",
      ].includes(x);
    });
    return {
      ...c,
      mature: false,
      ageRating:
        c.ageRating === "18+" || c.ageRating === "R+" || c.ageRating === "NC-17"
          ? c.ageRating === "NC-17"
            ? c.ageRating
            : null
          : c.ageRating,
      tags: cleanedTags,
    };
  }
  return c;
}

/** Mature library + home 18+ rows: sexual/explicit only, all types. */
export function filterExplicitMatureLibrary(items: Content[]): Content[] {
  return items.filter((c) => isExplicitSexualContent(c));
}

/** @deprecated use filterExplicitMatureLibrary */
export function filterMatureAnimeLibrary(items: Content[]): Content[] {
  return items.filter(
    (c) => c.contentType === "anime" && isExplicitSexualContent(c),
  );
}

export function isAnimeType(t?: ContentType | string | null): boolean {
  return t === "anime";
}

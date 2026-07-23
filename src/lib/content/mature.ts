/**
 * Mature / 18+ content rules for CineVerse.
 *
 * Two distinct concepts — do not conflate them:
 *
 * 1. `isExplicitSexualContent` — ONLY explicit sexual content (nudity, sex,
 *    erotica, hentai). Powers the dedicated 18+ *library* rows/tabs, which are
 *    curated to sexual material specifically.
 *
 * 2. `isAdultRestricted` / `isMatureContent` — ANY title an adult-only audience
 *    is intended for: 18+ / R18 / R18+ / R+ / NC-17 age ratings, provider adult
 *    flags (AniList isAdult, TMDB adult), hentai, AND adults-only anime such as
 *    ecchi rated 18+ (e.g. "Overflow"). This is the GATE used to HIDE titles
 *    everywhere (home, catalogs, search, discover, recommendations) when the
 *    user's 18+ toggle is OFF. When the toggle is off, nothing adult-rated shows
 *    — sexual or not.
 */

import type { Content, ContentType } from "@/types/content";

// ─── Restricted content email allowlist ─────────────────────────────────────
// Only these email addresses may view hentai, 18+ mature, and Filipino movies.
const RESTRICTED_CONTENT_EMAILS = new Set(["cmark7781@gmail.com"]);

/**
 * Returns true when the given email is allowed to view restricted content
 * (hentai, 18+ mature, Filipino movies). All other users never see these.
 */
export function isRestrictedContentUser(
  email?: string | null,
): boolean {
  if (!email) return false;
  return RESTRICTED_CONTENT_EMAILS.has(email.toLowerCase());
}

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

  // ── Anime / hentai: AniList isAdult / Jikan Rx / explicit hentai only ──
  // Ecchi / R+ fanservice (anime-adult-genre) is adults-only for the hide-gate
  // but is NOT hentai — it must never enter the Hentai tab.
  if (c.contentType === "anime") {
    return isHentaiContent(c);
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

/** Age ratings that are adults-only across every content type. */
const ADULT_AGE_RATING =
  /^(18\+?|R18\+?|R\+|NC-?17|X|XXX|AO|TV-?MA-?A|Rx)$/i;

/** Tags that mark adults-only content (broader than sexual — includes ecchi 18+). */
const ADULT_ONLY_TAGS = new Set([
  "18+",
  "r18",
  "r18+",
  "r+",
  "rx",
  "nc-17",
  "adults-only",
  "adult-only",
  "adults only",
  "adult",
  "adult-anime",
  "anilist-adult",
  "jikan-rx",
  "tmdb-adult",
  "hentai",
]);

/**
 * True for ANY adults-only title — the gate used to hide content when the
 * 18+ toggle is OFF. Broader than `isExplicitSexualContent`: this also catches
 * adults-only anime that is rated 18+/R18 without being outright hentai
 * (ecchi like "Overflow"), plus NC-17 films and provider adult flags.
 */
export function isAdultRestricted(
  c:
    | Pick<
        Content,
        "mature" | "ageRating" | "tags" | "contentType" | "overview" | "title"
      >
    | null
    | undefined,
): boolean {
  if (!c) return false;

  // Explicit sexual content is always adult-restricted.
  if (isExplicitSexualContent(c)) return true;

  const tags = tagList(c);
  const rating = (c.ageRating ?? "").trim();

  // Provider adult flags / adults-only tags (any content type).
  if (tags.some((t) => ADULT_ONLY_TAGS.has(t))) return true;

  // Adults-only age ratings (18+, R18, R18+, R+, NC-17, Rx, X…).
  if (rating && ADULT_AGE_RATING.test(rating)) return true;

  // Anime: AniList/MAL adults-only signals. AniList `isAdult` is mapped to the
  // `anilist-adult` tag upstream; Rx / R18+ ratings and adult-anime tags also
  // mark hentai/adult ecchi that must hide when 18+ is off.
  if (c.contentType === "anime") {
    if (/(^|[^a-z])(rx|r18\+?|r\s*-?\s*17\+|18\+)([^a-z]|$)/i.test(rating)) {
      return true;
    }
    if (
      tags.includes("anilist-adult") ||
      tags.includes("adult-anime") ||
      tags.includes("jikan-rx") ||
      tags.includes("hentai")
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Gate for hiding titles when 18+ is OFF.
 *
 * NOTE: intentionally broader than `isExplicitSexualContent`. When the toggle
 * is off we hide EVERYTHING adults-only (18+/R18/NC-17/provider-adult/hentai/
 * ecchi-18+), not only sexual titles. Use `isExplicitSexualContent` for the
 * curated 18+ *library* rows instead.
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
  return isAdultRestricted(c);
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

/** Drop every adults-only title when includeMature is false. */
export function filterByMatureFlag<
  T extends Pick<
    Content,
    "mature" | "ageRating" | "tags" | "contentType" | "overview" | "title"
  >,
>(items: T[], includeMature: boolean): T[] {
  if (includeMature) return items;
  return items.filter((c) => !isAdultRestricted(c));
}

/**
 * Public surfaces (home popular/trending/featured, Movies/Series/Anime/Drama
 * catalogs, discover, search): NEVER include 18+ / adult-restricted titles.
 * Those belong exclusively on Anime → Hentai for the allowlisted user.
 */
export function filterPublicCatalog<
  T extends Pick<
    Content,
    "mature" | "ageRating" | "tags" | "contentType" | "overview" | "title"
  >,
>(items: T[]): T[] {
  return items.filter((c) => !isAdultRestricted(c));
}

/** Keep only adults-only titles for the dedicated hentai / mature library. */
export function filterAdultLibrary<
  T extends Pick<
    Content,
    "mature" | "ageRating" | "tags" | "contentType" | "overview" | "title"
  >,
>(items: T[]): T[] {
  return items.filter((c) => isAdultRestricted(c));
}

/**
 * Normalize flags:
 *  - explicit sexual → mark mature + explicit tags
 *  - adults-only-by-rating (18+/R18/NC-17/provider-adult/ecchi-18+) → mark
 *    mature + 18+ so the OFF gate hides it, WITHOUT the explicit-sexual tags
 *  - everything else (violence-only R / TV-MA / dark fantasy) → strip false
 *    mature flags so it stays visible when 18+ is off
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

  // Adults-only by rating / provider flag (not explicitly sexual) — e.g. ecchi
  // rated 18+ like "Overflow", NC-17 films, AniList isAdult. Keep it flagged so
  // it disappears when 18+ is off, but don't tag it as explicit sexual content.
  if (isAdultRestricted(c)) {
    return {
      ...c,
      mature: true,
      ageRating: c.ageRating || "18+",
      tags: Array.from(new Set([...(c.tags ?? []), "18+", "mature"])),
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

/**
 * True only for real hentai / Rx adult anime — never mild ecchi or violence 18+.
 * Ground truth: AniList isAdult, Jikan Rx, hentai genre/provider tags.
 */
export function isHentaiContent(
  c:
    | Pick<
        Content,
        "mature" | "ageRating" | "tags" | "contentType" | "overview" | "title"
      >
    | null
    | undefined,
): boolean {
  if (!c || c.contentType !== "anime") return false;

  const tags = tagList(c);
  const rating = (c.ageRating ?? "").trim();
  const overview = c.overview ?? "";

  // Ecchi / soft adult-oriented genres alone are NOT hentai.
  const onlyEcchiGate =
    tags.includes("anime-adult-genre") &&
    !tags.includes("anilist-adult") &&
    !tags.includes("jikan-rx") &&
    !tags.includes("hentai") &&
    !tags.includes("hentaianime") &&
    !tags.includes("hentaiocean") &&
    !tags.includes("anipub") &&
    !hasExplicitSexualTag(tags.filter((t) => t !== "explicit" && t !== "adult-anime"));
  if (onlyEcchiGate && !/rx/i.test(rating)) return false;

  // Provider ground truth
  if (tags.includes("anilist-adult") || tags.includes("jikan-rx")) return true;
  if (tags.includes("hentai")) return true;
  // Dedicated hentai scrapers (always adult). AniPub only when tagged hentai above.
  if (tags.includes("hentaianime") || tags.includes("hentaiocean")) {
    return true;
  }

  // adult-anime is set only for AniList isAdult / dedicated adult packs
  if (tags.includes("adult-anime") && !tags.includes("anime-adult-genre")) {
    return true;
  }

  // Explicit sexual tags (nudity/sex/erotica/xxx) — not generic "explicit" alone
  // when it was bulk-applied with false positives.
  if (
    tags.some((t) =>
      [
        "nudity",
        "sex",
        "sexual",
        "sexual-content",
        "sexual content",
        "erotica",
        "erotic",
        "xxx",
        "softcore",
        "hardcore",
        "pornographic",
      ].includes(t),
    )
  ) {
    return true;
  }

  // Jikan / MAL Rx rating only (not bare 18+ — that catches non-hentai too)
  if (/rx/i.test(rating) || /hentai/i.test(rating)) return true;

  if (c.mature && SEXUAL_OVERVIEW.test(overview)) return true;

  return false;
}

/** Hentai tab: only true hentai anime (excludes ecchi, live-action 18+, etc.). */
export function filterHentaiLibrary<
  T extends Pick<
    Content,
    "mature" | "ageRating" | "tags" | "contentType" | "overview" | "title"
  >,
>(items: T[]): T[] {
  return items.filter((c) => isHentaiContent(c));
}

export function isAnimeType(t?: ContentType | string | null): boolean {
  return t === "anime";
}

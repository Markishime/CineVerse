/**
 * Resolve the correct embed stream language from content origin
 * (country / original language / content type), not the user's UI language.
 *
 * AutoEmbed `lang=` and similar hosts expect ISO 639-1 (ko, ja, zh, th, en, …).
 */

/** Normalize any TMDB / catalog language tag to ISO 639-1. */
export function normalizeLangCode(raw?: string | null): string | null {
  if (!raw) return null;
  const base = raw.trim().toLowerCase().replace("_", "-");
  if (!base) return null;

  // Already short code
  const primary = base.split("-")[0] ?? base;

  // Common aliases
  const map: Record<string, string> = {
    cn: "zh",
    "zh-cn": "zh",
    "zh-tw": "zh",
    "zh-hk": "zh",
    cmn: "zh",
    yue: "zh",
    kr: "ko",
    "ko-kr": "ko",
    jp: "ja",
    "ja-jp": "ja",
    "th-th": "th",
    fil: "tl",
    tgl: "tl",
    phi: "tl",
    iw: "he",
    nb: "no",
    nn: "no",
    ptbr: "pt",
    "pt-br": "pt",
    "es-mx": "es",
    "es-es": "es",
  };

  if (map[base]) return map[base];
  if (map[primary]) return map[primary];
  // Valid 2–3 letter codes
  if (/^[a-z]{2,3}$/.test(primary)) return primary;
  return null;
}

/**
 * Default language from content type when original language is missing.
 */
export function languageFromContentType(contentType?: string | null): string {
  const ct = (contentType ?? "").toLowerCase();
  if (ct === "anime") return "ja";
  if (ct === "kdrama") return "ko";
  if (ct === "cdrama") return "zh";
  if (ct === "jdrama") return "ja";
  if (ct === "thaidrama") return "th";
  return "en";
}

/**
 * Infer language from production countries (ISO 3166-1 alpha-2).
 */
export function languageFromCountries(
  countries?: string[] | null,
): string | null {
  if (!countries?.length) return null;
  const set = new Set(countries.map((c) => c.toUpperCase()));
  if (set.has("KR")) return "ko";
  if (set.has("JP")) return "ja";
  if (set.has("CN") || set.has("TW") || set.has("HK")) return "zh";
  if (set.has("TH")) return "th";
  if (set.has("PH")) return "tl";
  if (set.has("IN")) return "hi";
  if (set.has("FR")) return "fr";
  if (set.has("DE")) return "de";
  if (set.has("ES") || set.has("MX") || set.has("AR")) return "es";
  if (set.has("BR") || set.has("PT")) return "pt";
  if (set.has("IT")) return "it";
  if (set.has("RU")) return "ru";
  if (set.has("US") || set.has("GB") || set.has("AU") || set.has("CA"))
    return "en";
  return null;
}

/**
 * Embed language for AutoEmbed / VidCore / etc.
 * Priority:
 * 1. Content original language (TMDB / AniList)
 * 2. Production countries
 * 3. Content-type defaults (anime→ja, kdrama→ko, …)
 *
 * User profile audio prefs do NOT override origin for the default stream —
 * Korean titles stay Korean, Japanese stay Japanese, etc.
 */
export function resolveEmbedLanguage(opts: {
  originalLanguage?: string | null;
  contentType?: string | null;
  countries?: string[] | null;
  /** Optional explicit override (e.g. user picked "en" dub for anime) */
  userPreference?: string | null;
  /** When true, allow userPreference to win (anime dub toggle only) */
  allowUserOverride?: boolean;
}): string {
  if (opts.allowUserOverride) {
    const user = normalizeLangCode(opts.userPreference);
    if (user) return user;
  }

  const fromOriginal = normalizeLangCode(opts.originalLanguage);
  if (fromOriginal) return fromOriginal;

  const fromCountry = languageFromCountries(opts.countries);
  if (fromCountry) return fromCountry;

  return languageFromContentType(opts.contentType);
}

/**
 * Prefer dubbed audio only when the embed language is English
 * (or user explicitly wants EN for anime).
 */
export function preferDubForLanguage(lang: string): boolean {
  const l = lang.toLowerCase();
  return l === "en" || l.startsWith("en-");
}

/**
 * Languages free embed hosts (AutoEmbed, VidFast, VidSrc, …) almost never
 * carry as a stream track. Requesting them as `lang=` often returns empty /
 * broken players — fall back to English so the movie still plays.
 *
 * Tagalog / Filipino (tl, fil) is the main case for PH cinema.
 */
const STREAM_HOST_UNSUPPORTED = new Set([
  "tl",
  "fil",
  "tgl",
  "ceb", // Cebuano
  "ilo",
  "war",
  "hil",
]);

/**
 * Language code for hosts that accept `lang=`.
 * - ko / ja / zh / th / en … passed through when supported
 * - Tagalog (tl) and other unsupported codes → `en` so AutoEmbed still loads
 * - PH films often stream as English tracks on free hosts
 */
export function toStreamHostLanguage(
  originLang: string,
  countries?: string[] | null,
): string {
  const lang = normalizeLangCode(originLang) || originLang.toLowerCase();
  const isPh = (countries ?? []).some((c) => c.toUpperCase() === "PH");

  if (STREAM_HOST_UNSUPPORTED.has(lang)) return "en";
  if (isPh && STREAM_HOST_UNSUPPORTED.has(lang)) return "en";
  // Philippine cinema with missing/exotic language → English track
  if (isPh && (!lang || lang === "tl" || lang === "fil")) return "en";

  return lang || "en";
}

/** True when content is Filipino / Philippine cinema. */
export function isFilipinoLocale(opts: {
  originalLanguage?: string | null;
  countries?: string[] | null;
}): boolean {
  const lang = normalizeLangCode(opts.originalLanguage);
  if (lang === "tl" || lang === "fil" || lang === "tgl") return true;
  return (opts.countries ?? []).some((c) => c.toUpperCase() === "PH");
}

/**
 * Official trailer selection for movies, series, anime, and K-drama.
 *
 * Policy: only YouTube videos with TMDB type "Trailer".
 * Prefer official:true. Never use Clip / Featurette / Behind the Scenes /
 * Opening Credits / Bloopers / Teaser as the primary "trailer".
 */

import type { Trailer } from "@/types/content";

/** YouTube video ids are always 11 chars [A-Za-z0-9_-] */
export function isValidYoutubeKey(key?: string | null): boolean {
  return Boolean(key && /^[\w-]{11}$/.test(key.trim()));
}

/** Reject truncated / known-dead keys at selection time */
const DEAD_KEYS = new Set([
  "pkKu9yvy1bw",
  "EXeq9FDrBc",
  "SWm2FqR7GA",
  "y0ugUzF2X4",
  "YoHD9XEInc0",
  "LaLzIQ1s0c4",
  "BcWRrvaZb9I",
  "F1B9Fk_SgI0",
  "S8_YwFLCh4U",
  "YoHD9XEK0xo",
]);

function isSelectableKey(key?: string | null): boolean {
  if (!isValidYoutubeKey(key)) return false;
  return !DEAD_KEYS.has(String(key).trim());
}

/** Non-trailer video kinds we never promote as "the trailer" */
const NON_TRAILER_TYPES = new Set(
  [
    "clip",
    "featurette",
    "behind the scenes",
    "bloopers",
    "opening credits",
    "recap",
    "teaser",
    "interview",
    "trailer teaser",
  ].map((s) => s.toLowerCase()),
);

/**
 * True when this is a real Trailer (not clip/featurette/etc).
 * Empty type is allowed only if the name clearly says "trailer".
 */
export function isTrailerType(t: Pick<Trailer, "type" | "name">): boolean {
  const type = (t.type ?? "").trim().toLowerCase();
  if (type === "trailer") return true;
  if (type && NON_TRAILER_TYPES.has(type)) return false;
  // No type from provider — accept only if name indicates trailer
  if (!type) {
    return /\btrailer\b/i.test(t.name ?? "") && !/\bteaser\b/i.test(t.name ?? "");
  }
  // Unknown type: only if name is clearly a trailer
  return /\btrailer\b/i.test(t.name ?? "") && !NON_TRAILER_TYPES.has(type);
}

/** Prefer official studio trailers */
export function isOfficialTrailer(t: Trailer): boolean {
  if (!isSelectableKey(t.key)) return false;
  if (t.site !== "youtube") return false;
  if (!isTrailerType(t)) return false;
  if (t.official === true) return true;
  // Name often includes "Official Trailer" when flag is missing
  return /official/i.test(t.name ?? "");
}

/**
 * Score for ranking: higher = better primary trailer.
 * Official Trailer >> any Trailer >> nothing else.
 */
export function officialTrailerScore(t: Trailer): number {
  if (!isSelectableKey(t.key) || t.site !== "youtube") return -1;
  if (!isTrailerType(t)) return -1;
  let s = 10;
  if (t.official) s += 20;
  if (/official/i.test(t.name ?? "")) s += 8;
  if (/^official trailer$/i.test((t.name ?? "").trim())) s += 5;
  // Prefer shorter names that look like main trailers over "Trailer 2" noise slightly
  if (/\btrailer\s*#?\s*1\b/i.test(t.name ?? "") || /\bmain trailer\b/i.test(t.name ?? "")) {
    s += 3;
  }
  return s;
}

/** Keep only official-or-best Trailer-type YouTube videos, ranked. */
export function filterOfficialTrailers(list: Trailer[]): Trailer[] {
  const byKey = new Map<string, Trailer>();
  for (const raw of list) {
    if (!raw?.key || raw.site !== "youtube") continue;
    const key = raw.key.trim();
    if (!isSelectableKey(key)) continue;
    const t: Trailer = {
      ...raw,
      key,
      id: raw.id || `yt_${key}`,
      site: "youtube",
      name: raw.name || "Official Trailer",
      official: Boolean(raw.official || /official/i.test(raw.name ?? "")),
      type: raw.type || "Trailer",
    };
    if (!isTrailerType(t)) continue;
    const prev = byKey.get(key);
    if (!prev || officialTrailerScore(t) > officialTrailerScore(prev)) {
      byKey.set(key, t);
    }
  }
  return Array.from(byKey.values()).sort(
    (a, b) => officialTrailerScore(b) - officialTrailerScore(a),
  );
}

/**
 * Single best official trailer for hero / Watch Trailer CTA.
 * Returns null if no Trailer-type video exists.
 */
export function pickOfficialTrailer(
  list: Trailer[] | null | undefined,
  fallback?: Trailer | null,
): Trailer | null {
  const pool = filterOfficialTrailers([
    ...(list ?? []),
    ...(fallback ? [fallback] : []),
  ]);
  // Prefer strictly official when available
  const official = pool.find((t) => t.official || /official/i.test(t.name));
  return official ?? pool[0] ?? null;
}

/**
 * Hero background video: prefer official Trailer, then any Trailer,
 * then official Teaser (many Asian dramas / anime only ship teasers on TMDB).
 * Never uses clips, featurettes, BTS, openings, or recaps.
 */
export function pickHeroTrailer(
  list: Trailer[] | null | undefined,
  fallback?: Trailer | null,
): Trailer | null {
  const primary = pickOfficialTrailer(list, fallback);
  if (primary) return primary;

  const raw = [...(list ?? []), ...(fallback ? [fallback] : [])];
  const teasers: Trailer[] = [];
  for (const item of raw) {
    if (!item?.key || item.site !== "youtube") continue;
    const key = item.key.trim();
    if (!isSelectableKey(key)) continue;
    const type = (item.type ?? "").trim().toLowerCase();
    const name = item.name ?? "";
    const isTeaser =
      type === "teaser" ||
      (/\bteaser\b/i.test(name) && !/\btrailer\b/i.test(name));
    if (!isTeaser) continue;
    teasers.push({
      ...item,
      key,
      id: item.id || `yt_${key}`,
      site: "youtube",
      name: name || "Official Teaser",
      official: Boolean(item.official || /official/i.test(name)),
      type: item.type || "Teaser",
    });
  }
  teasers.sort((a, b) => {
    const ao = a.official ? 1 : 0;
    const bo = b.official ? 1 : 0;
    return bo - ao;
  });
  return teasers[0] ?? null;
}

/**
 * If the stored content.trailer is not a Trailer-type video, drop it
 * so we never show clips/featurettes as the primary trailer.
 */
export function sanitizeContentTrailer<T extends { trailer?: Trailer | null }>(
  c: T,
): T {
  if (!c.trailer) return c;
  if (!isTrailerType(c.trailer) || !isSelectableKey(c.trailer.key)) {
    return { ...c, trailer: null };
  }
  const key = c.trailer.key.trim();
  return {
    ...c,
    trailer: {
      ...c.trailer,
      key,
      id: c.trailer.id || `yt_${key}`,
      site: "youtube",
      official: Boolean(
        c.trailer.official || /official/i.test(c.trailer.name ?? ""),
      ),
      type: c.trailer.type || "Trailer",
      name: c.trailer.name || "Official Trailer",
    },
  };
}

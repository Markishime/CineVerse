import type { Content } from "@/types/content";
import { slugify } from "@/lib/utils";

export interface DedupeKey {
  tmdb?: number;
  anilist?: number;
  imdb?: string;
  titleYear?: string;
}

export function buildDedupeKey(item: {
  providerIds?: {
    tmdb?: number;
    anilist?: number;
    imdb?: string;
  };
  title?: string;
  year?: number | null;
}): DedupeKey {
  return {
    tmdb: item.providerIds?.tmdb,
    anilist: item.providerIds?.anilist,
    imdb: item.providerIds?.imdb,
    titleYear:
      item.title && item.year
        ? `${slugify(item.title)}:${item.year}`
        : item.title
          ? slugify(item.title)
          : undefined,
  };
}

/**
 * Deduplicate content by provider IDs first, then title+year.
 * Prefer higher popularity when merging conflicts.
 */
export function deduplicateContent(items: Content[]): Content[] {
  const byKey = new Map<string, Content>();

  for (const item of items) {
    const keys = collectKeys(item);
    let existing: Content | undefined;
    let existingKey: string | undefined;

    for (const key of keys) {
      const hit = byKey.get(key);
      if (hit) {
        // A title-only collision is NOT proof of the same title. Two distinct
        // works can share a slugified English title + year (remakes, generic
        // titles, or a foreign film whose TMDB English title matches a Western
        // one). If BOTH sides carry a provider id and those ids differ, they
        // are different titles — do not merge, or the wrong movie plays.
        if (isProviderConflict(item, hit)) {
          continue;
        }
        existing = hit;
        existingKey = key;
        break;
      }
    }

    if (!existing) {
      for (const key of keys) {
        // Never let a title-only key overwrite an entry already claimed by a
        // different title (keep the first — provider-keyed entries still win
        // via their own keys). This stops a later same-title film from
        // hijacking an earlier one's slot.
        if (!byKey.has(key)) {
          byKey.set(key, item);
        }
      }
      continue;
    }

    const winner =
      (item.popularity ?? 0) >= (existing.popularity ?? 0) ? item : existing;
    const merged = mergeContent(existing, item, winner);

    // Remove old key entries for existing
    for (const [k, v] of byKey.entries()) {
      if (v.id === existing.id || (existingKey && k === existingKey)) {
        byKey.delete(k);
      }
    }
    for (const key of collectKeys(merged)) {
      byKey.set(key, merged);
    }
  }

  // Unique by id
  const byId = new Map<string, Content>();
  for (const item of byKey.values()) {
    const prev = byId.get(item.id);
    if (!prev || (item.popularity ?? 0) > (prev.popularity ?? 0)) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values());
}

/**
 * True when two items each carry a strong provider id and those ids prove they
 * are DIFFERENT works — so a shared title/year key must NOT merge them.
 *
 * - Different TMDB ids of the same media type → different titles.
 * - Different AniList ids → different titles.
 * - Different IMDb ids → different titles.
 * If neither side has a comparable id, we can't prove a conflict (allow merge).
 */
function isProviderConflict(a: Content, b: Content): boolean {
  const at = a.providerIds?.tmdb;
  const bt = b.providerIds?.tmdb;
  if (at != null && bt != null) {
    const am = a.providerIds?.tmdbMediaType ?? "any";
    const bm = b.providerIds?.tmdbMediaType ?? "any";
    // Same media type but different id → definitely different titles.
    if (at !== bt && (am === bm || am === "any" || bm === "any")) return true;
  }
  const aa = a.providerIds?.anilist;
  const ba = b.providerIds?.anilist;
  if (aa != null && ba != null && aa !== ba) return true;

  const ai = a.providerIds?.imdb;
  const bi = b.providerIds?.imdb;
  if (ai && bi && ai !== bi) return true;

  // Different content types with different provider identity aren't the same.
  if (a.contentType !== b.contentType && (at ?? aa) !== (bt ?? ba)) {
    if ((at != null || aa != null) && (bt != null || ba != null)) return true;
  }
  return false;
}

function collectKeys(item: Content): string[] {
  const keys: string[] = [];
  if (item.providerIds?.tmdb) {
    keys.push(`tmdb:${item.providerIds.tmdbMediaType ?? "any"}:${item.providerIds.tmdb}`);
  }
  if (item.providerIds?.anilist) {
    keys.push(`anilist:${item.providerIds.anilist}`);
  }
  if (item.providerIds?.imdb) {
    keys.push(`imdb:${item.providerIds.imdb}`);
  }
  if (item.title) {
    keys.push(
      `title:${slugify(item.title)}:${item.year ?? "x"}:${item.contentType}`,
    );
  }
  keys.push(`id:${item.id}`);
  return keys;
}

function isRemoteImage(
  img?: Content["poster"] | null,
): boolean {
  const u = img?.url;
  return Boolean(u && /^https?:\/\//i.test(u) && !u.includes("placehold.co"));
}

function pickBetterImage(
  preferred?: Content["poster"] | null,
  other?: Content["poster"] | null,
): Content["poster"] | null | undefined {
  if (isRemoteImage(preferred)) return preferred;
  if (isRemoteImage(other)) return other;
  return preferred ?? other ?? null;
}

function mergeContent(a: Content, b: Content, preferred: Content): Content {
  const other = preferred.id === a.id ? b : a;
  return {
    ...other,
    ...preferred,
    providerIds: { ...other.providerIds, ...preferred.providerIds },
    alternateTitles: Array.from(
      new Set([
        ...(preferred.alternateTitles ?? []),
        ...(other.alternateTitles ?? []),
        other.title,
        preferred.title,
      ].filter(Boolean) as string[]),
    ),
    genres:
      preferred.genres.length > 0 ? preferred.genres : other.genres,
    scores:
      preferred.scores.length > 0
        ? preferred.scores
        : other.scores,
    overview: preferred.overview || other.overview,
    // Prefer real remote art over missing/local SVG placeholders
    poster: pickBetterImage(preferred.poster, other.poster),
    backdrop: pickBetterImage(preferred.backdrop, other.backdrop),
    // Never drop a valid trailer during merge
    trailer: preferred.trailer ?? other.trailer ?? null,
    // Preserve popular/trending-today and other tags from both sides
    tags: Array.from(
      new Set([...(preferred.tags ?? []), ...(other.tags ?? [])]),
    ),
    popularity: Math.max(preferred.popularity ?? 0, other.popularity ?? 0),
  };
}

/**
 * Rank search results: exact title match first, then popularity.
 */
export function rankSearchResults(
  items: Content[],
  query: string,
): Content[] {
  const q = query.trim().toLowerCase();
  return [...items].sort((a, b) => {
    const aExact = isExactMatch(a, q) ? 1 : 0;
    const bExact = isExactMatch(b, q) ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;

    const aStarts = startsWithMatch(a, q) ? 1 : 0;
    const bStarts = startsWithMatch(b, q) ? 1 : 0;
    if (aStarts !== bStarts) return bStarts - aStarts;

    return (b.popularity ?? 0) - (a.popularity ?? 0);
  });
}

function allTitles(item: Content): string[] {
  return [
    item.title,
    item.originalTitle,
    item.englishTitle,
    item.romajiTitle,
    item.nativeTitle,
    ...(item.alternateTitles ?? []),
  ]
    .filter(Boolean)
    .map((t) => (t as string).toLowerCase());
}

function isExactMatch(item: Content, q: string): boolean {
  return allTitles(item).some((t) => t === q);
}

function startsWithMatch(item: Content, q: string): boolean {
  return allTitles(item).some((t) => t.startsWith(q));
}

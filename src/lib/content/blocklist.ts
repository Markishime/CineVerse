/**
 * Title blocklist — titles that are broken, non-working, or should never
 * appear in the catalog. Matched by slug substring, title substring, or
 * TMDB ID.
 */

interface BlocklistEntry {
  /** TMDB IDs to block (exact match) */
  tmdbIds?: number[];
  /** Slug substrings (case-insensitive contains) */
  slugPatterns?: string[];
  /** Title substrings (case-insensitive contains) */
  titlePatterns?: string[];
}

const BLOCKED: BlocklistEntry[] = [
  {
    tmdbIds: [],
    titlePatterns: [
      "affair at the nuns",
      "paradise sex",
      "nuns' temple",
      "nuns temple",
    ],
    slugPatterns: ["affair-at-the-nuns", "paradise-sex", "nuns-temple"],
  },
];

function matchesEntry(
  entry: BlocklistEntry,
  title: string,
  slug: string,
  tmdbId?: number,
): boolean {
  if (tmdbId && entry.tmdbIds?.includes(tmdbId)) return true;

  const slugLower = slug.toLowerCase();
  if (entry.slugPatterns?.some((p) => slugLower.includes(p.toLowerCase()))) {
    return true;
  }

  const titleLower = title.toLowerCase();
  if (entry.titlePatterns?.some((p) => titleLower.includes(p.toLowerCase()))) {
    return true;
  }

  return false;
}

export function isBlockedTitle(c: {
  title?: string;
  slug?: string;
  providerIds?: { tmdb?: number };
}): boolean {
  const title = c.title ?? "";
  const slug = c.slug ?? "";
  const tmdbId = c.providerIds?.tmdb;
  return BLOCKED.some((entry) => matchesEntry(entry, title, slug, tmdbId));
}

/** Filter out blocked titles from a content array. */
export function filterBlocked<T extends { title?: string; slug?: string; providerIds?: { tmdb?: number } }>(
  items: T[],
): T[] {
  return items.filter((c) => !isBlockedTitle(c));
}

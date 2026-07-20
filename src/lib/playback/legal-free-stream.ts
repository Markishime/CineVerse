/**
 * Legal free ad-supported streaming destinations.
 * Opens official platform search / JustWatch deep links — never pirate embeds.
 *
 * Primary: Tubi
 * Secondary: Pluto TV, Amazon Freevee
 */

import type { Content, WatchProvider } from "@/types/content";
import { displayTitle } from "@/lib/content/normalize";

export type FreeStreamPlatformId = "tubi" | "pluto" | "freevee";

export interface FreeStreamPlatform {
  id: FreeStreamPlatformId;
  name: string;
  shortName: string;
  /** TMDB / JustWatch provider ids (when present, content is listed free/ads there) */
  tmdbProviderIds: number[];
  nameMatch: RegExp;
  /** Official search URL builder */
  searchUrl: (title: string, year?: number | null) => string;
  /** Home / browse fallback */
  homeUrl: string;
  /** Accent for CTA (Tailwind-friendly hex) */
  accent: string;
  priority: number;
}

/** Known TMDB watch-provider ids (US catalog; names also matched). */
export const LEGAL_FREE_PLATFORMS: FreeStreamPlatform[] = [
  {
    id: "tubi",
    name: "Tubi",
    shortName: "Tubi",
    tmdbProviderIds: [73],
    nameMatch: /\btubi\b/i,
    searchUrl: (title, year) => {
      const q = [title, year].filter(Boolean).join(" ");
      return `https://tubitv.com/search/${encodeURIComponent(q)}`;
    },
    homeUrl: "https://tubitv.com/",
    accent: "#fa382f",
    priority: 1,
  },
  {
    id: "pluto",
    name: "Pluto TV",
    shortName: "Pluto",
    tmdbProviderIds: [300],
    nameMatch: /\bpluto\s*tv\b|\bpluto\b/i,
    searchUrl: (title, year) => {
      const q = [title, year].filter(Boolean).join(" ");
      // Official on-site search
      return `https://pluto.tv/search/details/${encodeURIComponent(q)}`;
    },
    homeUrl: "https://pluto.tv/",
    accent: "#fff200",
    priority: 2,
  },
  {
    id: "freevee",
    name: "Amazon Freevee",
    shortName: "Freevee",
    // Freevee / IMDb TV variants on TMDB
    tmdbProviderIds: [613, 1825, 2100],
    nameMatch: /\bfreevee\b|\bimdb\s*tv\b/i,
    searchUrl: (title, year) => {
      const q = [title, year, "freevee"].filter(Boolean).join(" ");
      return `https://www.amazon.com/s?k=${encodeURIComponent(q)}&i=instant-video`;
    },
    homeUrl: "https://www.amazon.com/gp/video/storefront",
    accent: "#00a8e1",
    priority: 3,
  },
];

export interface FreeStreamLink {
  platform: FreeStreamPlatform;
  /** Official outbound URL (new tab) */
  href: string;
  /** TMDB listed this title as free/ads on the platform */
  confirmedOnTmdb: boolean;
  /** Label for primary CTA */
  ctaLabel: string;
}

function normalizeTitle(title: string): string {
  return title
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build Tubi / Pluto / Freevee legal links for a title.
 * Prefer TMDB free/ads provider matches; always offer search fallbacks.
 */
export function buildLegalFreeStreamLinks(opts: {
  title: string;
  year?: number | null;
  contentType?: Content["contentType"];
  providers?: WatchProvider[] | null;
}): FreeStreamLink[] {
  const title = normalizeTitle(opts.title);
  const year = opts.year ?? null;
  const providers = opts.providers ?? [];

  // Free / ads / flatrate that are free AVOD platforms
  const freeish = providers.filter(
    (p) => p.type === "free" || p.type === "ads" || p.type === "flatrate",
  );

  return LEGAL_FREE_PLATFORMS.map((platform) => {
    const hit = freeish.find(
      (p) =>
        platform.tmdbProviderIds.includes(p.id) ||
        platform.nameMatch.test(p.name),
    );
    // Prefer JustWatch/TMDB deep link when present
    const href =
      hit?.link && hit.link.startsWith("http")
        ? hit.link
        : platform.searchUrl(title, year);

    const confirmedOnTmdb = Boolean(hit);
    const ctaLabel = confirmedOnTmdb
      ? `Watch free on ${platform.shortName}`
      : `Search ${platform.shortName}`;

    return {
      platform,
      href,
      confirmedOnTmdb,
      ctaLabel,
    };
  }).sort((a, b) => {
    // Confirmed first, then platform priority (Tubi first)
    if (a.confirmedOnTmdb !== b.confirmedOnTmdb) {
      return a.confirmedOnTmdb ? -1 : 1;
    }
    return a.platform.priority - b.platform.priority;
  });
}

/** Convenience from full Content + providers list */
export function freeStreamLinksForContent(
  content: Pick<Content, "title" | "englishTitle" | "year" | "contentType" | "watchProviders">,
  providers?: WatchProvider[] | null,
): FreeStreamLink[] {
  const title =
    content.englishTitle?.trim() ||
    displayTitle(content as Content) ||
    content.title;
  return buildLegalFreeStreamLinks({
    title,
    year: content.year,
    contentType: content.contentType,
    providers: providers ?? content.watchProviders ?? [],
  });
}

/** Primary Tubi search URL (always available). */
export function tubiSearchUrl(title: string, year?: number | null): string {
  const p = LEGAL_FREE_PLATFORMS.find((x) => x.id === "tubi")!;
  return p.searchUrl(normalizeTitle(title), year);
}

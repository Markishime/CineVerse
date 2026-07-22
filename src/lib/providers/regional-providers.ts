/**
 * Regional streaming platform registry.
 * Maps TMDB watch provider IDs to deep-link URLs for platforms
 * without public APIs. Deep links are the only integration method.
 */

import type { WatchProvider, RegionalPlatform } from "@/types/content";

/* ------------------------------------------------------------------ */
/*  TMDB Provider ID constants (from TMDB /watch/providers API)         */
/* ------------------------------------------------------------------ */

export const REGIONAL_PROVIDER_IDS: Record<string, number> = {
  Viki: 393,
  KOCOWA: 388,
  "iQIYI": 363,
  WeTV: 364,
  "iWantTFC": 365,
  "Viva One": 0, // No official TMDB provider ID — matched by name
};

/* ------------------------------------------------------------------ */
/*  Platform definitions                                               */
/* ------------------------------------------------------------------ */

export interface RegionalPlatformDef {
  name: string;
  slug: string;
  tmdbProviderId: number | null;
  tmdbProviderNames: string[];
  baseUrl: string;
  buildLink: (tmdbId: number, contentType: "movie" | "tv") => string;
}

export const REGIONAL_PLATFORMS: RegionalPlatformDef[] = [
  {
    name: "Viki",
    slug: "viki",
    tmdbProviderId: 393,
    tmdbProviderNames: ["Viki", "Rakuten Viki"],
    baseUrl: "https://www.viki.com",
    buildLink: (tmdbId, contentType) =>
      contentType === "tv"
        ? `https://www.viki.com/search?q=&type=show&tmdb=${tmdbId}`
        : `https://www.viki.com/search?q=&type=movie&tmdb=${tmdbId}`,
  },
  {
    name: "KOCOWA",
    slug: "kocowa",
    tmdbProviderId: 388,
    tmdbProviderNames: ["KOCOWA", "Kocowa"],
    baseUrl: "https://www.kocowa.com",
    buildLink: (tmdbId) => `https://www.kocowa.com/en/search?q=${tmdbId}`,
  },
  {
    name: "iQIYI",
    slug: "iqiyi",
    tmdbProviderId: 363,
    tmdbProviderNames: ["iQIYI", "iQiyi", "IQiyi"],
    baseUrl: "https://www.iq.com",
    buildLink: (tmdbId, contentType) =>
      contentType === "tv"
        ? `https://www.iq.com/search?query=${tmdbId}`
        : `https://www.iq.com/search?query=${tmdbId}`,
  },
  {
    name: "WeTV",
    slug: "wetv",
    tmdbProviderId: 364,
    tmdbProviderNames: ["WeTV", "Wetv"],
    baseUrl: "https://wetv.vip",
    buildLink: (tmdbId) => `https://wetv.vip/en/search?query=${tmdbId}`,
  },
  {
    name: "GMMTV",
    slug: "gmmtv",
    tmdbProviderId: null,
    tmdbProviderNames: ["GMMTV", "Gmmtv"],
    baseUrl: "https://www.youtube.com/@GMMTVOFFICIAL",
    buildLink: () => "https://www.youtube.com/@GMMTVOFFICIAL/videos",
  },
  {
    name: "iWantTFC",
    slug: "iwanttfc",
    tmdbProviderId: 365,
    tmdbProviderNames: ["iWantTFC", "iWant TFC", "IWANT TFC"],
    baseUrl: "https://www.iwanttfc.com",
    buildLink: (tmdbId) => `https://www.iwanttfc.com/search?q=${tmdbId}`,
  },
  {
    name: "Viva One",
    slug: "viva-one",
    tmdbProviderId: null,
    tmdbProviderNames: ["Viva One", "Viva+"],
    baseUrl: "https://www.viva.one",
    buildLink: (tmdbId) => `https://www.viva.one/search?q=${tmdbId}`,
  },
];

/* ------------------------------------------------------------------ */
/*  Matching logic                                                      */
/* ------------------------------------------------------------------ */

function normalizeProviderName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchesPlatform(
  wp: WatchProvider,
  platform: RegionalPlatformDef,
): boolean {
  const normalizedName = normalizeProviderName(wp.name);
  for (const candidate of platform.tmdbProviderNames) {
    if (normalizeProviderName(candidate) === normalizedName) return true;
  }
  if (platform.tmdbProviderId !== null && wp.id === platform.tmdbProviderId) {
    return true;
  }
  return false;
}

/**
 * Filter TMDB watch providers to regional platforms and build deep links.
 */
export function matchRegionalProviders(
  watchProviders: WatchProvider[],
  tmdbId: number,
  contentType: "movie" | "tv",
): RegionalPlatform[] {
  const matched: RegionalPlatform[] = [];

  for (const platform of REGIONAL_PLATFORMS) {
    const wp = watchProviders.find((p) => matchesPlatform(p, platform));
    if (wp) {
      matched.push({
        name: platform.name,
        slug: platform.slug,
        deepLink: platform.buildLink(tmdbId, contentType),
        type: wp.type,
        logoPath: wp.logoPath,
      });
    }
  }

  return matched;
}

/**
 * Get a specific regional platform by name or slug.
 */
export function getRegionalPlatform(
  nameOrSlug: string,
): RegionalPlatformDef | undefined {
  const normalized = normalizeProviderName(nameOrSlug);
  return REGIONAL_PLATFORMS.find(
    (p) =>
      normalizeProviderName(p.name) === normalized ||
      normalizeProviderName(p.slug) === normalized,
  );
}

/**
 * Build a deep link for a specific regional platform.
 */
export function getRegionalDeepLink(
  nameOrSlug: string,
  tmdbId: number,
  contentType: "movie" | "tv",
): string | null {
  const platform = getRegionalPlatform(nameOrSlug);
  if (!platform) return null;
  return platform.buildLink(tmdbId, contentType);
}

/**
 * Check if a TMDB watch provider name is a known regional platform.
 */
export function isRegionalProvider(name: string): boolean {
  const normalized = normalizeProviderName(name);
  return REGIONAL_PLATFORMS.some(
    (p) =>
      normalizeProviderName(p.name) === normalized ||
      p.tmdbProviderNames.some(
        (candidate) => normalizeProviderName(candidate) === normalized,
      ),
  );
}

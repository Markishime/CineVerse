/**
 * Regional platform enrichment orchestrator.
 * Takes content + TMDB watch providers and attaches deep links
 * for regional streaming platforms (Viki, KOCOWA, iQIYI, etc.)
 */

import type { Content, RegionalPlatform } from "@/types/content";
import { matchRegionalProviders } from "@/lib/providers/regional-providers";

/**
 * Enrich content with regional platform deep links.
 * Matches TMDB watch provider names against known regional platforms.
 */
export function enrichWithRegionalPlatforms(content: Content): RegionalPlatform[] {
  if (!content.watchProviders?.length) return [];
  if (!content.providerIds?.tmdb) return [];

  const contentType =
    content.contentType === "anime" ||
    content.contentType === "kdrama" ||
    content.contentType === "cdrama" ||
    content.contentType === "jdrama" ||
    content.contentType === "thaidrama"
      ? "tv"
      : content.contentType === "movie"
        ? "movie"
        : "tv";

  return matchRegionalProviders(
    content.watchProviders,
    content.providerIds.tmdb,
    contentType,
  );
}

/**
 * Batch-enrich a list of content items with regional platforms.
 * Returns a map of contentId → regional platforms.
 */
export function enrichBatchWithRegionalPlatforms(
  items: Content[],
): Map<string, RegionalPlatform[]> {
  const results = new Map<string, RegionalPlatform[]>();
  for (const item of items) {
    const platforms = enrichWithRegionalPlatforms(item);
    if (platforms.length > 0) {
      results.set(item.id, platforms);
    }
  }
  return results;
}

/**
 * Check if a content item has a specific regional platform available.
 */
export function hasRegionalPlatform(
  content: Content,
  platformName: string,
): boolean {
  if (!content.regionalPlatforms?.length) return false;
  return content.regionalPlatforms.some(
    (p) => p.name.toLowerCase() === platformName.toLowerCase(),
  );
}

/**
 * Get a specific regional platform deep link for content.
 */
export function getRegionalLink(
  content: Content,
  platformName: string,
): string | null {
  const platform = content.regionalPlatforms?.find(
    (p) => p.name.toLowerCase() === platformName.toLowerCase(),
  );
  return platform?.deepLink ?? null;
}

/**
 * Group regional platforms by access type for UI display.
 */
export function groupRegionalPlatforms(
  platforms: RegionalPlatform[],
): {
  free: RegionalPlatform[];
  subscription: RegionalPlatform[];
  rent: RegionalPlatform[];
  buy: RegionalPlatform[];
} {
  const grouped = {
    free: [] as RegionalPlatform[],
    subscription: [] as RegionalPlatform[],
    rent: [] as RegionalPlatform[],
    buy: [] as RegionalPlatform[],
  };

  for (const p of platforms) {
    switch (p.type) {
      case "free":
      case "ads":
        grouped.free.push(p);
        break;
      case "flatrate":
        grouped.subscription.push(p);
        break;
      case "rent":
        grouped.rent.push(p);
        break;
      case "buy":
        grouped.buy.push(p);
        break;
    }
  }

  return grouped;
}

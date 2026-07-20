import type { Content, Recommendation } from "@/types/content";

export interface RecommendationInput {
  catalog: Content[];
  favoriteGenres: string[];
  highlyRated: Content[];
  history: Content[];
  preferredTypes: Array<Content["contentType"]>;
  preferredLanguages: string[];
  preferredProviders: number[];
  excludeIds?: string[];
  limit?: number;
}

/**
 * Deterministic recommendation engine with diversity constraints.
 * Does not dominate by one franchise, genre, or language.
 */
export function buildRecommendations(
  input: RecommendationInput,
): Recommendation[] {
  const limit = input.limit ?? 20;
  const exclude = new Set(input.excludeIds ?? []);
  for (const h of input.history) exclude.add(h.id);
  for (const h of input.highlyRated) exclude.add(h.id);

  const scored: Recommendation[] = [];

  for (const item of input.catalog) {
    if (exclude.has(item.id)) continue;
    if (!item.approved) continue;

    let score = 0;
    const reasons: string[] = [];

    const genreNames = item.genres.map((g) => g.name.toLowerCase());
    const genreHits = genreNames.filter((g) =>
      input.favoriteGenres.map((x) => x.toLowerCase()).includes(g),
    );
    if (genreHits.length) {
      score += 30 * genreHits.length;
      reasons.push(`Matches your taste for ${genreHits[0]}`);
    }

    if (input.preferredTypes.includes(item.contentType)) {
      score += 15;
      reasons.push(`You watch a lot of ${item.contentType}`);
    }

    if (
      item.language &&
      input.preferredLanguages.includes(item.language)
    ) {
      score += 10;
      reasons.push("Preferred language");
    }

    if (input.preferredProviders.length) {
      const providerHit = item.watchProviders.some((p) =>
        input.preferredProviders.includes(p.id),
      );
      if (providerHit) {
        score += 12;
        reasons.push("Available on your services");
      }
    }

    // Similarity to highly rated titles
    for (const liked of input.highlyRated) {
      const shared = liked.genres.filter((g) =>
        genreNames.includes(g.name.toLowerCase()),
      ).length;
      if (shared > 0) {
        score += 8 * shared;
        reasons.push(`Because you rated ${liked.title} highly`);
        break;
      }
    }

    // Popularity / recency boosts
    score += Math.min(20, (item.popularity ?? 0) / 50);
    if (item.year && item.year >= new Date().getFullYear() - 1) {
      score += 5;
      reasons.push("Recent release");
    }

    const primary =
      item.scores.find((s) => s.source === "tmdb")?.score ??
      item.scores[0]?.score;
    if (primary && primary >= 7.5) {
      score += 8;
      reasons.push("Critically well-received");
    }

    if (score <= 0) continue;

    scored.push({
      content: item,
      score,
      reason: reasons[0] ?? "Popular in CineVerse",
    });
  }

  scored.sort((a, b) => b.score - a.score);

  // Diversity: max 2 per primary genre, max 3 per language, max 2 same franchise prefix
  const result: Recommendation[] = [];
  const genreCount = new Map<string, number>();
  const langCount = new Map<string, number>();
  const franchiseCount = new Map<string, number>();

  for (const rec of scored) {
    if (result.length >= limit) break;
    const primaryGenre =
      rec.content.genres[0]?.name.toLowerCase() ?? "unknown";
    const lang = rec.content.language ?? "unknown";
    const franchise = franchiseKey(rec.content.title);

    if ((genreCount.get(primaryGenre) ?? 0) >= 2) continue;
    if ((langCount.get(lang) ?? 0) >= 3) continue;
    if ((franchiseCount.get(franchise) ?? 0) >= 2) continue;

    result.push(rec);
    genreCount.set(primaryGenre, (genreCount.get(primaryGenre) ?? 0) + 1);
    langCount.set(lang, (langCount.get(lang) ?? 0) + 1);
    franchiseCount.set(franchise, (franchiseCount.get(franchise) ?? 0) + 1);
  }

  // Fill remaining without diversity if short
  if (result.length < limit) {
    for (const rec of scored) {
      if (result.length >= limit) break;
      if (result.some((r) => r.content.id === rec.content.id)) continue;
      result.push(rec);
    }
  }

  return result;
}

function franchiseKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/:.*$/, "")
    .replace(/\s+(part|season|volume|vol\.?|chapter)\s+\d+.*$/i, "")
    .replace(/[^\w\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join(" ");
}

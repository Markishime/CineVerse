/**
 * Instant home payload from seed — used when live providers hang/fail.
 * Safe for both server (API route) and client (placeholderData).
 */
import { SEED_CONTENT, SEED_GENRES, SEED_MOODS } from "@/data/seed-content";
import {
  applyMatureFlag,
  filterPublicCatalog,
  isMatureContent,
} from "@/lib/content/mature";
import { isGeneralSeriesOnly } from "@/lib/content/classification";
import type { HomePayload } from "@/lib/api/content";

export function seedHomePayload(): HomePayload {
  const safe = filterPublicCatalog(
    SEED_CONTENT.filter((c) => !isMatureContent(c)).map((c) =>
      applyMatureFlag(c),
    ),
  );
  const byPop = [...safe].sort(
    (a, b) => (b.popularity ?? 0) - (a.popularity ?? 0),
  );
  const movies = byPop.filter((c) => c.contentType === "movie").slice(0, 24);
  // Never mix anime / Asian dramas into the general Series row
  const series = byPop.filter(isGeneralSeriesOnly).slice(0, 24);
  // Prefer TV/OVA series for the home anime row (not theatrical films only).
  const animeAll = byPop.filter((c) => c.contentType === "anime");
  const animeSeries = animeAll.filter((c) => c.animeFormat !== "MOVIE");
  const anime =
    animeSeries.length > 0
      ? animeSeries.slice(0, 24)
      : animeAll.slice(0, 24);
  const kdrama = byPop.filter((c) => c.contentType === "kdrama").slice(0, 24);
  const featured = byPop.slice(0, 12);
  return {
    featured: featured[0] ?? null,
    featuredCarousel: featured,
    featuredUpdatedAt: new Date().toISOString(),
    region: "*",
    trending: byPop.slice(0, 36),
    popularMovies: movies,
    popularSeries: series,
    airingAnime: anime,
    trendingKdramas: kdrama,
    trendingCdramas: [],
    trendingJdramas: [],
    trendingThaidramas: [],
    koreanMovies: [],
    koreanSeries: [],
    japaneseMovies: [],
    japaneseSeries: [],
    chineseMovies: [],
    chineseSeries: [],
    thaiMovies: [],
    thaiSeries: [],
    filipinoMovies: [],
    filipinoSeries: [],
    newReleases: byPop.slice(0, 16),
    comingSoon: [],
    topRated: byPop.slice(0, 16),
    animeNextEpisode: [],
    freeLegal: byPop
      .filter(
        (c) =>
          c.tags?.includes("public-domain") || c.tags?.includes("free-stream"),
      )
      .slice(0, 16),
    matureMovies: [],
    matureSeries: [],
    matureAnime: [],
    matureKdramas: [],
    communityFavorites: byPop.slice(0, 12),
    editorial: featured.slice(0, 8),
    moods: SEED_MOODS,
    genres: SEED_GENRES,
    traktTrending: [],
    gmmtvDramas: [],
  };
}

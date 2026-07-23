import { SEED_CONTENT, SEED_GENRES, SEED_MOODS } from "@/data/seed-content";
import { catalog } from "@/lib/content/catalog-service";
import {
  applyMatureFlag,
  filterPublicCatalog,
  isMatureContent,
} from "@/lib/content/mature";
import { errorJson, json } from "@/lib/server/http";
import type { HomePayload } from "@/lib/api/content";
import { NextRequest } from "next/server";

function seedHomePayload(): HomePayload {
  const safe = filterPublicCatalog(
    SEED_CONTENT.filter((c) => !isMatureContent(c)).map((c) =>
      applyMatureFlag(c),
    ),
  );
  const byPop = [...safe].sort(
    (a, b) => (b.popularity ?? 0) - (a.popularity ?? 0),
  );
  const movies = byPop.filter((c) => c.contentType === "movie").slice(0, 24);
  const series = byPop.filter((c) => c.contentType === "series").slice(0, 24);
  const anime = byPop.filter((c) => c.contentType === "anime").slice(0, 24);
  const kdrama = byPop.filter((c) => c.contentType === "kdrama").slice(0, 24);
  const featured = byPop.slice(0, 12);
  return {
    featured: featured[0] ?? null,
    featuredCarousel: featured,
    featuredUpdatedAt: new Date().toISOString(),
    region: "US",
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
      .filter((c) => c.tags?.includes("public-domain") || c.tags?.includes("free-stream"))
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

export async function GET(request: NextRequest) {
  // US-only market for featured + catalog personalization
  const region = "US";
  const includeMature =
    request.nextUrl.searchParams.get("mature") === "1" ||
    request.nextUrl.searchParams.get("mature") === "true";
  try {
    // Absolute ceiling so Cloud Function cold starts + provider flakiness never
    // leave the client skeleton spinning forever.
    const payload = await Promise.race([
      catalog.home(region, includeMature),
      new Promise<HomePayload>((resolve) =>
        setTimeout(() => resolve(seedHomePayload()), 9_000),
      ),
    ]);
    return json(payload);
  } catch (err) {
    // Never 500 the home shell — seed is always better than a blank spinner.
    console.warn(
      "[api/v1/home] catalog.home failed; serving seed",
      err instanceof Error ? err.message : err,
    );
    try {
      return json(seedHomePayload());
    } catch {
      return errorJson("Home catalog temporarily unavailable", 503, {
        retryable: true,
      });
    }
  }
}

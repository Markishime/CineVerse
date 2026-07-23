import { seedHomePayload } from "@/lib/api/home-fallback";
import type { HomePayload } from "@/lib/api/content";
import { json } from "@/lib/server/http";
import { NextRequest } from "next/server";

/**
 * Home catalog API — must always return 200 quickly.
 *
 * Production was 500/503 because loading catalog-service + live providers
 * on cold start OOMs/timeouts the Cloud Function. We serve seed first, then
 * optionally upgrade from live catalog under a hard budget.
 */
export async function GET(request: NextRequest) {
  const includeMature =
    request.nextUrl.searchParams.get("mature") === "1" ||
    request.nextUrl.searchParams.get("mature") === "true";

  // Synchronous seed — no network, no heavy imports beyond this module tree.
  let seed: HomePayload;
  try {
    seed = seedHomePayload();
  } catch (err) {
    console.error("[api/v1/home] seedHomePayload failed", err);
    return json({
      featured: null,
      featuredCarousel: [],
      region: "*",
      trending: [],
      popularMovies: [],
      popularSeries: [],
      airingAnime: [],
      trendingKdramas: [],
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
      newReleases: [],
      comingSoon: [],
      topRated: [],
      animeNextEpisode: [],
      freeLegal: [],
      matureMovies: [],
      matureSeries: [],
      matureAnime: [],
      matureKdramas: [],
      communityFavorites: [],
      editorial: [],
      moods: [],
      genres: [],
      traktTrending: [],
      gmmtvDramas: [],
    } satisfies HomePayload);
  }

  // Optional live upgrade. Dynamic import so a broken provider module cannot
  // prevent seed from shipping. Client already shows seed via placeholderData,
  // so allow enough time for day-trending + trailer hydrate (was 2s → always seed).
  try {
    const live = await Promise.race([
      (async (): Promise<HomePayload | null> => {
        const { catalog } = await import("@/lib/content/catalog-service");
        // No forced US region — wildcard for global playback eligibility
        return await catalog.home("*", includeMature);
      })().catch((err) => {
        console.warn(
          "[api/v1/home] live catalog skipped",
          err instanceof Error ? err.message : err,
        );
        return null;
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 12_000)),
    ]);
    if (live) return json(live);
  } catch (err) {
    console.warn(
      "[api/v1/home] live race failed",
      err instanceof Error ? err.message : err,
    );
  }

  return json(seed);
}

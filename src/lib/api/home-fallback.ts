/**
 * Instant home payload from seed — used when live providers hang/fail.
 * Safe for both server (API route) and client (placeholderData).
 *
 * Featured carousel mirrors live home: interleaved movies · series · anime ·
 * dramas. Every item gets a guaranteed poster (local SVG if seed art is fake).
 */
import { SEED_CONTENT, SEED_GENRES, SEED_MOODS } from "@/data/seed-content";
import {
  applyMatureFlag,
  filterPublicCatalog,
  isMatureContent,
} from "@/lib/content/mature";
import { isGeneralSeriesOnly } from "@/lib/content/classification";
import { isDramaType, type Content } from "@/types/content";
import type { HomePayload } from "@/lib/api/content";
import { ensureContentPoster } from "@/lib/content/posters";

function interleaveFeatured(
  movies: Content[],
  series: Content[],
  anime: Content[],
  dramas: Content[],
  n = 12,
): Content[] {
  const out: Content[] = [];
  const seen = new Set<string>();
  const push = (c?: Content) => {
    if (!c?.id || seen.has(c.id)) return;
    seen.add(c.id);
    out.push(c);
  };
  const max = Math.max(
    movies.length,
    series.length,
    anime.length,
    dramas.length,
  );
  for (let i = 0; i < max && out.length < n; i++) {
    push(movies[i]);
    if (out.length >= n) break;
    push(series[i]);
    if (out.length >= n) break;
    push(anime[i]);
    if (out.length >= n) break;
    push(dramas[i]);
  }
  return out;
}

function withPosters(list: Content[]): Content[] {
  return list.map((c) => ensureContentPoster(c));
}

export function seedHomePayload(): HomePayload {
  const safe = filterPublicCatalog(
    SEED_CONTENT.filter((c) => !isMatureContent(c)).map((c) =>
      applyMatureFlag(c),
    ),
  ).map((c) => ensureContentPoster(c));

  const byPop = [...safe].sort(
    (a, b) => (b.popularity ?? 0) - (a.popularity ?? 0),
  );
  const movies = byPop.filter((c) => c.contentType === "movie").slice(0, 24);
  const series = byPop.filter(isGeneralSeriesOnly).slice(0, 24);
  const animeAll = byPop.filter((c) => c.contentType === "anime");
  const animeSeries = animeAll.filter((c) => c.animeFormat !== "MOVIE");
  const anime =
    animeSeries.length > 0
      ? animeSeries.slice(0, 24)
      : animeAll.slice(0, 24);

  const kdrama = byPop.filter((c) => c.contentType === "kdrama").slice(0, 24);
  const cdrama = byPop.filter((c) => c.contentType === "cdrama").slice(0, 24);
  const jdrama = byPop.filter((c) => c.contentType === "jdrama").slice(0, 24);
  const thaidrama = byPop
    .filter((c) => c.contentType === "thaidrama")
    .slice(0, 24);
  // Filipino dramas are modeled as series with PH origin / Tagalog
  const filipinoDramas = byPop
    .filter(
      (c) =>
        (c.contentType === "series" || isDramaType(c.contentType)) &&
        (c.language === "tl" ||
          c.countries?.some((cn) => cn.toUpperCase() === "PH")),
    )
    .slice(0, 24);

  const dramas = byPop
    .filter((c) => isDramaType(c.contentType))
    .slice(0, 24);

  const featured = withPosters(
    interleaveFeatured(movies, series, anime, dramas, 12),
  );

  return {
    featured: featured[0] ?? null,
    featuredCarousel: featured,
    featuredUpdatedAt: new Date().toISOString(),
    region: "*",
    trending: withPosters(
      (() => {
        const head = interleaveFeatured(movies, series, anime, dramas, 24);
        const ids = new Set(head.map((c) => c.id));
        const rest = byPop.filter((c) => !ids.has(c.id));
        return [...head, ...rest].slice(0, 36);
      })(),
    ),
    popularMovies: withPosters(movies),
    popularSeries: withPosters(series),
    airingAnime: withPosters(anime),
    trendingKdramas: withPosters(kdrama),
    trendingCdramas: withPosters(cdrama),
    trendingJdramas: withPosters(jdrama),
    trendingThaidramas: withPosters(thaidrama),
    koreanMovies: [],
    koreanSeries: [],
    japaneseMovies: [],
    japaneseSeries: [],
    chineseMovies: [],
    chineseSeries: [],
    thaiMovies: [],
    thaiSeries: [],
    filipinoMovies: [],
    filipinoSeries: withPosters(filipinoDramas),
    newReleases: withPosters(byPop.slice(0, 16)),
    comingSoon: [],
    topRated: withPosters(byPop.slice(0, 16)),
    animeNextEpisode: [],
    freeLegal: withPosters(
      byPop
        .filter(
          (c) =>
            c.tags?.includes("public-domain") ||
            c.tags?.includes("free-stream"),
        )
        .slice(0, 16),
    ),
    matureMovies: [],
    matureSeries: [],
    matureAnime: [],
    matureKdramas: [],
    communityFavorites: withPosters(byPop.slice(0, 12)),
    editorial: featured.slice(0, 8),
    moods: SEED_MOODS,
    genres: SEED_GENRES,
    traktTrending: [],
    gmmtvDramas: [],
  };
}

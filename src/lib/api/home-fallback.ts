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

function byPopSort(a: Content, b: Content) {
  return (b.popularity ?? 0) - (a.popularity ?? 0);
}

export function seedHomePayload(): HomePayload {
  const safe = filterPublicCatalog(
    SEED_CONTENT.filter((c) => !isMatureContent(c)).map((c) =>
      applyMatureFlag(c),
    ),
  ).map((c) => ensureContentPoster(c));

  const byPop = [...safe].sort(byPopSort);
  const movies = byPop.filter((c) => c.contentType === "movie");
  const series = byPop.filter(isGeneralSeriesOnly);
  const animeAll = byPop.filter((c) => c.contentType === "anime");
  const animeSeries = animeAll.filter((c) => c.animeFormat !== "MOVIE");
  const animeMovies = animeAll.filter((c) => c.animeFormat === "MOVIE");
  const anime = animeSeries.length > 0 ? animeSeries : animeAll;

  const kdrama = byPop.filter((c) => c.contentType === "kdrama");
  const cdrama = byPop.filter((c) => c.contentType === "cdrama");
  const jdrama = byPop.filter((c) => c.contentType === "jdrama");
  const thaidrama = byPop.filter((c) => c.contentType === "thaidrama");
  const filipinoDramas = byPop.filter(
    (c) =>
      (c.contentType === "series" || isDramaType(c.contentType)) &&
      (c.language === "tl" ||
        c.countries?.some((cn) => cn.toUpperCase() === "PH")),
  );

  const dramas = byPop.filter((c) => isDramaType(c.contentType));
  const allDramas = [
    ...kdrama,
    ...jdrama,
    ...cdrama,
    ...thaidrama,
    ...filipinoDramas,
  ].sort(byPopSort);

  const popularMovies = movies.slice(0, 48);
  const popularSeries = series.slice(0, 48);
  const popularAnime = anime.slice(0, 48);
  const popularDramas = allDramas.slice(0, 48);

  const featured = withPosters(
    interleaveFeatured(
      popularMovies,
      popularSeries,
      popularAnime,
      popularDramas,
      12,
    ),
  );

  const trending = withPosters(
    (() => {
      const head = interleaveFeatured(
        popularMovies,
        popularSeries,
        popularAnime,
        popularDramas,
        32,
      );
      const ids = new Set(head.map((c) => c.id));
      const rest = byPop.filter((c) => !ids.has(c.id));
      return [...head, ...rest].slice(0, 60);
    })(),
  );

  return {
    featured: featured[0] ?? null,
    featuredCarousel: featured,
    featuredUpdatedAt: new Date().toISOString(),
    region: "*",
    trending,
    popularMovies: withPosters(popularMovies),
    popularSeries: withPosters(popularSeries),
    airingAnime: withPosters(popularAnime),
    popularDramas: withPosters(popularDramas),
    trendingKdramas: withPosters(kdrama.slice(0, 48)),
    trendingCdramas: withPosters(cdrama.slice(0, 48)),
    trendingJdramas: withPosters(jdrama.slice(0, 48)),
    trendingThaidramas: withPosters(thaidrama.slice(0, 48)),
    allMovies: withPosters(movies.slice(0, 72)),
    allSeries: withPosters(series.slice(0, 72)),
    allAnime: withPosters(anime.slice(0, 72)),
    allDramas: withPosters(allDramas.slice(0, 72)),
    animeMovies: withPosters(animeMovies.slice(0, 48)),
    koreanMovies: [],
    koreanSeries: [],
    japaneseMovies: [],
    japaneseSeries: [],
    chineseMovies: [],
    chineseSeries: [],
    thaiMovies: [],
    thaiSeries: [],
    filipinoMovies: [],
    filipinoSeries: withPosters(filipinoDramas.slice(0, 48)),
    newReleases: withPosters(byPop.slice(0, 36)),
    comingSoon: [],
    topRated: withPosters(
      [...byPop]
        .sort(
          (a, b) =>
            (b.scores[0]?.score ?? 0) - (a.scores[0]?.score ?? 0),
        )
        .slice(0, 36),
    ),
    animeNextEpisode: [],
    freeLegal: withPosters(
      byPop
        .filter(
          (c) =>
            c.tags?.includes("public-domain") ||
            c.tags?.includes("free-stream"),
        )
        .slice(0, 36),
    ),
    matureMovies: [],
    matureSeries: [],
    matureAnime: [],
    matureKdramas: [],
    communityFavorites: withPosters(byPop.slice(0, 24)),
    editorial: featured.slice(0, 12),
    moods: SEED_MOODS,
    genres: SEED_GENRES,
    traktTrending: [],
    gmmtvDramas: [],
  };
}

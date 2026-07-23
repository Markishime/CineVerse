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
import {
  isAnimeLikeContent,
  isGeneralSeriesOnly,
} from "@/lib/content/classification";
import { isDramaType, type Content } from "@/types/content";
import type { HomePayload } from "@/lib/api/content";
import { ensureContentPoster } from "@/lib/content/posters";

/** Hero carousel only — movies · series · dramas (never anime). */
function interleaveHero(
  movies: Content[],
  series: Content[],
  dramas: Content[],
  n = 12,
): Content[] {
  const out: Content[] = [];
  const seen = new Set<string>();
  const push = (c?: Content) => {
    if (!c?.id || seen.has(c.id)) return;
    if (isAnimeLikeContent(c)) return;
    seen.add(c.id);
    out.push(c);
  };
  const max = Math.max(movies.length, series.length, dramas.length);
  for (let i = 0; i < max && out.length < n; i++) {
    push(movies[i]);
    if (out.length >= n) break;
    push(series[i]);
    if (out.length >= n) break;
    push(dramas[i]);
  }
  return out;
}

/** Catalog mix rows may still include anime. */
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
  // Live-action Japanese dramas only — never anime
  const jdrama = byPop.filter(
    (c) => c.contentType === "jdrama" && !isAnimeLikeContent(c),
  );
  const thaidrama = byPop.filter((c) => c.contentType === "thaidrama");
  const filipinoDramas = byPop.filter(
    (c) =>
      !isAnimeLikeContent(c) &&
      c.contentType !== "movie" &&
      c.contentType !== "anime" &&
      (c.language === "tl" ||
        c.countries?.some((cn) => cn.toUpperCase() === "PH")),
  );

  const thaiSeries = byPop.filter(
    (c) =>
      !isAnimeLikeContent(c) &&
      (c.contentType === "series" || c.contentType === "thaidrama") &&
      (c.language === "th" || c.countries?.some((cn) => cn === "TH")),
  );
  const japaneseSeries = byPop.filter(
    (c) =>
      !isAnimeLikeContent(c) &&
      (c.contentType === "series" || c.contentType === "jdrama") &&
      (c.language === "ja" || c.countries?.some((cn) => cn === "JP")),
  );
  const chineseSeries = byPop.filter(
    (c) =>
      !isAnimeLikeContent(c) &&
      (c.contentType === "series" || c.contentType === "cdrama") &&
      (c.language === "zh" ||
        c.countries?.some((cn) => ["CN", "TW", "HK"].includes(cn))),
  );
  const koreanSeries = byPop.filter(
    (c) =>
      !isAnimeLikeContent(c) &&
      (c.contentType === "series" || c.contentType === "kdrama") &&
      (c.language === "ko" || c.countries?.some((cn) => cn === "KR")),
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

  // Hero: no anime — movies · series · dramas only
  const featured = withPosters(
    interleaveHero(popularMovies, popularSeries, popularDramas, 12),
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

  const year = new Date().getFullYear();
  const newReleases = withPosters(
    [...byPop]
      .filter((c) => c.year && c.year >= year - 2)
      .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
      .slice(0, 36),
  );

  // Seed stand-in for Trakt when the live API is unavailable
  const traktTrending = withPosters(
    interleaveFeatured(
      popularMovies,
      popularSeries,
      popularAnime,
      popularDramas,
      24,
    ),
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
    koreanSeries: withPosters(koreanSeries.slice(0, 48)),
    japaneseMovies: [],
    japaneseSeries: withPosters(japaneseSeries.slice(0, 48)),
    chineseMovies: [],
    chineseSeries: withPosters(chineseSeries.slice(0, 48)),
    thaiMovies: [],
    thaiSeries: withPosters(thaiSeries.slice(0, 48)),
    filipinoMovies: [],
    filipinoSeries: withPosters(filipinoDramas.slice(0, 48)),
    newReleases,
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
    traktTrending,
    gmmtvDramas: [],
  };
}

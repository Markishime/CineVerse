import {
  SEED_CONTENT,
  SEED_GENRES,
  SEED_MOODS,
  searchSeed,
} from "@/data/seed-content";
import { buildRecommendations } from "@/lib/recommendations";
import { deduplicateContent, rankSearchResults } from "@/lib/content/dedupe";
import { filterBlocked, isBlockedTitle } from "@/lib/content/blocklist";
import {
  fetchAllAnimeLive,
  fetchAdultAnimeCatalog,
  fetchAnilistById,
  fetchAnilistAnime,
  fetchJikanCredits,
  fetchJikanTop,
  fetchTmdbCredits,
  fetchTmdbDetail,
  fetchTmdbKdrama,
  fetchTmdbDrama,
  fetchTmdbMature,
  fetchTmdbMovies,
  fetchTmdbMoviesByCountry,
  fetchTmdbSeriesByCountry,
  fetchTmdbSearch,
  fetchTmdbSeasonEpisodes,
  fetchTmdbSeasons,
  fetchTmdbSeries,
  fetchTmdbTrending,
  fetchTrendingTodayByType,
  fetchTmdbVideos,
  fetchTmdbWatchProviders,
  fetchTvMazeById,
  fetchTvMazeKdrama,
  fetchTvMazePopular,
  fetchTvMazeSearch,
  fetchTvMazeSeasons,
  fetchTvMazeSeasonEpisodes,
  resolveTvMazeShowId,
  fetchJikanEpisodes,
  resolveJikanMalId,
  resolveTmdbIdForTitle,
  fetchWorldMoviesPage,
  fetchWorldSeriesPage,
  fetchWorldDramaPage,
  fetchWorldAnimePage,
  hasTmdbAccess,
  LEGAL_FULL_PLAYBACK,
} from "@/lib/providers/live-catalog";
import {
  FREE_FULL_MOVIES,
  isFreeFullMovieId,
} from "@/lib/playback/free-movies";
import {
  FREE_FULL_SHOWS,
  findFreeShow,
  freeEpisodeId,
  isFreeShowId,
} from "@/lib/playback/free-shows";
import {
  filterOfficialTrailers,
  isValidYoutubeKey,
  pickOfficialTrailer,
  sanitizeContentTrailer,
} from "@/lib/content/trailers";
import {
  applyMatureFlag,
  filterAdultLibrary,
  filterByMatureFlag,
  filterPublicCatalog,
  isAccurateAdultAnime,
  isMatureContent,
} from "@/lib/content/mature";
import {
  fetchOmdbByImdbId,
  extractRatings,
} from "@/lib/providers/omdb-client";
import {
  fetchTraktTrendingShows,
  fetchTraktTrendingMovies,
} from "@/lib/providers/trakt-client";
import { enrichWithRegionalPlatforms } from "@/lib/content/regional-enrichment";
import { fetchGmmtvLatest, mapGmmtvVideo } from "@/lib/providers/gmmtv-youtube";
import type {
  Content,
  ContentType,
  Credit,
  DramaContentType,
  Episode,
  Recommendation,
  Season,
  Trailer,
  WatchProvider,
} from "@/types/content";
import { isDramaType } from "@/types/content";
import type { HomePayload, Paginated } from "@/lib/api/content";
import {
  cinematicBackdropUrl,
  cinematicPosterUrl,
  isValidImageUrl,
} from "@/lib/content/posters";

/** Catalog floor year — nothing older than this appears in browse catalogs */
export const MIN_CATALOG_YEAR = 1980;

function isAtLeastMinYear(c: Content): boolean {
  // Keep upcoming / unknown year; drop confirmed pre-1980 titles
  if (c.year == null || c.year === 0) return true;
  return c.year >= MIN_CATALOG_YEAR;
}

/**
 * Live catalog: multi-provider real-time sync with short cache TTL.
 */
export class CatalogService {
  private liveCache: { at: number; items: Content[] } | null = null;
  private detailCache = new Map<
    string,
    {
      at: number;
      content: Content;
      cast: Credit[];
      crew: Credit[];
      trailers: Trailer[];
    }
  >();
  /** Short TTL so homepage featured / catalog feel real-time */
  private readonly TTL = 90 * 1000;
  /** Keep serving a previous successful catalog while providers are down */
  private readonly STALE_TTL = 30 * 60 * 1000;
  private readonly DETAIL_TTL = 5 * 60 * 1000;
  /** Cap how long a cold catalog build may block the home API (Cloud Functions). */
  private readonly LOAD_BUDGET_MS = 6_000;

  private matureCache: { at: number; items: Content[] } | null = null;
  /** Single-flight: concurrent loadLive calls share one in-flight promise */
  private liveInflight: Promise<Content[]> | null = null;
  private matureInflight: Promise<Content[]> | null = null;

  async loadLive(includeMature = false): Promise<Content[]> {
    const cache = includeMature ? this.matureCache : this.liveCache;
    if (cache && Date.now() - cache.at < this.TTL) {
      return cache.items;
    }

    const inflight = includeMature ? this.matureInflight : this.liveInflight;
    if (inflight) return inflight;

    const run = this.buildLive(includeMature)
      .catch((err) => {
        // Prefer any still-fresh-enough stale catalog over empty/throwing.
        const stale = includeMature ? this.matureCache : this.liveCache;
        if (stale && Date.now() - stale.at < this.STALE_TTL) {
          return stale.items;
        }
        // Last resort: seed so the app never 500s on provider outages.
        console.warn(
          "[catalog] loadLive failed; serving seed catalog",
          err instanceof Error ? err.message : err,
        );
        const seed = includeMature
          ? SEED_CONTENT.map((c) => applyMatureFlag(c))
          : SEED_CONTENT.filter((c) => !isMatureContent(c)).map((c) =>
              applyMatureFlag(c),
            );
        return seed;
      })
      .finally(() => {
        if (includeMature) this.matureInflight = null;
        else this.liveInflight = null;
      });

    if (includeMature) this.matureInflight = run;
    else this.liveInflight = run;
    return run;
  }

  private async buildLive(includeMature = false): Promise<Content[]> {
    // Stale-while-revalidate: if we have a recent-enough catalog, return it
    // immediately while a background refresh would be ideal — for simplicity
    // we only re-enter buildLive when TTL expired, but still honor STALE_TTL
    // if the provider fan-out blows the budget.
    const prior = includeMature ? this.matureCache : this.liveCache;

    const COUNTRY_CODES = ["KR", "JP", "CN", "TH", "PH"] as const;

    const emptyToday = {
      movies: [] as Content[],
      series: [] as Content[],
      anime: [] as Content[],
      kdrama: [] as Content[],
    };

    const providers = Promise.all([
      fetchAllAnimeLive(includeMature).catch(() => [] as Content[]),
      includeMature
        ? fetchAdultAnimeCatalog().catch(() => [] as Content[])
        : Promise.resolve([] as Content[]),
      fetchJikanTop().catch(() => [] as Content[]),
      fetchTvMazePopular().catch(() => [] as Content[]),
      fetchTvMazeKdrama().catch(() => [] as Content[]),
      fetchTmdbDrama("cdrama", includeMature).catch(() => [] as Content[]),
      fetchTmdbDrama("jdrama", includeMature).catch(() => [] as Content[]),
      fetchTmdbDrama("thaidrama", includeMature).catch(() => [] as Content[]),
      fetchTmdbMovies().catch(() => [] as Content[]),
      fetchTmdbSeries().catch(() => [] as Content[]),
      fetchTmdbTrending().catch(() => [] as Content[]),
      fetchTmdbKdrama().catch(() => [] as Content[]),
      includeMature
        ? fetchTmdbMature().catch(() => [] as Content[])
        : Promise.resolve([] as Content[]),
      fetchTrendingTodayByType().catch(() => emptyToday),
      // Per-country movie catalogs (Korean / Japanese / Chinese / Thai / Filipino)
      Promise.all(
        COUNTRY_CODES.map((cc) =>
          fetchTmdbMoviesByCountry(cc, includeMature).catch(
            () => [] as Content[],
          ),
        ),
      ),
      // Per-country live-action series (anime excluded in the fetcher)
      Promise.all(
        COUNTRY_CODES.map((cc) =>
          fetchTmdbSeriesByCountry(cc).catch(() => [] as Content[]),
        ),
      ),
    ]);

    // If providers hang (e.g. undici connect timeout storms), fall back to
    // stale cache or seed instead of holding the request for 30s+.
    const budget = new Promise<"timeout">((resolve) => {
      setTimeout(() => resolve("timeout"), this.LOAD_BUDGET_MS);
    });
    const raced = await Promise.race([
      providers.then((v) => ({ kind: "ok" as const, v })),
      budget.then(() => ({ kind: "timeout" as const })),
    ]);

    if (raced.kind === "timeout") {
      if (prior && Date.now() - prior.at < this.STALE_TTL) {
        // Refresh cache timestamp so concurrent callers hit cache, not a new fan-out.
        if (includeMature) this.matureCache = { at: Date.now(), items: prior.items };
        else this.liveCache = { at: Date.now(), items: prior.items };
        void providers
          .then((v) => this.mergeAndCacheLive(includeMature, v))
          .catch(() => undefined);
        return prior.items;
      }
      const seed = includeMature
        ? SEED_CONTENT.map((c) => applyMatureFlag(c))
        : SEED_CONTENT.filter((c) => !isMatureContent(c)).map((c) =>
            applyMatureFlag(c),
          );
      // Degraded cache: avoid re-storming providers on every home hit.
      // Background merge overwrites with the full live catalog when ready.
      if (includeMature) this.matureCache = { at: Date.now(), items: seed };
      else this.liveCache = { at: Date.now(), items: seed };
      void providers
        .then((v) => this.mergeAndCacheLive(includeMature, v))
        .catch(() => undefined);
      return seed;
    }

    return this.mergeAndCacheLive(includeMature, raced.v);
  }

  private mergeAndCacheLive(
    includeMature: boolean,
    buckets: [
      Content[],
      Content[],
      Content[],
      Content[],
      Content[],
      Content[],
      Content[],
      Content[],
      Content[],
      Content[],
      Content[],
      Content[],
      Content[],
      {
        movies: Content[];
        series: Content[];
        anime: Content[];
        kdrama: Content[];
      },
      Content[][],
      Content[][],
    ],
  ): Content[] {
    const [
      animeAll,
      adultAnime,
      jikan,
      series,
      kdrama,
      cdrama,
      jdrama,
      thaidrama,
      tmdbMovies,
      tmdbSeries,
      tmdbTrend,
      tmdbKd,
      tmdbMature,
      todayBuckets,
      countryMovieBuckets,
      countrySeriesBuckets,
    ] = buckets;

    const countryMovies = countryMovieBuckets.flat();
    const countrySeries = countrySeriesBuckets.flat();

    // Free full movies + free series/anime/kdrama removed — too outdated
    const todayTrending = [
      ...todayBuckets.movies,
      ...todayBuckets.series,
      // Strip any accidental adult anime from safe day-trending
      ...todayBuckets.anime.filter((c) => !isAccurateAdultAnime(c)),
      ...todayBuckets.kdrama,
    ];

    // Seed first so known trailers (e.g. Attack on Titan) survive merge
    let merged = deduplicateContent([
      ...todayTrending,
      // When 18+ is off, never seed mature titles into the main catalog
      ...(includeMature
        ? SEED_CONTENT
        : SEED_CONTENT.filter((c) => !isMatureContent(c))),
      // Adult anime pack first when mature on (wins merge with correct tags)
      ...adultAnime,
      ...animeAll,
      ...jikan,
      ...series,
      ...kdrama,
      ...cdrama,
      ...jdrama,
      ...thaidrama,
      ...countryMovies,
      ...countrySeries,
      ...tmdbMovies,
      ...tmdbSeries,
      ...tmdbTrend,
      ...tmdbKd,
      ...tmdbMature,
    ])
      .map((c) =>
        sanitizeContentTrailer(ensurePoster(ensureKnownTrailers(c))),
      )
      .map((c) => applyMatureFlag(c))
      .map((c) => tagPlayable(c));

    // Hard gate: 18+ off → zero mature movies/series/anime/kdrama
    if (!includeMature) {
      merged = filterByMatureFlag(merged, false);
    }

    // Remove broken / non-working titles
    merged = filterBlocked(merged);

    // Nothing before 1980 in browse catalogs
    merged = merged.filter(isAtLeastMinYear);

    if (includeMature) {
      this.matureCache = { at: Date.now(), items: merged };
    } else {
      this.liveCache = { at: Date.now(), items: merged };
    }
    return merged;
  }

  async all(): Promise<Content[]> {
    return this.loadLive();
  }

  /**
   * Detail lookups always include the mature catalog so /mature and 18+ cards
   * resolve to /content/[slug] instead of "Title not found".
   */
  private async loadForDetail(): Promise<Content[]> {
    return this.loadLive(true);
  }

  async byId(id: string): Promise<Content | null> {
    const hydrated = await this.hydrate(id);
    if (hydrated) return hydrated.content;
    const all = await this.loadForDetail();
    const decoded = decodeURIComponent(id);
    return (
      all.find(
        (c) =>
          c.id === id ||
          c.slug === id ||
          c.id === decoded ||
          c.slug === decoded,
      ) ?? null
    );
  }

  async bySlug(slug: string): Promise<Content | null> {
    const decoded = decodeURIComponent(slug).trim();
    const all = await this.loadForDetail();
    const hit = all.find(
      (c) =>
        c.slug === decoded ||
        c.id === decoded ||
        c.slug === slug ||
        c.id === slug ||
        // Tolerate underscore/hyphen slug drift from providers
        c.slug?.replace(/_/g, "-") === decoded.replace(/_/g, "-"),
    );
    if (!hit) {
      // Last resort for partial / drifted links only — must stay EXACT so a
      // query never resolves to a different title (that plays the wrong movie).
      const soft = softMatchByIdentity(all, decoded);
      if (!soft) return null;
      const hydratedSoft = await this.hydrate(soft.id);
      return hydratedSoft?.content ?? soft;
    }
    const hydrated = await this.hydrate(hit.id);
    return hydrated?.content ?? hit;
  }

  /**
   * Pull full detail, cast/crew images, and all trailers from the source provider.
   */
  async hydrate(idOrSlug: string): Promise<{
    content: Content;
    cast: Credit[];
    crew: Credit[];
    trailers: Trailer[];
  } | null> {
    const decoded = decodeURIComponent(idOrSlug).trim();
    const all = await this.loadForDetail();
    const base =
      all.find(
        (c) =>
          c.id === idOrSlug ||
          c.slug === idOrSlug ||
          c.id === decoded ||
          c.slug === decoded,
      ) ??
      SEED_CONTENT.find(
        (c) =>
          c.id === idOrSlug ||
          c.slug === idOrSlug ||
          c.id === decoded ||
          c.slug === decoded,
      );
    if (!base) return null;

    const cached = this.detailCache.get(base.id);
    if (cached && Date.now() - cached.at < this.DETAIL_TTL) {
      return cached;
    }

    let content = sanitizeContentTrailer(base);
    let cast: Credit[] = [];
    let crew: Credit[] = [];
    // Start from official trailer only — never clips/featurettes
    let trailers: Trailer[] = filterOfficialTrailers(
      content.trailer ? [content.trailer] : [],
    );

    try {
      if (base.providerIds.anilist) {
        const a = await fetchAnilistById(base.providerIds.anilist);
        if (a.content) {
          content = sanitizeContentTrailer({
            ...content,
            ...a.content,
            id: base.id,
            slug: base.slug,
            // Never drop TMDb/mal ids from catalog merge when AniList omits them
            providerIds: {
              ...base.providerIds,
              ...content.providerIds,
              ...a.content.providerIds,
            },
            trailer: content.trailer ?? a.content.trailer,
          });
        }
        cast = a.cast;
        crew = a.crew;
        if (a.trailers.length) {
          trailers = mergeTrailers(trailers, a.trailers);
        }
      } else if (base.id.startsWith("jikan_") || base.providerIds.mal) {
        const mal =
          base.providerIds.mal ??
          Number(base.id.replace("jikan_", ""));
        if (Number.isFinite(mal) && mal > 0) {
          const j = await fetchJikanCredits(mal, base.id);
          cast = j.cast;
          crew = j.crew;
        }
      } else if (base.providerIds.tvmaze) {
        const t = await fetchTvMazeById(base.providerIds.tvmaze);
        if (t.content) {
          content = sanitizeContentTrailer({
            ...content,
            ...t.content,
            id: base.id,
            slug: base.slug,
            contentType: base.contentType,
            providerIds: {
              ...base.providerIds,
              ...content.providerIds,
              ...t.content.providerIds,
            },
            trailer: content.trailer ?? t.content.trailer,
          });
        }
        cast = t.cast;
        crew = t.crew;
      } else if (base.providerIds.tmdb && base.providerIds.tmdbMediaType) {
        const mt = base.providerIds.tmdbMediaType;
        const tid = base.providerIds.tmdb;
        const [detail, credits, videos] = await Promise.all([
          fetchTmdbDetail(mt, tid, base.contentType === "kdrama"),
          fetchTmdbCredits(mt, tid, base.id),
          fetchTmdbVideos(mt, tid),
        ]);
        const best = pickOfficialTrailer(videos, content.trailer);
        if (detail) {
          content = sanitizeContentTrailer({
            ...content,
            ...detail,
            id: base.id,
            slug: base.slug,
            contentType: base.contentType,
            trailer: best ?? detail.trailer ?? content.trailer,
          });
        }
        cast = credits.cast;
        crew = credits.crew;
        trailers = mergeTrailers(trailers, videos);
      } else if (base.id.startsWith("tmdb_movie_")) {
        const tid = Number(base.id.replace("tmdb_movie_", ""));
        const [detail, credits, videos] = await Promise.all([
          fetchTmdbDetail("movie", tid),
          fetchTmdbCredits("movie", tid, base.id),
          fetchTmdbVideos("movie", tid),
        ]);
        const best = pickOfficialTrailer(videos, content.trailer);
        if (detail) {
          content = sanitizeContentTrailer({
            ...content,
            ...detail,
            id: base.id,
            slug: base.slug,
            trailer: best ?? content.trailer ?? detail.trailer,
          });
        }
        cast = credits.cast;
        crew = credits.crew;
        trailers = mergeTrailers(trailers, videos);
      } else if (
        base.id.startsWith("tmdb_tv_") ||
        base.id.startsWith("tmdb_kdrama_") ||
        base.id.startsWith("tmdb_anime_")
      ) {
        const tid = Number(
          base.id
            .replace("tmdb_tv_", "")
            .replace("tmdb_kdrama_", "")
            .replace("tmdb_anime_", ""),
        );
        const [detail, credits, videos] = await Promise.all([
          fetchTmdbDetail("tv", tid, base.contentType === "kdrama"),
          fetchTmdbCredits("tv", tid, base.id),
          fetchTmdbVideos("tv", tid),
        ]);
        const best = pickOfficialTrailer(videos, content.trailer);
        if (detail) {
          content = sanitizeContentTrailer({
            ...content,
            ...detail,
            id: base.id,
            slug: base.slug,
            contentType: base.contentType,
            trailer: best ?? content.trailer ?? detail.trailer,
          });
        }
        cast = credits.cast;
        crew = credits.crew;
        trailers = mergeTrailers(trailers, videos);
      }
    } catch {
      // keep base
    }

    // Anime / series without TMDb cannot use the episode embed player.
    // Resolve once at hydrate so Watch Now matches Attack on Titan behavior.
    content = await this.ensureTmdbForEmbed(content);

    // Seed demo cast images when still empty
    if (cast.length === 0) {
      cast = demoCredits(content.id, "cast");
    }
    if (crew.length === 0) {
      crew = demoCredits(content.id, "crew");
    }

    content = ensurePoster(content);
    trailers = filterOfficialTrailers(trailers);
    const primary = pickOfficialTrailer(trailers, content.trailer);
    content = {
      ...content,
      trailer: primary,
    };

    // OMDb rating enrichment — adds IMDb, Rotten Tomatoes, Metacritic scores
    if (content.providerIds?.imdb || content.providerIds?.tmdb) {
      try {
        const omdbTitle = content.providerIds?.imdb
          ? await fetchOmdbByImdbId(content.providerIds.imdb)
          : null;
        if (omdbTitle) {
          const omdbRatings = extractRatings(omdbTitle);
          const existingSources = new Set(
            content.scores?.map((s) => s.source) ?? [],
          );
          const newScores = omdbRatings
            .filter((r) => !existingSources.has(r.source))
            .map((r) => ({
              source: r.source as "imdb" | "rotten_tomatoes" | "metacritic",
              score: r.score,
              count: r.count,
            }));
          if (newScores.length) {
            content = {
              ...content,
              scores: [...(content.scores ?? []), ...newScores],
              providerIds: {
                ...content.providerIds,
                omdb: content.providerIds?.omdb ?? omdbTitle.imdbID,
              },
            };
          }
        }
      } catch {
        // OMDb is enrichment-only — never block hydration
      }
    }

    // Regional platform deep-link enrichment
    const regionalPlatforms = enrichWithRegionalPlatforms(content);
    if (regionalPlatforms.length > 0) {
      content = { ...content, regionalPlatforms };
    }

    const payload = {
      at: Date.now(),
      content,
      cast,
      crew,
      trailers,
    };
    this.detailCache.set(base.id, payload);
    return payload;
  }

  /**
   * Attach a TMDb id when missing so Watch Now opens /watch/tv|movie embeds
   * instead of falling back to the official trailer player.
   */
  private async ensureTmdbForEmbed(content: Content): Promise<Content> {
    if (content.providerIds?.tmdb && Number.isFinite(content.providerIds.tmdb)) {
      // Ensure media type is set for correct movie vs TV routing
      if (!content.providerIds.tmdbMediaType) {
        const mediaType =
          content.contentType === "movie" || content.animeFormat === "MOVIE"
            ? ("movie" as const)
            : ("tv" as const);
        return {
          ...content,
          providerIds: {
            ...content.providerIds,
            tmdbMediaType: mediaType,
          },
        };
      }
      return content;
    }

    // Only resolve for titles that stream via episode/movie embeds
    if (
      content.contentType !== "anime" &&
      content.contentType !== "series" &&
      content.contentType !== "kdrama" &&
      content.contentType !== "movie"
    ) {
      return content;
    }

    try {
      const resolved = await resolveTmdbIdForTitle({
        title: content.title,
        year: content.year,
        preferMovie:
          content.contentType === "movie" || content.animeFormat === "MOVIE",
        // Anime must resolve to an animation TMDB entry, never its live-action
        // adaptation — otherwise the wrong (live-action) video would play.
        requireAnimation: content.contentType === "anime",
        alternateTitles: [
          content.englishTitle,
          content.romajiTitle,
          content.nativeTitle,
          content.originalTitle,
          ...(content.alternateTitles ?? []),
        ].filter(Boolean) as string[],
      });
      if (!resolved) return content;
      return {
        ...content,
        providerIds: {
          ...content.providerIds,
          tmdb: resolved.tmdb,
          tmdbMediaType: resolved.tmdbMediaType,
        },
      };
    } catch {
      return content;
    }
  }

  async byType(
    type: ContentType,
    page = 1,
    pageSize = 48,
    sort: CatalogSort = "popularity",
    includeMature = false,
    playableOnly = false,
    region = "US",
    country?: string,
    animeFormat?: "movie" | "series",
  ): Promise<Paginated<Content>> {
    const regionCode = (region || "US").toUpperCase();
    const { isTitlePlayable } = await import("@/lib/playback/playback-store");
    const size = Math.min(Math.max(pageSize, 1), 100);

    // Country-specific MOVIE catalogs (Korean/Japanese/Chinese/Thai/Filipino)
    // are 18+-gated in full: when the mature toggle is OFF, show nothing so the
    // /movies/{country} pages stay empty and their nav entries disappear.
    if (type === "movie" && country && !includeMature) {
      return { items: [], page: 1, totalPages: 1, total: 0 };
    }

    // Watch Now / free-only still uses the local playable catalog (not the full world index)
    if (!playableOnly) {
      const world = await this.loadWorldCatalogPage(
        type,
        page,
        size,
        sort,
        includeMature,
        country,
        animeFormat,
      );
      if (world) {
        // When a country filter was passed, TMDB already filtered via
        // with_origin_country — do NOT re-filter or valid results get dropped.
        // Public catalogs never mix 18+ — adult titles live only on /mature.
        const items = world.items
          .map((c) => applyMatureFlag(c))
          .map((c) => tagPlayable(c))
          .map((c) => applyRegionPlayable(c, regionCode, isTitlePlayable))
          .map((c) => sanitizeContentTrailer(ensurePoster(ensureKnownTrailers(c))))
          .filter((c) => !isMatureContent(c))
          .filter((c) => !isBlockedTitle(c))
          .filter(isAtLeastMinYear);

        return {
          items,
          page: world.page,
          totalPages: world.totalPages,
          total: world.total,
        };
      }
    }

    // Regular type catalogs stay family-safe; 18+ is only on the mature tab.
    const all = (await this.loadLive(false)).map((c) =>
      applyRegionPlayable(c, regionCode, isTitlePlayable),
    );
    let items = all
      .filter((c) => c.contentType === type)
      .filter((c) => !isMatureContent(c))
      .filter(isAtLeastMinYear);
    if (playableOnly) {
      items = items.filter((c) => c.playable);
    }
    // Country filter for country-specific catalog pages
    if (country) {
      const cc = country.toUpperCase();
      items = items.filter(
        (c) =>
          c.language?.toLowerCase() === cc.toLowerCase() ||
          c.countries?.some((cn) => cn.toUpperCase() === cc),
      );
    }
    // Anime films vs series split
    if (type === "anime" && animeFormat) {
      items = items.filter((c) =>
        animeFormat === "movie"
          ? c.animeFormat === "MOVIE"
          : c.animeFormat !== "MOVIE",
      );
    }
    items = sortContent(items, sort);
    return paginate(items, page, size);
  }

  /**
   * On-demand world catalog page from TMDB (movies/series/kdrama) or AniList (anime).
   * Powers Movies / Series / Anime / K-Drama browse with tens of thousands of titles.
   */
  private async loadWorldCatalogPage(
    type: ContentType,
    page: number,
    pageSize: number,
    sort: CatalogSort,
    includeMature: boolean,
    country?: string,
    animeFormat?: "movie" | "series",
  ): Promise<{
    items: Content[];
    page: number;
    totalPages: number;
    total: number;
  } | null> {
    try {
      if (type === "anime") {
        return await fetchWorldAnimePage(
          page,
          pageSize,
          sort,
          includeMature,
          animeFormat,
        );
      }
      if (!hasTmdbAccess()) return null;
      if (type === "movie") {
        return await fetchWorldMoviesPage(
          page,
          pageSize,
          sort,
          includeMature,
          country,
        );
      }
      if (type === "series") {
        return await fetchWorldSeriesPage(
          page,
          pageSize,
          sort,
          country,
          includeMature,
        );
      }
      if (isDramaType(type)) {
        return await fetchWorldDramaPage(
          type as DramaContentType,
          page,
          pageSize,
          sort,
          includeMature,
        );
      }
    } catch {
      return null;
    }
    return null;
  }

  async home(_region = "US", includeMature = false): Promise<HomePayload> {
    // US-only product market
    const regionCode = "US";
    const { isTitlePlayable } = await import("@/lib/playback/playback-store");

    // Home is always a public surface: strip every adults-only title so 18+
    // never appears in popular/trending/featured (even when the toggle is on).
    // Adult titles are served only from /api/v1/mature → 18+ tab.
    const raw = filterPublicCatalog(
      (await this.loadLive(includeMature)).map((c) => applyMatureFlag(c)),
    );
    const allWithRegion = raw.map((c) =>
      applyRegionPlayable(c, regionCode, isTitlePlayable),
    );

    // Country-origin MOVIES are still 18+-toggle-gated on the homepage (product
    // rule): when the mature toggle is OFF, drop them from every row. They are
    // not “adult library” titles — just hidden until the user opts into 18+.
    const isCountryOriginMovie = (c: Content) => {
      if (c.contentType !== "movie") return false;
      const lang = (c.language ?? "").toLowerCase();
      const langHit = ["ko", "ja", "zh", "th", "tl"].includes(lang);
      const countryHit =
        c.countries?.some((cn) =>
          ["KR", "JP", "CN", "TW", "HK", "TH", "PH"].includes(cn.toUpperCase()),
        ) ?? false;
      return langHit || countryHit;
    };
    const all = includeMature
      ? allWithRegion
      : allWithRegion.filter((c) => !isCountryOriginMovie(c));

    const allMovies = all.filter((c) => c.contentType === "movie");
    // General movies feeding the "Popular movies" row never include country
    // movies — those live only in their own (18+-gated) rows.
    const movies = allMovies.filter((c) => !isCountryOriginMovie(c));
    const series = all.filter((c) => c.contentType === "series");
    const anime = all.filter((c) => c.contentType === "anime");
    const kdrama = all.filter((c) => c.contentType === "kdrama");
    const cdrama = all.filter((c) => c.contentType === "cdrama");
    const jdrama = all.filter((c) => c.contentType === "jdrama");
    const thaidrama = all.filter((c) => c.contentType === "thaidrama");
    const byPop = (a: Content, b: Content) =>
      (b.popularity ?? 0) - (a.popularity ?? 0);

    const isToday = (c: Content) =>
      c.tags?.includes("trending-today") || c.tags?.includes("popular");

    /** Stable unique-by-id while preserving first occurrence order */
    const uniqueById = (list: Content[]): Content[] => {
      const seen = new Set<string>();
      const out: Content[] = [];
      for (const c of list) {
        if (!c?.id || seen.has(c.id)) continue;
        seen.add(c.id);
        out.push(c);
      }
      return out;
    };

    // Country movie rows appear ONLY when the 18+ toggle is on. When off, they
    // are empty so no Korean/Japanese/Chinese/Thai/Filipino movies show.
    const isKoreanMovie = (c: Content) =>
      c.contentType === "movie" &&
      (c.language === "ko" || c.countries?.some((cn) => cn === "KR"));
    const koreanMovies = includeMature
      ? uniqueById([...allMovies].filter(isKoreanMovie).sort(byPop))
      : [];
    const isJapaneseMovie = (c: Content) =>
      c.contentType === "movie" &&
      (c.language === "ja" || c.countries?.some((cn) => cn === "JP"));
    const japaneseMovies = includeMature
      ? uniqueById([...allMovies].filter(isJapaneseMovie).sort(byPop))
      : [];
    const isChineseMovie = (c: Content) =>
      c.contentType === "movie" &&
      (c.language === "zh" ||
        c.countries?.some((cn) => ["CN", "TW", "HK"].includes(cn)));
    const chineseMovies = includeMature
      ? uniqueById([...allMovies].filter(isChineseMovie).sort(byPop))
      : [];
    const isThaiMovie = (c: Content) =>
      c.contentType === "movie" &&
      (c.language === "th" || c.countries?.some((cn) => cn === "TH"));
    const thaiMovies = includeMature
      ? uniqueById([...allMovies].filter(isThaiMovie).sort(byPop))
      : [];
    const isFilipinoMovie = (c: Content) =>
      c.contentType === "movie" &&
      (c.language === "tl" || c.countries?.some((cn) => cn === "PH"));
    const filipinoMovies = includeMature
      ? uniqueById([...allMovies].filter(isFilipinoMovie).sort(byPop))
      : [];
    // Filipino series
    const isFilipinoSeries = (c: Content) =>
      c.contentType === "series" &&
      (c.language === "tl" || c.countries?.some((cn) => cn === "PH"));
    const filipinoSeries = uniqueById(
      [...series].filter(isFilipinoSeries).sort(byPop),
    );
    // Korean series (includes kdrama content type)
    const isKoreanSeries = (c: Content) =>
      (c.contentType === "series" || c.contentType === "kdrama") &&
      (c.language === "ko" || c.countries?.some((cn) => cn === "KR"));
    const koreanSeries = uniqueById(
      [...all].filter(isKoreanSeries).sort(byPop),
    );
    // Japanese series (includes jdrama content type)
    const isJapaneseSeries = (c: Content) =>
      (c.contentType === "series" || c.contentType === "jdrama") &&
      (c.language === "ja" || c.countries?.some((cn) => cn === "JP"));
    const japaneseSeries = uniqueById(
      [...all].filter(isJapaneseSeries).sort(byPop),
    );
    // Chinese series (includes cdrama content type)
    const isChineseSeries = (c: Content) =>
      (c.contentType === "series" || c.contentType === "cdrama") &&
      (c.language === "zh" || c.countries?.some((cn) => cn === "CN"));
    const chineseSeries = uniqueById(
      [...all].filter(isChineseSeries).sort(byPop),
    );
    // Thai series (includes thaidrama content type)
    const isThaiSeries = (c: Content) =>
      (c.contentType === "series" || c.contentType === "thaidrama") &&
      (c.language === "th" || c.countries?.some((cn) => cn === "TH"));
    const thaiSeries = uniqueById(
      [...all].filter(isThaiSeries).sort(byPop),
    );
    const topMovies = uniqueById([...movies].sort(byPop));
    const topSeries = uniqueById([...series].sort(byPop));
    const topAnime = uniqueById([...anime].sort(byPop));
    const topKdrama = uniqueById([...kdrama].sort(byPop));
    // Tag top cdrama/jdrama/thaidrama as trending-today so they appear in the
    // "Trending today" row alongside movies/series/anime/kdrama.
    const tagTopDramas = (list: Content[], boost: number): Content[] =>
      list.map((c, i) =>
        i < 20
          ? {
              ...c,
              tags: Array.from(
                new Set([...(c.tags ?? []), "trending-today", "popular"]),
              ),
              popularity: (c.popularity ?? 0) + boost,
            }
          : c,
      );
    const topCdrama = tagTopDramas(uniqueById([...cdrama].sort(byPop)), 38);
    const topJdrama = tagTopDramas(uniqueById([...jdrama].sort(byPop)), 37);
    const topThaidrama = tagTopDramas(
      uniqueById([...thaidrama].sort(byPop)),
      36,
    );

    // Popular & trending *today* only — never fill with random catalog/PD
    const todayOnly = (list: Content[], n: number) => {
      const today = uniqueById(list.filter(isToday).sort(byPop));
      if (today.length > 0) return today.slice(0, n);
      // Provider outage fallback: still prefer highest-pop of that type
      return list.slice(0, n);
    };

    const todayMovies = todayOnly(topMovies, 36);
    const todaySeries = todayOnly(topSeries, 36);
    const todayAnime = todayOnly(topAnime, 36);
    const todayKdrama = todayOnly(topKdrama, 36);
    const todayCdrama = todayOnly(topCdrama, 36);
    const todayJdrama = todayOnly(topJdrama, 36);
    const todayThaidrama = todayOnly(topThaidrama, 36);
    const todayKoreanMovies = todayOnly(koreanMovies, 36);
    const todayJapaneseMovies = todayOnly(japaneseMovies, 36);
    const todayChineseMovies = todayOnly(chineseMovies, 36);
    const todayThaiMovies = todayOnly(thaiMovies, 36);
    const todayFilipinoMovies = todayOnly(filipinoMovies, 36);
    const todayFilipinoSeries = todayOnly(filipinoSeries, 36);
    const todayKoreanSeries = todayOnly(koreanSeries, 36);
    const todayJapaneseSeries = todayOnly(japaneseSeries, 36);
    const todayChineseSeries = todayOnly(chineseSeries, 36);
    const todayThaiSeries = todayOnly(thaiSeries, 36);

    // Featured hero: balanced mix of today's movies · series · anime · kdrama
    const movieFeat = todayMovies.slice(0, 4);
    const seriesFeat = todaySeries.slice(0, 4);
    const animeFeat = todayAnime.slice(0, 4);
    const kdramaFeat = todayKdrama.slice(0, 4);

    const featuredPool: Content[] = [];
    const buckets = [movieFeat, seriesFeat, animeFeat, kdramaFeat];
    const maxLen = Math.max(...buckets.map((b) => b.length), 0);
    for (let i = 0; i < maxLen; i++) {
      for (const b of buckets) {
        if (b[i]) featuredPool.push(b[i]!);
      }
    }
    const slot = Math.floor(Date.now() / 60_000);
    const rotate = <T,>(arr: T[], s: number): T[] => {
      if (arr.length <= 1) return arr;
      const o = ((s % arr.length) + arr.length) % arr.length;
      return [...arr.slice(o), ...arr.slice(0, o)];
    };
    let featuredUnique = uniqueById(rotate(featuredPool, slot));

    // Trailer enrichment is best-effort — never block home for oEmbed/TMDB.
    featuredUnique = await Promise.race([
      enrichTrailersForFeatured(featuredUnique),
      new Promise<Content[]>((resolve) =>
        setTimeout(() => resolve(featuredUnique), 2_500),
      ),
    ]);

    // Prefer slides that actually have a playable YouTube trailer key
    const hasYt = (c: Content) =>
      c.trailer?.site === "youtube" && isValidYoutubeKey(c.trailer.key);
    const withTrailer = featuredUnique.filter(hasYt);
    const withoutTrailer = featuredUnique.filter((c) => !hasYt(c));
    featuredUnique = uniqueById([...withTrailer, ...withoutTrailer]).slice(
      0,
      16,
    );

    const year = new Date().getFullYear();
    const generatedAt = new Date().toISOString();

    // Trakt trending row — hard-capped so a flaky API cannot hang /home
    let traktTrending: Content[] = [];
    try {
      const [traktShows, traktMovies] = await Promise.race([
        Promise.all([
          fetchTraktTrendingShows(12),
          fetchTraktTrendingMovies(12),
        ]),
        new Promise<[[], []]>((resolve) =>
          setTimeout(() => resolve([[], []]), 2_000),
        ),
      ]);
      const traktItems: Content[] = [];
      for (const show of traktShows) {
        traktItems.push({
          id: `trakt_show_${show.ids.trakt}`,
          slug: show.ids.slug,
          contentType: "series",
          title: show.title,
          alternateTitles: [],
          overview: show.overview ?? "",
          year: show.year,
          status: show.status === "ended" ? "ended" : "released",
          countries: [],
          poster: show.images?.poster
            ? { url: show.images.poster, source: "local" }
            : undefined,
          backdrop: show.images?.fanart
            ? { url: show.images.fanart, source: "local" }
            : undefined,
          scores: show.rating
            ? [{ source: "trakt" as const, score: show.rating * 10, count: show.votes }]
            : [],
          genres: (show.genres ?? []).map((g) => ({
            id: g,
            name: g,
          })),
          watchProviders: [],
          regionalPlatforms: [],
          providerIds: {
            tmdb: show.ids.tmdb,
            trakt: show.ids.trakt,
          },
          tags: ["trakt-trending"],
          studios: show.network ? [show.network] : [],
          approved: true,
          mature: false,
          popularity: show.rating ?? 0,
          lastSyncedAt: generatedAt,
        });
      }
      for (const movie of traktMovies) {
        traktItems.push({
          id: `trakt_movie_${movie.ids.trakt}`,
          slug: movie.ids.slug,
          contentType: "movie",
          title: movie.title,
          alternateTitles: [],
          overview: movie.overview ?? "",
          year: movie.year,
          status: "released",
          countries: [],
          poster: movie.images?.poster
            ? { url: movie.images.poster, source: "local" }
            : undefined,
          backdrop: movie.images?.fanart
            ? { url: movie.images.fanart, source: "local" }
            : undefined,
          scores: movie.rating
            ? [{ source: "trakt" as const, score: movie.rating * 10, count: movie.votes }]
            : [],
          genres: (movie.genres ?? []).map((g) => ({
            id: g,
            name: g,
          })),
          watchProviders: [],
          regionalPlatforms: [],
          providerIds: {
            tmdb: movie.ids.tmdb,
            trakt: movie.ids.trakt,
          },
          tags: ["trakt-trending"],
          studios: [],
          approved: true,
          mature: false,
          popularity: movie.rating ?? 0,
          lastSyncedAt: generatedAt,
        });
      }
      traktTrending = uniqueById(traktItems).slice(0, 24);
    } catch {
      // Trakt trending is optional — homepage still works without it
    }

    // GMMTV free Thai dramas — hard-capped so RSS cannot hang /home
    let gmmtvDramas: Content[] = [];
    try {
      const gmmtvVideos = await Promise.race([
        fetchGmmtvLatest(20),
        new Promise<Awaited<ReturnType<typeof fetchGmmtvLatest>>>((resolve) =>
          setTimeout(() => resolve([]), 2_000),
        ),
      ]);
      gmmtvDramas = gmmtvVideos
        .map((v) => mapGmmtvVideo(v))
        .filter(Boolean)
        .map((partial) => ({
          id: `gmmtv_${partial!.slug}`,
          slug: partial!.slug ?? "gmmtv-unknown",
          contentType: "thaidrama" as const,
          title: partial!.title ?? "Untitled",
          alternateTitles: [],
          overview: partial!.overview ?? "",
          status: "released" as const,
          countries: ["TH"],
          language: "th",
          genres: [],
          scores: [],
          poster: partial!.poster,
          watchProviders: [],
          regionalPlatforms: [],
          providerIds: {},
          tags: ["gmmtv", "free"],
          studios: ["GMMTV"],
          approved: true,
          mature: false,
          popularity: 50,
          lastSyncedAt: generatedAt,
        })) as Content[];
    } catch {
      // GMMTV is optional
    }
    // Trending row = today's popular across all four types
    const rankedToday = uniqueById(
      [
        ...todayMovies,
        ...todaySeries,
        ...todayAnime,
        ...todayKdrama,
        ...todayCdrama,
        ...todayJdrama,
        ...todayThaidrama,
      ].sort(byPop),
    );

    return {
      featured: featuredUnique[0] ?? null,
      featuredCarousel: featuredUnique,
      featuredUpdatedAt: generatedAt,
      region: regionCode,
      trending: rankedToday.slice(0, 42),
      popularMovies: todayMovies,
      popularSeries: todaySeries,
      airingAnime: todayAnime,
      trendingKdramas: todayKdrama,
      trendingCdramas: todayCdrama,
      trendingJdramas: todayJdrama,
      trendingThaidramas: todayThaidrama,
      koreanMovies: todayKoreanMovies,
      koreanSeries: todayKoreanSeries,
      japaneseMovies: todayJapaneseMovies,
      japaneseSeries: todayJapaneseSeries,
      chineseMovies: todayChineseMovies,
      chineseSeries: todayChineseSeries,
      thaiMovies: todayThaiMovies,
      thaiSeries: todayThaiSeries,
      filipinoMovies: todayFilipinoMovies,
      filipinoSeries: todayFilipinoSeries,
      newReleases: uniqueById(
        [...all]
          .filter((c) => c.year && c.year >= year - 2)
          .sort((a, b) => (b.year ?? 0) - (a.year ?? 0)),
      ).slice(0, 20),
      comingSoon: uniqueById(
        all.filter((c) => c.status === "upcoming"),
      ).slice(0, 16),
      topRated: uniqueById(
        [...all].sort((a, b) => scoreOf(b) - scoreOf(a)),
      ).slice(0, 20),
      animeNextEpisode: uniqueById(
        anime.filter((a) => a.nextEpisodeAt),
      ).slice(0, 16),
      freeLegal: uniqueById(
        all.filter(
          (c) =>
            LEGAL_FULL_PLAYBACK[c.id] ||
            c.tags?.includes("free-stream") ||
            c.tags?.includes("public-domain") ||
            c.watchProviders.some((p) => p.type === "free"),
        ),
      ).slice(0, 24),
      // Intentionally empty on home — 18+ lives only on the Mature tab.
      matureMovies: [],
      matureSeries: [],
      matureAnime: [],
      matureKdramas: [],
      communityFavorites: rankedToday.slice(0, 18),
      editorial: featuredUnique.slice(0, 8),
      moods: SEED_MOODS,
      genres: SEED_GENRES,
      traktTrending,
      gmmtvDramas,
    };
  }

  /**
   * 18+ Mature library — the ONLY place adult-restricted titles appear.
   * Includes movies, series, anime, and dramas flagged adults-only (18+/R18/
   * NC-17/provider-adult/hentai/explicit). Requires mature toggle + PIN on the client.
   */
  async matureLibrary(
    page = 1,
    pageSize = 60,
    type?: ContentType | "all",
  ): Promise<Paginated<Content>> {
    const all = (await this.loadLive(true)).map((c) => applyMatureFlag(c));
    let items = filterAdultLibrary(all).filter(isAtLeastMinYear);
    if (type && type !== "all") {
      items = items.filter((c) => c.contentType === type);
    }
    items = sortContent(items, "popularity");
    return paginate(items, page, Math.min(pageSize, 100));
  }

  async search(params: {
    q: string;
    type?: string;
    page?: number;
    genre?: string;
    year?: number;
    language?: string;
    country?: string;
    status?: string;
    format?: string;
    /** When false (default), hide every 18+ title */
    includeMature?: boolean;
  }): Promise<Paginated<Content>> {
    const page = params.page ?? 1;
    const q = params.q?.trim() ?? "";
    const includeMature = Boolean(params.includeMature);

    let remote: Content[] = [];
    if (q.length >= 2) {
      const [anilist, anilist2, tvmaze, tmdb] = await Promise.all([
        fetchAnilistAnime({
          search: q,
          perPage: 50,
          page: 1,
          isAdult: includeMature ? undefined : false,
        }).catch(() => []),
        fetchAnilistAnime({
          search: q,
          perPage: 50,
          page: 2,
          isAdult: includeMature ? undefined : false,
        }).catch(() => []),
        fetchTvMazeSearch(q).catch(() => []),
        fetchTmdbSearch(q).catch(() => []),
      ]);
      remote = [...anilist, ...anilist2, ...tvmaze, ...tmdb].map((c) =>
        applyMatureFlag(c),
      );
    }

    const local = q
      ? searchSeed(q).map((c) => applyMatureFlag(c))
      : await this.loadLive(includeMature);
    let results = deduplicateContent([
      ...local,
      ...remote,
      ...(await this.loadLive(includeMature)),
    ]).map((c) => applyMatureFlag(c));

    // Public search never surfaces 18+ — mature titles only via /mature.
    results = filterPublicCatalog(results.map((c) => applyMatureFlag(c)));
    results = filterBlocked(results);
    results = results.filter(isAtLeastMinYear);

    if (q) {
      const ql = q.toLowerCase();
      results = results.filter((c) => {
        const fields = [
          c.title,
          c.originalTitle,
          c.englishTitle,
          c.romajiTitle,
          c.nativeTitle,
          ...(c.alternateTitles ?? []),
        ]
          .filter(Boolean)
          .map((s) => (s as string).toLowerCase());
        return fields.some((f) => f.includes(ql));
      });
    }

    if (params.type && params.type !== "all") {
      results = results.filter((c) => c.contentType === params.type);
    }
    if (params.genre) {
      const g = params.genre.toLowerCase();
      results = results.filter((c) =>
        c.genres.some((x) => x.name.toLowerCase().includes(g)),
      );
    }
    if (params.year) results = results.filter((c) => c.year === params.year);
    if (params.language)
      results = results.filter((c) => c.language === params.language);
    if (params.country) {
      results = results.filter((c) =>
        c.countries.includes(params.country!.toUpperCase()),
      );
    }
    if (params.status)
      results = results.filter((c) => c.status === params.status);
    if (params.format) {
      results = results.filter(
        (c) =>
          c.animeFormat?.toLowerCase() === params.format!.toLowerCase(),
      );
    }

    results = rankSearchResults(results, q);
    return paginate(results, page, 24);
  }

  async discover(
    params: Record<string, string | number | undefined>,
  ): Promise<Paginated<Content>> {
    const matureRaw = String(params.mature ?? "");
    const includeMature = matureRaw === "1" || matureRaw === "true";
    const mood = params.mood ? String(params.mood) : "";
    // Map mood → genre keywords when no explicit genre is set
    const moodGenres: Record<string, string> = {
      cozy: "comedy",
      thrill: "thriller",
      mindbend: "science fiction",
      romance: "romance",
      epic: "adventure",
      comfort: "family",
    };
    const genre =
      (params.genre ? String(params.genre) : undefined) ||
      (mood && moodGenres[mood] ? moodGenres[mood] : undefined);

    return this.search({
      q: String(params.q ?? ""),
      type: params.type ? String(params.type) : undefined,
      page: params.page ? Number(params.page) : 1,
      genre,
      year: params.year ? Number(params.year) : undefined,
      language: params.language ? String(params.language) : undefined,
      country: params.country ? String(params.country) : undefined,
      status: params.status ? String(params.status) : undefined,
      format: params.format ? String(params.format) : undefined,
      includeMature,
    });
  }

  async credits(contentId: string): Promise<{ cast: Credit[]; crew: Credit[] }> {
    const h = await this.hydrate(contentId);
    if (!h) return { cast: [], crew: [] };
    return { cast: h.cast, crew: h.crew };
  }

  async trailers(contentId: string): Promise<Trailer[]> {
    const h = await this.hydrate(contentId);
    if (!h) return [];
    // Official trailers only (movies · series · anime · kdrama)
    return filterOfficialTrailers(
      h.trailers.length
        ? h.trailers
        : h.content.trailer
          ? [h.content.trailer]
          : [],
    );
  }

  async providers(
    contentId: string,
    region = "US",
  ): Promise<{ providers: WatchProvider[]; region: string }> {
    const c = await this.byId(contentId);
    if (!c) return { providers: [], region };

    const tmdbId = c.providerIds.tmdb;
    const mediaType =
      c.providerIds.tmdbMediaType ??
      (c.contentType === "movie" ? "movie" : "tv");
    if (tmdbId && mediaType) {
      const live = await fetchTmdbWatchProviders(
        mediaType,
        tmdbId,
        region,
      ).catch(() => [] as WatchProvider[]);
      if (live.length) return { providers: live, region };
    }
    return { providers: c.watchProviders ?? [], region };
  }

  async recommendations(contentId: string): Promise<Recommendation[]> {
    const base = await this.byId(contentId);
    if (!base) return [];
    // Non-mature titles never get 18+ neighbors; mature titles may rec within adult set.
    const safeCatalog = isMatureContent(base)
      ? filterAdultLibrary(
          (await this.loadLive(true)).map((c) => applyMatureFlag(c)),
        )
      : filterPublicCatalog(
          (await this.loadLive(false)).map((c) => applyMatureFlag(c)),
        );
    return buildRecommendations({
      catalog: safeCatalog,
      favoriteGenres: base.genres.map((g) => g.name),
      highlyRated: [base],
      history: [base],
      preferredTypes: [base.contentType],
      preferredLanguages: base.language ? [base.language] : [],
      preferredProviders: [],
      excludeIds: [base.id],
      limit: 14,
    });
  }

  async seasons(contentId: string): Promise<Season[]> {
    const c = await this.byId(contentId);
    if (!c) return [];
    if (c.contentType === "movie") return [];

    // 0) Free full shows — seasons from free episode catalog
    const freeShow = findFreeShow(c.id) ?? findFreeShow(contentId);
    if (freeShow) {
      const seasonNums = Array.from(
        new Set(freeShow.episodes.map((e) => e.seasonNumber)),
      ).sort((a, b) => a - b);
      return seasonNums.map((n) => {
        const eps = freeShow.episodes.filter((e) => e.seasonNumber === n);
        return {
          id: `${freeShow.seedId}_s${n}`,
          contentId: freeShow.seedId,
          seasonNumber: n,
          name: `Season ${n}`,
          overview: freeShow.overview,
          poster: c.poster ?? null,
          airDate: `${freeShow.year}-01-01`,
          episodeCount: eps.length,
        };
      });
    }

    // 1) TMDB live seasons — series, anime, kdrama (all TV-shaped)
    const tmdbId = c.providerIds.tmdb;
    if (tmdbId) {
      const live = await fetchTmdbSeasons(tmdbId, c.id).catch(
        () => [] as Season[],
      );
      // Keep every regular season + specials with episodes (full, updated list)
      const usable = live
        .filter((s) => s.seasonNumber >= 0)
        .filter((s) => (s.episodeCount ?? 0) > 0 || s.seasonNumber > 0)
        .sort((a, b) => a.seasonNumber - b.seasonNumber);
      if (usable.length) return usable;
    }

    // 2) TVMaze (keyless) — series / kdrama / anime title search
    {
      let mazeId = c.providerIds.tvmaze ?? null;
      if (!mazeId) {
        mazeId =
          (await resolveTvMazeShowId(
            c.englishTitle || c.title || c.originalTitle || c.romajiTitle || "",
          ).catch(() => null)) ?? null;
      }
      if (mazeId) {
        const mazeSeasons = await fetchTvMazeSeasons(mazeId, c.id).catch(
          () => [] as Season[],
        );
        if (mazeSeasons.length) {
          return mazeSeasons
            .filter((s) => s.seasonNumber >= 0)
            .sort((a, b) => a.seasonNumber - b.seasonNumber);
        }
      }
    }

    // 3) Anime fallback: Jikan total episodes → Season 1 full list (or multi if seasonCount)
    if (c.contentType === "anime") {
      const epCount = c.episodeCount && c.episodeCount > 0 ? c.episodeCount : 0;
      const seasonCount =
        c.seasonCount && c.seasonCount > 0 ? Math.min(c.seasonCount, 50) : 1;
      return Array.from({ length: seasonCount }, (_, i) => ({
        id: `${c.id}_s${i + 1}`,
        contentId: c.id,
        seasonNumber: i + 1,
        name: seasonCount === 1 ? "Season 1" : `Season ${i + 1}`,
        overview: "",
        poster: c.poster ?? null,
        airDate: c.releaseDate ?? null,
        episodeCount:
          seasonCount === 1
            ? epCount || 12
            : Math.max(1, Math.ceil((epCount || 12) / seasonCount)),
      }));
    }

    // 4) Series / kdrama shell from catalog counts
    const count =
      c.seasonCount && c.seasonCount > 0 ? Math.min(c.seasonCount, 50) : 1;
    return Array.from({ length: count }, (_, i) => ({
      id: `${c.id}_s${i + 1}`,
      contentId: c.id,
      seasonNumber: i + 1,
      name: `Season ${i + 1}`,
      overview: "",
      poster: c.poster ?? null,
      airDate: c.releaseDate ?? null,
      episodeCount: c.episodeCount
        ? Math.ceil(c.episodeCount / Math.max(count, 1))
        : 12,
    }));
  }

  async episodes(seasonId: string): Promise<Episode[]> {
    const match = seasonId.match(/^(.*)_s(\d+)$/);
    if (!match) return [];
    const contentId = match[1]!;
    const seasonNumber = Number(match[2]);
    const c = await this.byId(contentId);
    if (!c) return [];

    // 0) Free full shows — real episode list + playable flags
    const freeShow = findFreeShow(c.id) ?? findFreeShow(contentId);
    if (freeShow) {
      return freeShow.episodes
        .filter((e) => e.seasonNumber === seasonNumber)
        .map((e) => ({
          id: freeEpisodeId(
            freeShow.seedId,
            e.seasonNumber,
            e.episodeNumber,
          ),
          contentId: freeShow.seedId,
          seasonId: `${freeShow.seedId}_s${seasonNumber}`,
          seasonNumber: e.seasonNumber,
          episodeNumber: e.episodeNumber,
          name: e.name,
          overview: e.overview ?? "",
          stillPath: null,
          airDate: `${freeShow.year}-01-01`,
          runtime: e.runtime ?? null,
          playable: true,
        }));
    }

    // 1) TMDB season episodes — series, anime, kdrama
    const tmdbId = c.providerIds.tmdb;
    if (tmdbId) {
      const live = await fetchTmdbSeasonEpisodes(
        tmdbId,
        seasonNumber,
        c.id,
      ).catch(() => [] as Episode[]);
      if (live.length) {
        const freeByTmdb = FREE_FULL_SHOWS.find((s) => s.tmdbId === tmdbId);
        if (freeByTmdb) {
          return live.map((e) => {
            const freeEp = freeByTmdb.episodes.find(
              (x) =>
                x.seasonNumber === e.seasonNumber &&
                x.episodeNumber === e.episodeNumber,
            );
            return {
              ...e,
              id: freeEp
                ? freeEpisodeId(
                    freeByTmdb.seedId,
                    e.seasonNumber,
                    e.episodeNumber,
                  )
                : e.id,
              contentId: freeByTmdb.seedId,
              playable: Boolean(freeEp),
            };
          });
        }
        return live.map((e) => ({ ...e, playable: false }));
      }
    }

    // 2) TVMaze episodes (keyless)
    {
      let mazeId = c.providerIds.tvmaze ?? null;
      if (!mazeId) {
        mazeId =
          (await resolveTvMazeShowId(
            c.englishTitle || c.title || c.originalTitle || c.romajiTitle || "",
          ).catch(() => null)) ?? null;
      }
      if (mazeId) {
        const mazeEps = await fetchTvMazeSeasonEpisodes(
          mazeId,
          seasonNumber,
          c.id,
        ).catch(() => [] as Episode[]);
        if (mazeEps.length) return mazeEps;
      }
    }

    // 3) Jikan episode titles for anime (keyless) — full list for season 1
    if (c.contentType === "anime") {
      let malId: number | null =
        c.providerIds.mal ??
        (c.id.startsWith("jikan_")
          ? Number(c.id.replace("jikan_", "")) || null
          : null);
      if (!malId) {
        malId =
          (await resolveJikanMalId(
            c.englishTitle || c.title || c.romajiTitle || "",
          ).catch(() => null)) ?? null;
      }
      if (malId) {
        const jikanEps = await fetchJikanEpisodes(
          malId,
          c.id,
          seasonNumber,
        ).catch(() => [] as Episode[]);
        if (jikanEps.length) return jikanEps;
      }
    }

    // 4) Honest empty — never invent fake "Episode N" rows
    return [];
  }

  /**
   * Annotate episodes with per-episode legal playability.
   * Never marks all episodes playable from a single title-level source.
   */
  async episodesWithPlayback(
    seasonId: string,
    region = "US",
  ): Promise<Array<Episode & { playable: boolean }>> {
    const eps = await this.episodes(seasonId);
    const match = seasonId.match(/^(.*)_s(\d+)$/);
    if (!match) return eps.map((e) => ({ ...e, playable: false }));
    const contentId = match[1]!;
    const { isEpisodePlayable } = await import(
      "@/lib/playback/resolve-playback"
    );
    return eps.map((e) => ({
      ...e,
      playable: isEpisodePlayable(contentId, {
        seasonNumber: e.seasonNumber,
        episodeNumber: e.episodeNumber,
        episodeId: e.id,
        region,
        aliases: [contentId],
      }),
    }));
  }

  async playback(contentId: string, region = "US") {
    const { resolvePlayback } = await import(
      "@/lib/playback/resolve-playback"
    );
    const { isTitlePlayable } = await import(
      "@/lib/playback/playback-store"
    );

    const c = await this.byId(contentId);
    if (!c) {
      return {
        eligible: false,
        playable: false,
        reason: "Content not found",
        trailer: null as Trailer | null,
        providers: [] as WatchProvider[],
        legalFull: null as null | {
          type: "archive" | "youtube" | "hls" | "mp4" | "vimeo" | "cloudflare";
          embedUrl: string;
          label: string;
          sourceType?: string;
          attributionText?: string;
          youtubeVideoId?: string;
          vimeoVideoId?: string;
          cloudflareVideoUid?: string;
          cloudflareCustomerCode?: string;
          cloudflareToken?: string;
        },
        resolved: null,
        watchLabel: "Not Available on CineVerse" as const,
        region,
        tmdbIsMetadataOnly: true,
      };
    }

    const trailers = await this.trailers(contentId);
    const aliases = [
      c.id,
      c.slug,
      c.providerIds.tmdb
        ? `tmdb_${c.providerIds.tmdbMediaType ?? "movie"}_${c.providerIds.tmdb}`
        : "",
    ].filter(Boolean);

    // Full feature only from verified rights records — never TMDB, never year heuristics alone
    const resolved = resolvePlayback({
      titleId: c.id,
      contentIdAliases: aliases,
      region,
      preferFull: true,
    });

    // Legacy seed map still valid only if rights record also exists (resolver includes seeds)
    let legalFull: {
      type: "archive" | "youtube" | "hls" | "mp4" | "vimeo" | "cloudflare";
      embedUrl: string;
      label: string;
      sourceType?: string;
      attributionText?: string;
      rightsHolder?: string;
      youtubeVideoId?: string;
      vimeoVideoId?: string;
      cloudflareVideoUid?: string;
      cloudflareCustomerCode?: string;
      cloudflareToken?: string;
      /** Free legal download when rights allow (PD / CC / owned) */
      downloadUrl?: string;
      downloadLabel?: string;
    } | null = null;

    const downloadFields = {
      downloadUrl: resolved.downloadUrl,
      downloadLabel: resolved.downloadLabel,
    };

    if (resolved.playable) {
      if (resolved.mode === "youtube_iframe" && resolved.youtubeVideoId) {
        legalFull = {
          type: "youtube",
          embedUrl: `https://www.youtube.com/embed/${resolved.youtubeVideoId}`,
          label: `Watch Now · official YouTube embed · ${resolved.providerName ?? "YouTube"}`,
          sourceType: resolved.sourceType,
          attributionText: resolved.attributionText,
          rightsHolder: resolved.rightsHolder,
          youtubeVideoId: resolved.youtubeVideoId,
          ...downloadFields,
        };
      } else if (resolved.mode === "vimeo_embed" && resolved.vimeoVideoId) {
        legalFull = {
          type: "vimeo",
          embedUrl: `https://player.vimeo.com/video/${resolved.vimeoVideoId}`,
          label: `Watch Now · licensed Vimeo · ${resolved.providerName ?? "Vimeo"}`,
          sourceType: resolved.sourceType,
          rightsHolder: resolved.rightsHolder,
          vimeoVideoId: resolved.vimeoVideoId,
          ...downloadFields,
        };
      } else if (
        (resolved.mode === "cloudflare_iframe" ||
          resolved.sourceType === "cloudflare_stream") &&
        resolved.cloudflareVideoUid
      ) {
        legalFull = {
          type: "cloudflare",
          embedUrl:
            resolved.signedUrl ??
            `https://customer-${resolved.cloudflareCustomerCode ?? "CODE"}.cloudflarestream.com/${resolved.cloudflareVideoUid}/iframe`,
          label: `Watch Now · Cloudflare Stream · ${resolved.providerName ?? "Stream"}`,
          sourceType: "cloudflare_stream",
          rightsHolder: resolved.rightsHolder,
          cloudflareVideoUid: resolved.cloudflareVideoUid,
          cloudflareCustomerCode: resolved.cloudflareCustomerCode,
          cloudflareToken: resolved.cloudflareToken,
          ...downloadFields,
        };
      } else if (resolved.signedUrl) {
        legalFull = {
          type:
            resolved.mode === "cineverse_hls"
              ? "hls"
              : resolved.signedUrl.includes("archive.org")
                ? "archive"
                : "mp4",
          embedUrl: resolved.signedUrl,
          label: `Watch Now · ${resolved.providerName ?? "CineVerse"}`,
          sourceType: resolved.sourceType,
          attributionText: resolved.attributionText,
          rightsHolder: resolved.rightsHolder,
          ...downloadFields,
        };
      }
    }

    const eligible = Boolean(resolved.playable && legalFull);
    const playableFlag =
      eligible || isTitlePlayable(c.id, region) || aliases.some((a) => isTitlePlayable(a, region));
    const hasTrailer = Boolean(
      trailers[0]?.key || c.trailer?.key,
    );
    const watchLabel = eligible
      ? ("Watch Now" as const)
      : hasTrailer
        ? ("Watch Trailer" as const)
        : ("Not Available on CineVerse" as const);

    return {
      eligible,
      playable: playableFlag && eligible,
      watchLabel,
      reason: eligible
        ? undefined
        : resolved.reason ??
          "Full playback isn’t available yet. Watch the official trailer or open a free legal service like Tubi.",
      trailer: trailers[0] ?? c.trailer,
      providers: c.watchProviders,
      legalFull,
      resolved,
      region,
      tmdbIsMetadataOnly: true,
    };
  }
}

/**
 * Strict soft-match for partial / drifted content links.
 *
 * Only resolves a query to a title when their IDENTITY matches exactly — never
 * a loose substring/suffix on free text (which could resolve to a different
 * title and play the wrong movie). Two safe strategies, in order:
 *
 *  1. Provider-id anchored: if the query embeds a provider id (e.g.
 *     `tmdb_movie_123`, `anilist_456`, or a slug ending in `-123`), match the
 *     item whose canonical id equals that exact provider-typed id.
 *  2. Exact slug-stem equality: compare both sides with the trailing `-{id}`
 *     suffix removed, requiring a full-string match of the title stem.
 */
export function softMatchByIdentity(
  all: Content[],
  decoded: string,
): Content | undefined {
  const q = decoded.trim();
  if (!q) return undefined;

  // 1) Provider-id anchored match. Pull a trailing/standalone numeric id and,
  //    when present, the provider prefix (tmdb_movie / tmdb_tv / anilist / …).
  const prefixed = q.match(
    /^(tmdb_(?:movie|tv|kdrama|cdrama|jdrama|thaidrama|anime)|jikan|anilist|tvmaze)_(\d+)$/i,
  );
  const trailingNum = q.match(/(?:^|[-_])(\d{2,})$/);
  const rawNum = /^\d{2,}$/.test(q) ? q : null;

  if (prefixed) {
    const wanted = `${prefixed[1]!.toLowerCase()}_${prefixed[2]!}`;
    const byExactId = all.find((c) => c.id.toLowerCase() === wanted);
    if (byExactId) return byExactId;
  }

  const numId = prefixed?.[2] ?? trailingNum?.[1] ?? rawNum;
  if (numId) {
    const n = Number(numId);
    const byProvider = all.find(
      (c) =>
        c.providerIds?.tmdb === n ||
        c.providerIds?.anilist === n ||
        c.providerIds?.mal === n ||
        c.providerIds?.tvmaze === n ||
        // id ends with exactly this number (e.g. anilist_456 for "456")
        new RegExp(`_${numId}$`).test(c.id),
    );
    if (byProvider) return byProvider;
  }

  // 2) Exact slug-stem equality (strip trailing `-{digits}` provider suffix).
  const stem = (s: string) => s.toLowerCase().replace(/-\d+$/, "");
  const qStem = stem(q);
  if (qStem.length >= 3) {
    const exactStem = all.find((c) => c.slug && stem(c.slug) === qStem);
    if (exactStem) return exactStem;
  }

  return undefined;
}

function freeMovieToContent(m: (typeof FREE_FULL_MOVIES)[number]): Content {
  return {
    id: m.seedId,
    slug: m.slug,
    contentType: "movie",
    title: m.title,
    originalTitle: m.originalTitle,
    overview: m.overview,
    poster: m.posterPath
      ? { url: m.posterPath, source: "tmdb" }
      : {
          url: cinematicPosterUrl(m.seedId, m.title, "movie"),
          source: "local",
        },
    backdrop: m.backdropPath
      ? { url: m.backdropPath, source: "tmdb" }
      : null,
    releaseDate: `${m.year}-01-01`,
    year: m.year,
    status: "released",
    language: "en",
    countries: ["US"],
    genres: m.genres.map((g) => ({
      id: g.toLowerCase().replace(/\W+/g, "-"),
      name: g,
    })),
    runtime: m.runtime ?? null,
    seasonCount: null,
    episodeCount: null,
    ageRating: m.ageRating ?? "NR",
    scores: [{ source: "cineverse", score: 7.5 }],
    popularity: 100 + (m.year > 1950 ? 10 : 20),
    trailer: null,
    watchProviders: [
      { id: 191, name: "Internet Archive", type: "free", logoPath: null },
    ],
    providerIds: m.tmdbId
      ? { tmdb: m.tmdbId, tmdbMediaType: "movie" }
      : {},
    studios: [],
    tags: ["public-domain", "free-stream", "watch-now"],
    alternateTitles: [],
    approved: true,
    mature: Boolean(m.mature),
    playable: true,
    lastSyncedAt: new Date().toISOString(),
  };
}

function freeShowToContent(s: (typeof FREE_FULL_SHOWS)[number]): Content {
  const seasons = new Set(s.episodes.map((e) => e.seasonNumber)).size;
  return {
    id: s.seedId,
    slug: s.slug,
    contentType: s.contentType,
    title: s.title,
    originalTitle: s.originalTitle,
    overview: s.overview,
    poster: s.posterPath
      ? { url: s.posterPath, source: "tmdb" }
      : {
          url: cinematicPosterUrl(s.seedId, s.title, s.contentType),
          source: "local",
        },
    backdrop: null,
    releaseDate: `${s.year}-01-01`,
    year: s.year,
    status: "ended",
    language: s.contentType === "kdrama" ? "ko" : "en",
    countries: s.contentType === "kdrama" ? ["KR"] : ["US"],
    genres: s.genres.map((g) => ({
      id: g.toLowerCase().replace(/\W+/g, "-"),
      name: g,
    })),
    runtime: s.episodes[0]?.runtime ?? 25,
    seasonCount: seasons,
    episodeCount: s.episodes.length,
    ageRating: s.mature ? "TV-MA" : "NR",
    scores: [{ source: "cineverse", score: 7.2 }],
    popularity: 110,
    trailer: null,
    watchProviders: [
      { id: 191, name: "Internet Archive", type: "free", logoPath: null },
    ],
    providerIds: s.tmdbId
      ? { tmdb: s.tmdbId, tmdbMediaType: "tv" }
      : {},
    studios: [],
    tags: ["public-domain", "free-stream", "watch-now"],
    alternateTitles: [],
    approved: true,
    mature: Boolean(s.mature),
    playable: true,
    lastSyncedAt: new Date().toISOString(),
  };
}

function applyRegionPlayable(
  c: Content,
  region: string,
  isTitlePlayable: (titleId: string, region?: string) => boolean,
): Content {
  const aliases = [
    c.id,
    c.slug,
    c.providerIds.tmdb
      ? `tmdb_${c.providerIds.tmdbMediaType ?? (c.contentType === "movie" ? "movie" : "tv")}_${c.providerIds.tmdb}`
      : "",
  ].filter(Boolean);
  const regionOk = aliases.some((id) => isTitlePlayable(id, region));
  // Keep catalog playable tags for free seeds; refine with region rights
  const playable =
    regionOk ||
    (Boolean(c.playable) &&
      (c.tags?.includes("free-stream") ||
        c.tags?.includes("public-domain") ||
        c.tags?.includes("watch-now")));
  return { ...c, playable };
}

/** Flag titles with verified legal full-playback sources for Watch Now UI */
function tagPlayable(c: Content): Content {
  if (c.playable) {
    return {
      ...c,
      tags: Array.from(
        new Set([...(c.tags ?? []), "watch-now", "free-stream"]),
      ),
    };
  }
  const tmdbId = c.providerIds.tmdb;
  const free =
    isFreeFullMovieId(c.id) ||
    isFreeShowId(c.id) ||
    Boolean(LEGAL_FULL_PLAYBACK[c.id]) ||
    Boolean(findFreeShow(c.id)) ||
    (c.contentType === "movie" &&
      tmdbId != null &&
      isFreeFullMovieId(`tmdb_movie_${tmdbId}`)) ||
    (c.contentType !== "movie" &&
      tmdbId != null &&
      isFreeShowId(`tmdb_tv_${tmdbId}`)) ||
    c.tags?.includes("free-stream") ||
    c.tags?.includes("public-domain") ||
    c.tags?.includes("watch-now");

  if (!free) return { ...c, playable: false };

  return {
    ...c,
    playable: true,
    tags: Array.from(
      new Set([...(c.tags ?? []), "watch-now", "free-stream", "public-domain"]),
    ),
    watchProviders:
      c.watchProviders?.some((p) => p.type === "free")
        ? c.watchProviders
        : [
            ...(c.watchProviders ?? []),
            {
              id: 191,
              name: "Internet Archive",
              type: "free" as const,
              logoPath: null,
            },
          ],
  };
}

/** @deprecated use applyMatureFlag from @/lib/content/mature */
function tagMatureFromRating(c: Content): Content {
  return applyMatureFlag(c);
}
// keep reference for any residual call sites
void tagMatureFromRating;

function ensurePoster(c: Content): Content {
  let next = c;
  if (!isValidImageUrl(c.poster?.url)) {
    next = {
      ...next,
      poster: {
        url: cinematicPosterUrl(c.id, c.title, c.contentType),
        source: "local",
      },
    };
  }
  if (!isValidImageUrl(c.backdrop?.url)) {
    next = {
      ...next,
      backdrop: {
        url: cinematicBackdropUrl(c.id, c.title),
        source: "local",
      },
    };
  }
  return next;
}

/** Quick check that a YouTube id is still public/embeddable (oEmbed). */
async function youtubeKeyLooksLive(key: string): Promise<boolean> {
  const k = key.trim();
  if (!isValidYoutubeKey(k)) return false;
  try {
    const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(
      `https://www.youtube.com/watch?v=${k}`,
    )}&format=json`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch(url, {
      method: "GET",
      signal: ctrl.signal,
      // no-store: a mid-stream abort must not throw at Next's fetch-cache layer
      // and 500 the home route.
      cache: "no-store",
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    // Network/oEmbed flake — keep the key; client still has poster/thumb fallback
    return true;
  }
}

/**
 * Attach official YouTube trailers for featured titles.
 * Official Trailer type only — never teaser/clip/featurette.
 */
async function enrichTrailersForFeatured(items: Content[]): Promise<Content[]> {
  const out = await Promise.all(
    items.map(async (c) => {
      const attachOfficial = async (t: Trailer): Promise<Content> => {
        const best = pickOfficialTrailer([t]);
        if (!best) return { ...c, trailer: null };
        const live = await youtubeKeyLooksLive(best.key);
        if (!live) return { ...c, trailer: null };
        return {
          ...c,
          trailer: {
            ...best,
            name: best.name || "Official Trailer",
            official: true,
            type: "Trailer",
          },
        };
      };

      // Already has official trailer
      const existing = pickOfficialTrailer(
        c.trailer ? [c.trailer] : [],
      );
      if (existing) {
        return attachOfficial(existing);
      }

      const tmdbId = c.providerIds.tmdb;
      const mediaType =
        c.providerIds.tmdbMediaType ??
        (c.contentType === "movie" ? "movie" : "tv");

      if (tmdbId) {
        try {
          // fetchTmdbVideos already returns official trailers only
          const videos = await fetchTmdbVideos(mediaType, tmdbId);
          const best = pickOfficialTrailer(videos);
          if (best) return attachOfficial(best);
        } catch {
          /* ignore */
        }
      }

      const known = sanitizeContentTrailer(ensureKnownTrailers(c));
      if (known.trailer) return attachOfficial(known.trailer);
      return { ...c, trailer: null };
    }),
  );
  return out;
}

/** Hard-coded embeddable trailers for popular titles when providers omit them */
const KNOWN_TRAILERS: Array<{
  match: RegExp;
  key: string;
  name: string;
}> = [
  {
    match: /attack on titan|shingeki no kyojin/i,
    key: "LHtdKWJdif4",
    name: "Attack on Titan Official Trailer",
  },
  {
    match: /^inception$/i,
    key: "YoHD9XEInc0",
    name: "Inception Official Trailer",
  },
  {
    match: /spirited away|sen to chihiro/i,
    key: "ByXuk9QqQkk",
    name: "Spirited Away Trailer",
  },
  {
    match: /cowboy bebop/i,
    key: "gY5nDXOtv_o",
    name: "Cowboy Bebop Opening",
  },
  {
    match: /fullmetal alchemist/i,
    key: "2uq34TeWEdQ",
    name: "FMA Brotherhood Trailer",
  },
  {
    match: /dark$/i,
    key: "rrwycJ08PSA",
    name: "Dark Trailer",
  },
  {
    match: /arrival/i,
    key: "tFMo3UJ4B4g",
    name: "Arrival Trailer",
  },
  {
    match: /crash landing on you/i,
    key: "GNRhW5T_5Vg",
    name: "Crash Landing on You Trailer",
  },
  {
    match: /goblin|lonely and great god/i,
    key: "S8_YwFLCh4U",
    name: "Goblin Trailer",
  },
];

function ensureKnownTrailers(c: Content): Content {
  if (c.trailer?.site === "youtube" && c.trailer.key) {
    const key = c.trailer.key.trim();
    if (key !== c.trailer.key) {
      return {
        ...c,
        trailer: { ...c.trailer, key, id: `yt_${key}` },
      };
    }
    return c;
  }
  const hay = `${c.title} ${c.englishTitle ?? ""} ${c.romajiTitle ?? ""} ${c.originalTitle ?? ""}`;
  const hit = KNOWN_TRAILERS.find((t) => t.match.test(hay));
  if (!hit) return c;
  return {
    ...c,
    trailer: {
      id: `yt_${hit.key}`,
      key: hit.key,
      site: "youtube",
      name: hit.name,
      official: true,
      type: "Trailer",
    },
  };
}

/** Merge + keep only official Trailer-type YouTube videos */
function mergeTrailers(a: Trailer[], b: Trailer[]): Trailer[] {
  return filterOfficialTrailers([...a, ...b]);
}

function demoCredits(
  contentId: string,
  kind: "cast" | "crew",
): Credit[] {
  // Prefer empty over fake faces — real images come from live providers
  void contentId;
  void kind;
  return [];
}

function paginate<T>(items: T[], page: number, pageSize: number): Paginated<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const p = Math.min(Math.max(1, page), totalPages);
  const start = (p - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: p,
    totalPages,
    total: items.length,
  };
}

function scoreOf(c: Content): number {
  return c.scores[0]?.score ?? 0;
}

export type CatalogSort =
  | "popularity"
  | "rating"
  | "newest"
  | "oldest"
  | "title_asc"
  | "title_desc"
  | "runtime";

export function sortContent(items: Content[], sort: CatalogSort): Content[] {
  const list = [...items];
  switch (sort) {
    case "rating":
      return list.sort((a, b) => scoreOf(b) - scoreOf(a));
    case "newest":
      return list.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    case "oldest":
      return list.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
    case "title_asc":
      return list.sort((a, b) => a.title.localeCompare(b.title));
    case "title_desc":
      return list.sort((a, b) => b.title.localeCompare(a.title));
    case "runtime":
      return list.sort((a, b) => (b.runtime ?? 0) - (a.runtime ?? 0));
    case "popularity":
    default:
      return list.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  }
}

export const catalog = new CatalogService();

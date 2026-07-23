/**
 * Live catalog providers (server-only).
 * Keyless: AniList, TVMaze, Jikan
 * Optional: TMDB_ACCESS_TOKEN for richer movies / K-drama / credits / trailers
 */
import { slugify } from "@/lib/utils";
import {
  classifyDrama,
  normalizeAnimeFormat,
} from "@/lib/content/classification";
import { filterOfficialTrailers } from "@/lib/content/trailers";
import type {
  Content,
  ContentType,
  Credit,
  DramaContentType,
  Episode,
  Season,
  Trailer,
  WatchProvider,
} from "@/types/content";
import { ContentSchema, DRAMA_META, isDramaType } from "@/types/content";

const ANILIST = "https://graphql.anilist.co";
const TVMAZE = "https://api.tvmaze.com";
const JIKAN = "https://api.jikan.moe/v4";
const TMDB = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p";

/**
 * Host-level circuit breaker so a flaky/unreachable provider (e.g. TVMaze
 * connect timeouts) does not fan out into dozens of 10s stalls and flood
 * the console. After `CIRCUIT_FAILS` consecutive failures we skip that host
 * for `CIRCUIT_COOLDOWN_MS`.
 */
const CIRCUIT_FAILS = 3;
const CIRCUIT_COOLDOWN_MS = 60_000;
const circuitOpenUntil = new Map<string, number>();
const circuitFailCount = new Map<string, number>();

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function isCircuitOpen(host: string): boolean {
  const until = circuitOpenUntil.get(host) ?? 0;
  return Date.now() < until;
}

function recordCircuitSuccess(host: string): void {
  circuitFailCount.set(host, 0);
  circuitOpenUntil.delete(host);
}

function recordCircuitFailure(host: string): void {
  const n = (circuitFailCount.get(host) ?? 0) + 1;
  circuitFailCount.set(host, n);
  if (n >= CIRCUIT_FAILS) {
    circuitOpenUntil.set(host, Date.now() + CIRCUIT_COOLDOWN_MS);
    circuitFailCount.set(host, 0);
  }
}

/** Bound parallel outbound calls so one dead host cannot saturate the event loop. */
async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  // Keep well under undici's default 10s connect timeout so a provider outage
  // fails fast instead of stacking multi-second stalls per request.
  timeoutMs = 5_000,
): Promise<T | null> {
  const host = hostOf(url);
  if (isCircuitOpen(host)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      // Bypass Next's fetch cache: when a slow provider (e.g. TVMaze) is aborted
      // mid-stream, Next throws "Failed to set fetch cache … terminated" which
      // bubbles up as a 500 on the whole route. We have our own in-memory
      // catalog cache, so the Next cache layer is unneeded here.
      cache: "no-store",
    });
    if (!res.ok) {
      // 5xx from the host counts toward the breaker; 4xx is a client miss.
      if (res.status >= 500) recordCircuitFailure(host);
      else recordCircuitSuccess(host);
      return null;
    }
    recordCircuitSuccess(host);
    return (await res.json()) as T;
  } catch {
    recordCircuitFailure(host);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** TVMaze-specific fetch: short timeout + shared circuit (api.tvmaze.com). */
async function fetchTvMazeJson<T>(
  path: string,
  timeoutMs = 3_000,
): Promise<T | null> {
  return fetchJson<T>(`${TVMAZE}${path}`, undefined, timeoutMs);
}

function posterFallback(title: string, _hue: number): string {
  // placehold.co is stable (no redirect chain) — always shows a poster image
  const t = encodeURIComponent((title || "CineVerse").slice(0, 28));
  return `https://placehold.co/500x750/111827/F8FAFF/png?text=${t}&font=montserrat`;
}

function safeParse(content: Content): Content | null {
  const r = ContentSchema.safeParse(content);
  return r.success ? r.data : null;
}

function tmdbPoster(path?: string | null, size = "w500"): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${TMDB_IMG}/${size}${path}`;
}

/* ─── AniList ─────────────────────────────────────────────── */

const ANIME_QUERY = `
query ($page: Int, $perPage: Int, $sort: [MediaSort], $search: String, $status: MediaStatus, $seasonYear: Int, $isAdult: Boolean, $format: MediaFormat) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total currentPage lastPage hasNextPage }
    media(type: ANIME, isAdult: $isAdult, sort: $sort, search: $search, status: $status, seasonYear: $seasonYear, format: $format) {
      id
      format
      status
      episodes
      duration
      averageScore
      popularity
      description
      genres
      isAdult
      title { romaji english native }
      coverImage { large extraLarge color }
      bannerImage
      startDate { year }
      trailer { id site }
      studios { nodes { name } }
      nextAiringEpisode { airingAt episode }
      idMal
      externalLinks { site url }
      characters(sort: [ROLE, RELEVANCE, FAVOURITES_DESC], perPage: 12) {
        edges {
          role
          node {
            id
            name { full }
            image { large medium }
          }
          voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) {
            id
            name { full }
            image { large medium }
          }
        }
      }
      staff(sort: [RELEVANCE, ID], perPage: 8) {
        edges {
          role
          node {
            id
            name { full }
            image { large medium }
          }
        }
      }
    }
  }
}
`;

interface AnilistMedia {
  id: number;
  idMal?: number | null;
  format?: string;
  status?: string;
  episodes?: number;
  duration?: number;
  averageScore?: number;
  popularity?: number;
  description?: string;
  genres?: string[];
  isAdult?: boolean;
  title?: { romaji?: string; english?: string; native?: string };
  coverImage?: { large?: string; extraLarge?: string };
  bannerImage?: string | null;
  startDate?: { year?: number };
  trailer?: { id?: string; site?: string } | null;
  studios?: { nodes?: Array<{ name?: string }> };
  nextAiringEpisode?: { airingAt?: number } | null;
  externalLinks?: Array<{ site?: string; url?: string }> | null;
  characters?: {
    edges?: Array<{
      role?: string;
      node?: {
        id?: number;
        name?: { full?: string };
        image?: { large?: string; medium?: string };
      };
      voiceActors?: Array<{
        id?: number;
        name?: { full?: string };
        image?: { large?: string; medium?: string };
      }>;
    }>;
  };
  staff?: {
    edges?: Array<{
      role?: string;
      node?: {
        id?: number;
        name?: { full?: string };
        image?: { large?: string; medium?: string };
      };
    }>;
  };
}

/** Parse TMDb movie/tv id from AniList externalLinks (site name or URL). */
export function extractTmdbFromExternalLinks(
  links?: Array<{ site?: string; url?: string }> | null,
): { id: number; mediaType: "movie" | "tv" } | null {
  for (const link of links ?? []) {
    const site = (link.site ?? "").toLowerCase().replace(/\s+/g, "");
    const url = link.url ?? "";
    const isTmdb =
      site === "tmdb" ||
      site === "themoviedb" ||
      site === "themoviedatabase" ||
      url.includes("themoviedb.org");
    if (!isTmdb) continue;
    const match = url.match(/themoviedb\.org\/(movie|tv)\/(\d+)/i);
    if (match) {
      const id = Number(match[2]);
      if (Number.isFinite(id) && id > 0) {
        return { id, mediaType: match[1].toLowerCase() as "movie" | "tv" };
      }
    }
  }
  return null;
}

/**
 * Resolve a missing TMDb id for anime/series so Watch Now can open the
 * episode embed player (same path as Attack on Titan).
 */
export async function resolveTmdbIdForTitle(opts: {
  title: string;
  year?: number | null;
  preferMovie?: boolean;
  alternateTitles?: string[];
  /**
   * When true, only accept TMDB matches that are actually animation (genre 16).
   * Prevents an anime from resolving to its LIVE-ACTION adaptation (e.g. the
   * live-action film of a shounen series), which would play the wrong video and
   * defeat the anime streaming backends. Set for contentType === "anime".
   */
  requireAnimation?: boolean;
}): Promise<{ tmdb: number; tmdbMediaType: "movie" | "tv" } | null> {
  const queries = [
    opts.title,
    ...(opts.alternateTitles ?? []).filter(
      (t) => t && t.toLowerCase() !== opts.title.toLowerCase(),
    ),
  ].filter(Boolean) as string[];

  for (const q of queries.slice(0, 3)) {
    const [movies, tv] = await Promise.all([
      tmdbGet<{
        results?: Array<{
          id?: number;
          title?: string;
          name?: string;
          original_title?: string;
          original_name?: string;
          release_date?: string;
          first_air_date?: string;
          genre_ids?: number[];
          origin_country?: string[];
          original_language?: string;
          popularity?: number;
        }>;
      }>("/search/movie", { query: q }),
      tmdbGet<{
        results?: Array<{
          id?: number;
          title?: string;
          name?: string;
          original_title?: string;
          original_name?: string;
          release_date?: string;
          first_air_date?: string;
          genre_ids?: number[];
          origin_country?: string[];
          original_language?: string;
          popularity?: number;
        }>;
      }>("/search/tv", { query: q }),
    ]);

    const norm = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim();
    const qn = norm(q);

    const scoreHit = (
      r: {
        id?: number;
        title?: string;
        name?: string;
        original_title?: string;
        original_name?: string;
        release_date?: string;
        first_air_date?: string;
        genre_ids?: number[];
        original_language?: string;
        popularity?: number;
      },
      mediaType: "movie" | "tv",
    ): number => {
      if (!r.id) return -1;
      const names = [r.title, r.name, r.original_title, r.original_name]
        .filter(Boolean)
        .map((n) => norm(String(n)));
      if (!names.some((n) => n === qn || n.includes(qn) || qn.includes(n))) {
        return -1;
      }
      let score = r.popularity ?? 0;
      if (names.some((n) => n === qn)) score += 1000;
      const date = r.release_date || r.first_air_date || "";
      const year = date ? Number(date.slice(0, 4)) : null;
      if (opts.year && year && Math.abs(year - opts.year) <= 1) score += 500;
      if (r.original_language === "ja") score += 200;
      if (r.genre_ids?.includes(16)) score += 150; // Animation
      if (opts.preferMovie && mediaType === "movie") score += 80;
      if (!opts.preferMovie && mediaType === "tv") score += 80;
      return score;
    };

    const candidates: Array<{
      tmdb: number;
      tmdbMediaType: "movie" | "tv";
      score: number;
    }> = [];

    // For anime, only real animation entries qualify — never a live-action
    // adaptation that happens to share the title.
    const passesAnimation = (r: { genre_ids?: number[] }): boolean =>
      !opts.requireAnimation || Boolean(r.genre_ids?.includes(16));

    for (const r of movies?.results ?? []) {
      if (!passesAnimation(r)) continue;
      const s = scoreHit(r, "movie");
      if (s >= 0 && r.id) {
        candidates.push({ tmdb: r.id, tmdbMediaType: "movie", score: s });
      }
    }
    for (const r of tv?.results ?? []) {
      if (!passesAnimation(r)) continue;
      const s = scoreHit(r, "tv");
      if (s >= 0 && r.id) {
        candidates.push({ tmdb: r.id, tmdbMediaType: "tv", score: s });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    if (candidates[0] && candidates[0].score >= 150) {
      return {
        tmdb: candidates[0].tmdb,
        tmdbMediaType: candidates[0].tmdbMediaType,
      };
    }
  }
  return null;
}

function mapAnilist(m: AnilistMedia): Content | null {
  // Adult anime is included when the catalog loads with includeMature
  const title =
    m.title?.english || m.title?.romaji || m.title?.native || null;
  if (!title) return null;
  const cover = m.coverImage?.extraLarge || m.coverImage?.large;
  const format = normalizeAnimeFormat(m.format);
  if (format === "MUSIC" || format === "UNKNOWN") return null;

  let trailer: Trailer | null = null;
  if (m.trailer?.id && m.trailer.site?.toLowerCase() === "youtube") {
    const ytKey = String(m.trailer.id).trim();
    trailer = {
      id: `yt_${ytKey}`,
      key: ytKey,
      site: "youtube",
      name: "Trailer",
      official: true,
      type: "Trailer",
    };
  }

  const statusMap: Record<string, Content["status"]> = {
    RELEASING: "airing",
    FINISHED: "ended",
    NOT_YET_RELEASED: "upcoming",
    CANCELLED: "canceled",
  };

  // Extract TMDb ID from externalLinks (e.g. "https://www.themoviedb.org/tv/1429" → 1429)
  const fromLinks = extractTmdbFromExternalLinks(m.externalLinks);
  let tmdbId = fromLinks?.id;
  let tmdbMediaType = fromLinks?.mediaType;
  // Movie-format anime without explicit media type → movie embed path
  if (tmdbId && !tmdbMediaType) {
    tmdbMediaType = format === "MOVIE" ? "movie" : "tv";
  }

  // Adults-only detection beyond AniList `isAdult` (which flags only hentai):
  // Ecchi / sexual-content genres mark adult-oriented anime (e.g. "Overflow",
  // an R18+ ecchi that AniList does NOT set isAdult on). These must hide when
  // the 18+ toggle is off — hence a distinct `anime-adult-genre` tag.
  const genreLower = (m.genres ?? []).map((g) => g.toLowerCase());
  const adultGenre = genreLower.some(
    (g) => g === "hentai" || g === "ecchi" || g === "erotica",
  );

  const animeSlug = slugify(`${title}-${m.id}`) || `anilist-${m.id}`;
  return safeParse({
    id: `anilist_${m.id}`,
    slug: animeSlug === "title" ? `anilist-${m.id}` : animeSlug,
    contentType: "anime",
    title,
    englishTitle: m.title?.english,
    romajiTitle: m.title?.romaji,
    nativeTitle: m.title?.native,
    originalTitle: m.title?.native,
    alternateTitles: [m.title?.english, m.title?.romaji, m.title?.native].filter(
      Boolean,
    ) as string[],
    overview: (m.description ?? "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
    poster: cover
      ? { url: cover, source: "anilist" }
      : { url: posterFallback(title, 0x7867ff), source: "local" },
    backdrop: m.bannerImage
      ? { url: m.bannerImage, source: "anilist" }
      : null,
    releaseDate: m.startDate?.year ? `${m.startDate.year}-01-01` : null,
    year: m.startDate?.year ?? null,
    status: statusMap[m.status ?? ""] ?? "unknown",
    language: "ja",
    countries: ["JP"],
    genres: (m.genres ?? []).map((g) => ({ id: slugify(g), name: g })),
    runtime: m.duration ?? null,
    seasonCount: null,
    episodeCount: m.episodes ?? null,
    ageRating: m.isAdult ? "18+" : adultGenre ? "R+" : null,
    scores: m.averageScore
      ? [{ source: "anilist", score: m.averageScore / 10 }]
      : [],
    popularity: m.popularity ?? 0,
    trailer,
    watchProviders: [],
    providerIds: {
      anilist: m.id,
      ...(m.idMal ? { mal: m.idMal } : {}),
      ...(tmdbId ? { tmdb: tmdbId, tmdbMediaType } : {}),
    },
    animeFormat: format,
    studios: (m.studios?.nodes ?? [])
      .map((n) => n.name)
      .filter(Boolean) as string[],
    // AniList isAdult = hentai (ground truth). Adult-oriented ecchi genres are
    // tagged separately so the 18+ OFF gate hides them without treating them as
    // explicit sexual content in the curated 18+ library.
    tags: m.isAdult
      ? ["18+", "mature", "adult-anime", "anilist-adult", "anime", "explicit"]
      : adultGenre
        ? ["r+", "mature", "adults-only", "anime-adult-genre", "anime"]
        : format === "MOVIE"
          ? ["anime", "anime-movie", "film"]
          : ["anime"],
    nextEpisodeAt: m.nextAiringEpisode?.airingAt
      ? new Date(m.nextAiringEpisode.airingAt * 1000).toISOString()
      : null,
    approved: true,
    mature: Boolean(m.isAdult) || adultGenre,
    lastSyncedAt: new Date().toISOString(),
  });
}

export function mapAnilistCredits(m: AnilistMedia, contentId: string): {
  cast: Credit[];
  crew: Credit[];
} {
  const cast: Credit[] = [];
  const crew: Credit[] = [];
  let order = 0;
  for (const edge of m.characters?.edges ?? []) {
    const node = edge.node;
    if (!node?.name?.full) continue;
    const charIdx = order;
    cast.push({
      id: `${contentId}_char_${node.id ?? "x"}_${charIdx}`,
      contentId,
      personId: `anilist_char_${node.id ?? charIdx}`,
      personName: node.name.full,
      profilePath: node.image?.large || node.image?.medium || null,
      character: edge.role ?? "Character",
      job: null,
      department: "Acting",
      order: order++,
      creditType: "cast",
    });
    const va = edge.voiceActors?.[0];
    if (va?.name?.full) {
      const vaIdx = order;
      cast.push({
        id: `${contentId}_va_${va.id ?? "x"}_${node.id ?? "c"}_${vaIdx}`,
        contentId,
        personId: `anilist_va_${va.id ?? vaIdx}`,
        personName: va.name.full,
        profilePath: va.image?.large || va.image?.medium || null,
        character: `VA · ${node.name.full}`,
        job: "Voice Actor",
        department: "Acting",
        order: order++,
        creditType: "cast",
      });
    }
  }
  let crewOrder = 0;
  for (const edge of m.staff?.edges ?? []) {
    const node = edge.node;
    if (!node?.name?.full) continue;
    const roleSlug = (edge.role ?? "staff").replace(/\W+/g, "_").slice(0, 40);
    // Same person can appear multiple times with different roles — index + role must be unique
    crew.push({
      id: `${contentId}_staff_${node.id ?? "x"}_${roleSlug}_${crewOrder}`,
      contentId,
      personId: `anilist_staff_${node.id ?? crewOrder}`,
      personName: node.name.full,
      profilePath: node.image?.large || node.image?.medium || null,
      character: null,
      job: edge.role ?? "Staff",
      department: "Crew",
      order: crewOrder++,
      creditType: "crew",
    });
  }
  return { cast, crew };
}

export type WorldCatalogPage = {
  items: Content[];
  page: number;
  totalPages: number;
  total: number;
};

export async function fetchAnilistAnime(opts?: {
  page?: number;
  search?: string;
  sort?: string;
  status?: string;
  perPage?: number;
  seasonYear?: number;
  /** When true, request 18+ anime catalog from AniList */
  isAdult?: boolean;
  format?: string;
}): Promise<Content[]> {
  const page = await fetchAnilistAnimePage(opts);
  return page.items;
}

/** Paginated anime browse — AniList holds essentially the full anime catalog */
export async function fetchAnilistAnimePage(opts?: {
  page?: number;
  search?: string;
  sort?: string;
  status?: string;
  perPage?: number;
  seasonYear?: number;
  isAdult?: boolean;
  /** AniList MediaFormat: TV, MOVIE, OVA, ONA, SPECIAL, … */
  format?: string;
}): Promise<WorldCatalogPage> {
  const page = Math.max(1, opts?.page ?? 1);
  const perPage = Math.min(50, Math.max(1, opts?.perPage ?? 50));
  // AniList: isAdult true = adult only, false = safe only.
  // Omit the field entirely when undefined — never send null (can empty results).
  const variables: Record<string, unknown> = {
    page,
    perPage,
    sort: [opts?.sort ?? "POPULARITY_DESC"],
  };
  if (opts?.search) variables.search = opts.search;
  if (opts?.status) variables.status = opts.status;
  if (opts?.seasonYear) variables.seasonYear = opts.seasonYear;
  if (opts?.format) variables.format = opts.format;
  if (opts?.isAdult !== undefined) variables.isAdult = Boolean(opts.isAdult);
  else variables.isAdult = false; // default safe catalog

  const data = await fetchJson<{
    data?: {
      Page?: {
        pageInfo?: {
          total?: number;
          currentPage?: number;
          lastPage?: number;
          hasNextPage?: boolean;
        };
        media?: AnilistMedia[];
      };
    };
  }>(ANILIST, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: ANIME_QUERY,
      variables,
    }),
  });
  const pageInfo = data?.data?.Page?.pageInfo;
  const items = (data?.data?.Page?.media ?? [])
    .map(mapAnilist)
    .filter(Boolean) as Content[];
  const total = pageInfo?.total ?? items.length;
  const lastPage = pageInfo?.lastPage ?? Math.max(1, Math.ceil(total / perPage));
  return {
    items,
    page: pageInfo?.currentPage ?? page,
    totalPages: Math.max(1, lastPage),
    total,
  };
}

export async function fetchAnilistById(id: number): Promise<{
  content: Content | null;
  cast: Credit[];
  crew: Credit[];
  trailers: Trailer[];
}> {
  const data = await fetchJson<{
    data?: { Page?: { media?: AnilistMedia[] } };
  }>(ANILIST, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: ANIME_QUERY,
      variables: { page: 1, perPage: 1, search: undefined, sort: ["POPULARITY_DESC"] },
    }),
  });
  // Better: Media(id: $id) query
  const detail = await fetchJson<{
    data?: { Media?: AnilistMedia };
  }>(ANILIST, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: `
        query ($id: Int) {
          Media(id: $id, type: ANIME, isAdult: false) {
            id format status episodes duration averageScore popularity description genres isAdult
            title { romaji english native }
            coverImage { large extraLarge }
            bannerImage startDate { year }
            trailer { id site }
            studios { nodes { name } }
            nextAiringEpisode { airingAt }
            idMal
            externalLinks { site url }
            characters(sort: [ROLE, RELEVANCE, FAVOURITES_DESC], perPage: 16) {
              edges {
                role
                node { id name { full } image { large medium } }
                voiceActors(language: JAPANESE, sort: [RELEVANCE, ID]) {
                  id name { full } image { large medium }
                }
              }
            }
            staff(sort: [RELEVANCE, ID], perPage: 12) {
              edges { role node { id name { full } image { large medium } } }
            }
          }
        }
      `,
      variables: { id },
    }),
  });
  void data;
  const media = detail?.data?.Media;
  if (!media) return { content: null, cast: [], crew: [], trailers: [] };
  const content = mapAnilist(media);
  if (!content) return { content: null, cast: [], crew: [], trailers: [] };
  const credits = mapAnilistCredits(media, content.id);
  const trailers = content.trailer ? [content.trailer] : [];
  return { content, ...credits, trailers };
}

export async function fetchAllAnimeLive(
  includeMature = false,
): Promise<Content[]> {
  const year = new Date().getFullYear();
  // Deep popularity/trending pages for cache warm; full catalog is on-demand paginated
  const popularPages = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      fetchAnilistAnime({
        page: i + 1,
        perPage: 50,
        sort: "POPULARITY_DESC",
        isAdult: false,
      }),
    ),
  );
  // Explicit anime films (theatrical / OVA movies) for the Anime tab
  const animeMoviePages = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      fetchAnilistAnime({
        page: i + 1,
        perPage: 50,
        sort: "POPULARITY_DESC",
        format: "MOVIE",
        isAdult: false,
      }),
    ),
  );
  const [
    trending,
    trending2,
    releasing,
    yearScore,
    yearScore2,
    classicScore,
    decade2010,
    decade2000,
    decade1990,
    tmdbAnimeMovies,
    ...maturePages
  ] = await Promise.all([
    fetchAnilistAnime({ page: 1, perPage: 50, sort: "TRENDING_DESC" }),
    fetchAnilistAnime({ page: 2, perPage: 50, sort: "TRENDING_DESC" }),
    fetchAnilistAnime({
      page: 1,
      perPage: 50,
      status: "RELEASING",
      sort: "POPULARITY_DESC",
    }),
    fetchAnilistAnime({
      page: 1,
      perPage: 50,
      sort: "SCORE_DESC",
      seasonYear: year,
    }),
    fetchAnilistAnime({
      page: 1,
      perPage: 50,
      sort: "POPULARITY_DESC",
      seasonYear: year,
    }),
    fetchAnilistAnime({
      page: 1,
      perPage: 50,
      sort: "SCORE_DESC",
      seasonYear: year - 5,
    }),
    fetchAnilistAnime({
      page: 1,
      perPage: 50,
      sort: "POPULARITY_DESC",
      seasonYear: 2010,
    }),
    fetchAnilistAnime({
      page: 1,
      perPage: 50,
      sort: "POPULARITY_DESC",
      seasonYear: 2000,
    }),
    fetchAnilistAnime({
      page: 1,
      perPage: 50,
      sort: "POPULARITY_DESC",
      seasonYear: 1995,
    }),
    fetchTmdbAnimeMovies().catch(() => [] as Content[]),
    ...(includeMature
      ? Array.from({ length: 12 }, (_, i) =>
          fetchAnilistAnime({
            page: i + 1,
            perPage: 50,
            sort: "POPULARITY_DESC",
            isAdult: true,
          }),
        )
      : []),
  ]);

  const tagToday = (list: Content[], extra: string[] = []) =>
    list.map((c) => {
      // Never promote adult anime into safe "trending today" rows
      if (c.mature) return c;
      return {
        ...c,
        tags: Array.from(
          new Set([
            ...(c.tags ?? []),
            "trending-today",
            "popular",
            "anime",
            ...extra,
          ]),
        ),
        popularity: (c.popularity ?? 0) + 30,
      };
    });

  const popular1 = popularPages[0] ?? [];
  const todayAnime = [
    ...tagToday(trending, ["anilist-trending"]),
    ...tagToday(trending2, ["anilist-trending"]),
    ...tagToday(popular1, ["anilist-popular"]),
    ...tagToday(releasing, ["airing"]),
  ];

  const rest = [
    ...popularPages.slice(1).flat(),
    ...animeMoviePages.flat(),
    ...tmdbAnimeMovies,
    ...yearScore,
    ...yearScore2,
    ...classicScore,
    ...decade2010,
    ...decade2000,
    ...decade1990,
    ...maturePages.flat(),
  ];

  // Accurate adult tags only when AniList isAdult (mapAnilist already set mature)
  return [...todayAnime, ...rest].map((c) => {
    if (!c.mature) return { ...c, mature: false };
    return {
      ...c,
      mature: true,
      ageRating: c.ageRating || "18+",
      tags: Array.from(
        new Set([
          ...(c.tags ?? []),
          "18+",
          "mature",
          "adult-anime",
          "anilist-adult",
          "anime",
          "explicit",
        ]),
      ),
    };
  });
}

/**
 * Dedicated adult anime pack (AniList isAdult + Jikan Rx).
 * Metadata only — never streams. Only used when mature catalog is on.
 */
export async function fetchAdultAnimeCatalog(): Promise<Content[]> {
  const pages = await Promise.all([
    fetchAnilistAnime({ page: 1, perPage: 50, sort: "POPULARITY_DESC", isAdult: true }),
    fetchAnilistAnime({ page: 2, perPage: 50, sort: "POPULARITY_DESC", isAdult: true }),
    fetchAnilistAnime({ page: 3, perPage: 50, sort: "POPULARITY_DESC", isAdult: true }),
    fetchAnilistAnime({ page: 4, perPage: 50, sort: "POPULARITY_DESC", isAdult: true }),
    fetchAnilistAnime({ page: 5, perPage: 50, sort: "POPULARITY_DESC", isAdult: true }),
    fetchAnilistAnime({ page: 6, perPage: 50, sort: "POPULARITY_DESC", isAdult: true }),
    fetchAnilistAnime({ page: 7, perPage: 50, sort: "POPULARITY_DESC", isAdult: true }),
    fetchAnilistAnime({ page: 8, perPage: 50, sort: "POPULARITY_DESC", isAdult: true }),
    fetchAnilistAnime({ page: 1, perPage: 50, sort: "TRENDING_DESC", isAdult: true }),
    fetchAnilistAnime({ page: 2, perPage: 50, sort: "TRENDING_DESC", isAdult: true }),
    fetchAnilistAnime({ page: 1, perPage: 50, sort: "SCORE_DESC", isAdult: true }),
    fetchAnilistAnime({ page: 2, perPage: 50, sort: "SCORE_DESC", isAdult: true }),
    fetchAnilistAnime({ page: 1, perPage: 50, sort: "FAVOURITES_DESC", isAdult: true }),
    fetchAnilistAnime({ page: 1, perPage: 40, sort: "START_DATE_DESC", isAdult: true }),
    fetchJikanAdultAnime().catch(() => [] as Content[]),
  ]);

  return pages.flat().map((c) => ({
    ...c,
    contentType: "anime" as const,
    mature: true,
    ageRating: c.ageRating || "18+",
    tags: Array.from(
      new Set([
        ...(c.tags ?? []),
        "18+",
        "mature",
        "adult-anime",
        "anime",
        "explicit",
      ]),
    ),
  }));
}

/* ─── TVMaze ──────────────────────────────────────────────── */

interface TvMazeShow {
  id: number;
  name: string;
  language?: string | null;
  genres?: string[];
  status?: string;
  runtime?: number | null;
  premiered?: string | null;
  summary?: string | null;
  rating?: { average?: number | null };
  weight?: number;
  image?: { medium?: string; original?: string } | null;
  network?: { country?: { code?: string } } | null;
  webChannel?: { country?: { code?: string } } | null;
  externals?: { imdb?: string | null };
  type?: string;
  _embedded?: {
    cast?: Array<{
      person?: {
        id?: number;
        name?: string;
        image?: { medium?: string; original?: string } | null;
      };
      character?: { name?: string };
    }>;
    crew?: Array<{
      type?: string;
      person?: {
        id?: number;
        name?: string;
        image?: { medium?: string; original?: string } | null;
      };
    }>;
  };
}

function mapTvMaze(s: TvMazeShow, forceType?: ContentType): Content | null {
  if (!s.name) return null;
  const countries: string[] = [];
  const code =
    s.network?.country?.code || s.webChannel?.country?.code || undefined;
  if (code) countries.push(code);
  const genres = (s.genres ?? []).map((g) => ({
    id: slugify(g),
    name: g,
  }));
  const langNorm =
    s.language?.toLowerCase() === "korean"
      ? "ko"
      : s.language?.toLowerCase() === "japanese"
        ? "ja"
        : s.language?.toLowerCase() === "chinese" ||
            s.language?.toLowerCase() === "mandarin" ||
            s.language?.toLowerCase() === "cantonese"
          ? "zh"
          : s.language?.toLowerCase() === "thai"
            ? "th"
            : s.language;
  const detectedDrama = classifyDrama({
    isTv: true,
    originalLanguage: langNorm,
    originCountries: countries,
    genres,
    typeLabel: s.type,
    override: isDramaType(forceType) ? (forceType as ContentType) : null,
  });
  const contentType: ContentType =
    (isDramaType(forceType) ? (forceType as ContentType) : null) ??
    detectedDrama ??
    "series";
  const isDrama = isDramaType(contentType);
  const img = s.image?.original || s.image?.medium;
  const year = s.premiered ? Number(s.premiered.slice(0, 4)) : null;

  return safeParse({
    id: `tvmaze_${s.id}`,
    slug: slugify(`${s.name}-${s.id}`),
    contentType,
    title: s.name,
    originalTitle: s.name,
    overview: (s.summary ?? "").replace(/<[^>]+>/g, ""),
    poster: img
      ? { url: img, source: "tmdb" }
      : {
          url: posterFallback(
            s.name,
            isDrama ? 0x5c1a2e : 0x172033,
          ),
          source: "local",
        },
    backdrop: img ? { url: img, source: "tmdb" } : null,
    releaseDate: s.premiered ?? null,
    year,
    status:
      s.status === "Running"
        ? "airing"
        : s.status === "Ended"
          ? "ended"
          : "unknown",
    language:
      s.language?.toLowerCase() === "korean"
        ? "ko"
        : s.language?.slice(0, 2).toLowerCase() ?? null,
    countries,
    genres,
    runtime: s.runtime ?? null,
    seasonCount: null,
    episodeCount: null,
    ageRating: null,
    scores: s.rating?.average
      ? [{ source: "cineverse", score: s.rating.average }]
      : [],
    popularity: s.weight ?? 0,
    trailer: null,
    watchProviders: [],
    providerIds: { tvmaze: s.id, imdb: s.externals?.imdb ?? undefined },
    studios: [],
    tags: [],
    alternateTitles: [],
    approved: true,
    mature: false,
    lastSyncedAt: new Date().toISOString(),
  });
}

export async function fetchTvMazePopular(): Promise<Content[]> {
  // Skip entirely when the host circuit is open (avoids 8× connect timeouts).
  if (isCircuitOpen(hostOf(TVMAZE))) return [];

  // Pages 0–7, but only 2 at a time — full parallel was hammering TVMaze
  // and stacking 10s connect timeouts when the host was unreachable.
  const pageNums = [0, 1, 2, 3, 4, 5, 6, 7] as const;
  const pages = await mapPool(pageNums, 2, (p) =>
    fetchTvMazeJson<TvMazeShow[]>(`/shows?page=${p}`),
  );
  const tagToday = (list: TvMazeShow[] | null | undefined) =>
    (list ?? [])
      .map((s) => mapTvMaze(s))
      .filter(Boolean)
      .map((c) => ({
        ...c!,
        tags: Array.from(
          new Set([...(c!.tags ?? []), "trending-today", "popular"]),
        ),
        popularity: (c!.popularity ?? 0) + 25,
      })) as Content[];

  const rest = pages
    .slice(1)
    .flatMap((p) => p ?? [])
    .map((s) => mapTvMaze(s))
    .filter(Boolean) as Content[];

  return [...tagToday(pages[0]), ...rest].slice(0, 600);
}

export async function fetchTvMazeSearch(q: string): Promise<Content[]> {
  if (!q.trim()) return [];
  const data = await fetchTvMazeJson<Array<{ show: TvMazeShow }>>(
    `/search/shows?q=${encodeURIComponent(q)}`,
  );
  return (data ?? [])
    .map((r) => mapTvMaze(r.show))
    .filter(Boolean) as Content[];
}

/** Resolve a TVMaze show id by title (single best match). */
export async function resolveTvMazeShowId(title: string): Promise<number | null> {
  if (!title.trim()) return null;
  const data = await fetchTvMazeJson<Array<{ show: TvMazeShow; score?: number }>>(
    `/search/shows?q=${encodeURIComponent(title)}`,
  );
  const hit = data?.[0]?.show;
  return hit?.id ?? null;
}

interface TvMazeEpisode {
  id: number;
  name?: string | null;
  season?: number | null;
  number?: number | null;
  airdate?: string | null;
  runtime?: number | null;
  summary?: string | null;
  image?: { medium?: string; original?: string } | null;
}

interface TvMazeSeason {
  id: number;
  number?: number | null;
  name?: string | null;
  episodeOrder?: number | null;
  premiereDate?: string | null;
  endDate?: string | null;
  summary?: string | null;
  image?: { medium?: string; original?: string } | null;
}

/** Live seasons from TVMaze (keyless). */
export async function fetchTvMazeSeasons(
  showId: number,
  contentId: string,
): Promise<Season[]> {
  const data = await fetchTvMazeJson<TvMazeSeason[]>(
    `/shows/${showId}/seasons`,
  );
  if (!data?.length) return [];
  return data
    .filter((s) => (s.number ?? 0) > 0)
    .map((s) => {
      const n = s.number ?? 0;
      const img = s.image?.original || s.image?.medium;
      return {
        id: `${contentId}_s${n}`,
        contentId,
        seasonNumber: n,
        name: s.name?.trim() || `Season ${n}`,
        overview: (s.summary ?? "").replace(/<[^>]+>/g, "").trim(),
        poster: img ? { url: img, source: "tmdb" as const } : null,
        airDate: s.premiereDate ?? null,
        episodeCount: s.episodeOrder ?? 0,
      };
    });
}

/** Live episodes for one season from TVMaze (keyless). */
export async function fetchTvMazeSeasonEpisodes(
  showId: number,
  seasonNumber: number,
  contentId: string,
): Promise<Episode[]> {
  const data = await fetchTvMazeJson<TvMazeEpisode[]>(
    `/shows/${showId}/episodes`,
  );
  if (!data?.length) return [];
  const seasonId = `${contentId}_s${seasonNumber}`;
  return data
    .filter((e) => (e.season ?? 0) === seasonNumber)
    .map((e) => {
      const num = e.number ?? 0;
      const still = e.image?.original || e.image?.medium || null;
      return {
        id: `${seasonId}_e${num || e.id}`,
        contentId,
        seasonId,
        seasonNumber,
        episodeNumber: num,
        name: e.name?.trim() || `Episode ${num}`,
        overview: (e.summary ?? "").replace(/<[^>]+>/g, "").trim(),
        stillPath: still,
        airDate: e.airdate || null,
        runtime: e.runtime ?? null,
      };
    })
    .filter((e) => e.episodeNumber > 0);
}

export async function fetchTvMazeKdrama(): Promise<Content[]> {
  if (isCircuitOpen(hostOf(TVMAZE))) return [];

  // Focused query set (TMDB covers most kdrama when token is present).
  // High fan-out was a major source of connect-timeout storms.
  const queries = [
    "korean",
    "goblin",
    "crash landing",
    "squid game",
    "business proposal",
    "vincenzo",
    "extraordinary attorney woo",
    "the glory",
    "queen of tears",
    "lovely runner",
    "alchemy of souls",
    "hospital playlist",
  ];
  const results: Content[] = [];
  await mapPool(queries, 3, async (q) => {
    const data = await fetchTvMazeJson<Array<{ show: TvMazeShow }>>(
      `/search/shows?q=${encodeURIComponent(q)}`,
    );
    for (const r of data ?? []) {
      const mappedRaw =
        mapTvMaze(r.show, "kdrama") ??
        mapTvMaze({
          ...r.show,
          language: r.show.language ?? "Korean",
        });
      const mapped = mappedRaw
        ? {
            ...mappedRaw,
            tags: Array.from(
              new Set([
                ...(mappedRaw.tags ?? []),
                "trending-today",
                "popular",
                "kdrama",
              ]),
            ),
            popularity: (mappedRaw.popularity ?? 0) + 20,
          }
        : null;
      if (
        mapped &&
        (mapped.contentType === "kdrama" ||
          mapped.language === "ko" ||
          mapped.countries.includes("KR") ||
          mapped.title.toLowerCase().includes("korea"))
      ) {
        results.push({ ...mapped, contentType: "kdrama" });
      }
    }
  });
  const byId = new Map(results.map((c) => [c.id, c]));
  return Array.from(byId.values());
}

export async function fetchTvMazeById(id: number): Promise<{
  content: Content | null;
  cast: Credit[];
  crew: Credit[];
}> {
  const show = await fetchTvMazeJson<TvMazeShow>(
    `/shows/${id}?embed[]=cast&embed[]=crew`,
  );
  if (!show) return { content: null, cast: [], crew: [] };
  const content = mapTvMaze(show);
  if (!content) return { content: null, cast: [], crew: [] };
  const cast: Credit[] = (show._embedded?.cast ?? []).map((c, i) => ({
    id: `${content.id}_cast_${c.person?.id ?? i}`,
    contentId: content.id,
    personId: `tvmaze_person_${c.person?.id ?? i}`,
    personName: c.person?.name ?? "Unknown",
    profilePath:
      c.person?.image?.original || c.person?.image?.medium || null,
    character: c.character?.name ?? null,
    job: null,
    department: "Acting",
    order: i,
    creditType: "cast" as const,
  }));
  const crew: Credit[] = (show._embedded?.crew ?? [])
    .slice(0, 20)
    .map((c, i) => ({
      id: `${content.id}_crew_${c.person?.id ?? i}`,
      contentId: content.id,
      personId: `tvmaze_person_${c.person?.id ?? i}`,
      personName: c.person?.name ?? "Unknown",
      profilePath:
        c.person?.image?.original || c.person?.image?.medium || null,
      character: null,
      job: c.type ?? "Crew",
      department: "Crew",
      order: i,
      creditType: "crew" as const,
    }));
  return { content, cast, crew };
}

/* ─── Jikan ───────────────────────────────────────────────── */

export async function fetchJikanTop(): Promise<Content[]> {
  const [popular, airing, favorite, movie, upcoming, ova] = await Promise.all([
    fetchJson<{ data?: JikanAnime[] }>(
      `${JIKAN}/top/anime?filter=bypopularity&limit=25`,
    ),
    fetchJson<{ data?: JikanAnime[] }>(
      `${JIKAN}/top/anime?filter=airing&limit=25`,
    ),
    fetchJson<{ data?: JikanAnime[] }>(
      `${JIKAN}/top/anime?filter=favorite&limit=25`,
    ),
    fetchJson<{ data?: JikanAnime[] }>(
      `${JIKAN}/top/anime?type=movie&filter=bypopularity&limit=25`,
    ),
    fetchJson<{ data?: JikanAnime[] }>(
      `${JIKAN}/top/anime?filter=upcoming&limit=25`,
    ),
    fetchJson<{ data?: JikanAnime[] }>(
      `${JIKAN}/top/anime?type=ova&filter=bypopularity&limit=25`,
    ),
  ]);
  const tagToday = (rows: JikanAnime[] | undefined) =>
    (rows ?? [])
      .map(mapJikan)
      .filter(Boolean)
      .map((c) => ({
        ...c!,
        tags: Array.from(
          new Set([
            ...(c!.tags ?? []),
            "trending-today",
            "popular",
            "anime",
          ]),
        ),
        popularity: (c!.popularity ?? 0) + 28,
      })) as Content[];

  return [
    ...tagToday(popular?.data),
    ...tagToday(airing?.data),
    ...((favorite?.data ?? []).map(mapJikan).filter(Boolean) as Content[]),
    ...((movie?.data ?? []).map(mapJikan).filter(Boolean) as Content[]),
    ...((upcoming?.data ?? []).map(mapJikan).filter(Boolean) as Content[]),
    ...((ova?.data ?? []).map(mapJikan).filter(Boolean) as Content[]),
  ];
}

/** Resolve MyAnimeList id via Jikan search (keyless). */
export async function resolveJikanMalId(title: string): Promise<number | null> {
  if (!title.trim()) return null;
  const data = await fetchJson<{
    data?: Array<{ mal_id?: number; title?: string }>;
  }>(`${JIKAN}/anime?q=${encodeURIComponent(title)}&limit=5`);
  const hit = data?.data?.[0];
  return hit?.mal_id ?? null;
}

interface JikanEpisodeRow {
  mal_id?: number;
  title?: string | null;
  title_japanese?: string | null;
  title_romanji?: string | null;
  aired?: string | null;
  filler?: boolean;
  recap?: boolean;
  synopsis?: string | null;
}

/**
 * Anime episode titles from Jikan (keyless).
 * MAL lists are usually flat (S1); multi-season series are often separate MAL entries.
 */
export async function fetchJikanEpisodes(
  malId: number,
  contentId: string,
  seasonNumber = 1,
): Promise<Episode[]> {
  const all: JikanEpisodeRow[] = [];
  // Jikan paginates ~100 eps per page
  for (let page = 1; page <= 8; page++) {
    const data = await fetchJson<{
      data?: JikanEpisodeRow[];
      pagination?: { has_next_page?: boolean };
    }>(`${JIKAN}/anime/${malId}/episodes?page=${page}`);
    const rows = data?.data ?? [];
    if (!rows.length) break;
    all.push(...rows);
    if (!data?.pagination?.has_next_page) break;
  }
  if (!all.length) return [];

  // Only attach to season 1 unless we know a single-season show
  if (seasonNumber !== 1) return [];

  const seasonId = `${contentId}_s${seasonNumber}`;
  return all.map((e, i) => {
    const num = e.mal_id ?? i + 1;
    const name =
      e.title?.trim() ||
      e.title_romanji?.trim() ||
      e.title_japanese?.trim() ||
      `Episode ${num}`;
    const bits: string[] = [];
    if (e.synopsis?.trim()) bits.push(e.synopsis.trim());
    if (e.filler) bits.push("Filler episode.");
    if (e.recap) bits.push("Recap episode.");
    return {
      id: `${seasonId}_e${num}`,
      contentId,
      seasonId,
      seasonNumber,
      episodeNumber: num,
      name,
      overview: bits.join(" ") || "",
      stillPath: null,
      airDate: e.aired ? e.aired.slice(0, 10) : null,
      runtime: null,
    };
  });
}

interface JikanAnime {
  mal_id: number;
  title: string;
  title_english?: string | null;
  title_japanese?: string | null;
  synopsis?: string | null;
  images?: { jpg?: { large_image_url?: string; image_url?: string } };
  score?: number | null;
  popularity?: number | null;
  members?: number | null;
  year?: number | null;
  episodes?: number | null;
  status?: string | null;
  genres?: Array<{ name: string }>;
  themes?: Array<{ name: string }>;
  demographics?: Array<{ name: string }>;
  trailer?: { youtube_id?: string | null };
  type?: string | null;
  /** e.g. "Rx - Hentai", "R+ - Mild Nudity", "PG-13 - Teens 13 or older" */
  rating?: string | null;
}

/** True only for Jikan Rx (Hentai) — not R+ mild nudity alone. */
function jikanIsAdult(a: JikanAnime): boolean {
  const r = (a.rating ?? "").toLowerCase();
  if (r.includes("rx") || r.includes("hentai")) return true;
  const genreNames = [
    ...(a.genres ?? []),
    ...(a.themes ?? []),
  ].map((g) => g.name.toLowerCase());
  return genreNames.some((g) => g === "hentai" || g === "erotica");
}

function mapJikan(a: JikanAnime): Content | null {
  const title = a.title_english || a.title;
  const img =
    a.images?.jpg?.large_image_url || a.images?.jpg?.image_url;
  const adult = jikanIsAdult(a);
  return safeParse({
    id: `jikan_${a.mal_id}`,
    slug: slugify(`${title}-${a.mal_id}`),
    contentType: "anime",
    title,
    englishTitle: a.title_english ?? undefined,
    nativeTitle: a.title_japanese ?? undefined,
    originalTitle: a.title_japanese ?? undefined,
    alternateTitles: [a.title, a.title_english, a.title_japanese].filter(
      Boolean,
    ) as string[],
    overview: a.synopsis ?? "",
    poster: img
      ? { url: img, source: "anilist" }
      : { url: posterFallback(title, 0x7867ff), source: "local" },
    backdrop: null,
    releaseDate: a.year ? `${a.year}-01-01` : null,
    year: a.year ?? null,
    status: a.status?.includes("Airing") ? "airing" : "ended",
    language: "ja",
    countries: ["JP"],
    genres: (a.genres ?? []).map((g) => ({
      id: slugify(g.name),
      name: g.name,
    })),
    runtime: null,
    seasonCount: null,
    episodeCount: a.episodes ?? null,
    ageRating: adult ? "18+" : a.rating?.startsWith("R+") ? "R+" : null,
    scores: a.score ? [{ source: "cineverse", score: a.score }] : [],
    popularity: a.members ?? a.popularity ?? 0,
    trailer: a.trailer?.youtube_id
      ? {
          id: `yt_${a.trailer.youtube_id}`,
          key: a.trailer.youtube_id,
          site: "youtube",
          name: "Trailer",
          official: true,
          type: "Trailer",
        }
      : null,
    watchProviders: [],
    providerIds: { mal: a.mal_id },
    animeFormat: normalizeAnimeFormat(a.type),
    studios: [],
    tags: adult
      ? ["18+", "mature", "adult-anime", "jikan-rx", "anime", "explicit", "hentai"]
      : ["anime"],
    approved: true,
    mature: adult,
    lastSyncedAt: new Date().toISOString(),
  });
}

/**
 * Jikan Rx (Hentai) catalog — accurate adult anime only.
 * Uses rating=rx so mild R+ fanservice is NOT included.
 */
export async function fetchJikanAdultAnime(): Promise<Content[]> {
  const pages = await Promise.all(
    [1, 2, 3, 4, 5, 6].map((page) =>
      fetchJson<{ data?: JikanAnime[] }>(
        `${JIKAN}/anime?rating=rx&order_by=members&sort=desc&page=${page}&limit=25&sfw=false`,
      ),
    ),
  );
  return pages
    .flatMap((r) => r?.data ?? [])
    .map(mapJikan)
    .filter((c): c is Content => Boolean(c?.mature));
}

export async function fetchJikanCredits(malId: number, contentId: string): Promise<{
  cast: Credit[];
  crew: Credit[];
}> {
  const data = await fetchJson<{
    data?: Array<{
      character?: {
        mal_id?: number;
        name?: string;
        images?: { jpg?: { image_url?: string } };
      };
      role?: string;
      voice_actors?: Array<{
        person?: {
          mal_id?: number;
          name?: string;
          images?: { jpg?: { image_url?: string } };
        };
      }>;
    }>;
  }>(`${JIKAN}/anime/${malId}/characters`);
  const cast: Credit[] = [];
  let order = 0;
  for (const row of (data?.data ?? []).slice(0, 20)) {
    if (row.character?.name) {
      cast.push({
        id: `${contentId}_jchar_${row.character.mal_id ?? order}`,
        contentId,
        personId: `jikan_char_${row.character.mal_id ?? order}`,
        personName: row.character.name,
        profilePath: row.character.images?.jpg?.image_url ?? null,
        character: row.role ?? "Character",
        job: null,
        department: "Acting",
        order: order++,
        creditType: "cast",
      });
    }
    const va = row.voice_actors?.[0]?.person;
    if (va?.name) {
      cast.push({
        id: `${contentId}_jva_${va.mal_id ?? order}`,
        contentId,
        personId: `jikan_person_${va.mal_id ?? order}`,
        personName: va.name,
        profilePath: va.images?.jpg?.image_url ?? null,
        character: `VA · ${row.character?.name ?? ""}`,
        job: "Voice Actor",
        department: "Acting",
        order: order++,
        creditType: "cast",
      });
    }
  }
  return { cast, crew: [] };
}

/* ─── TMDB ────────────────────────────────────────────────── */

async function tmdbGet<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T | null> {
  const token = process.env.TMDB_ACCESS_TOKEN;
  if (!token) return null;
  const url = new URL(`${TMDB}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return fetchJson<T>(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
}

export function hasTmdbAccess(): boolean {
  return Boolean(process.env.TMDB_ACCESS_TOKEN);
}

type TmdbListResponse = {
  page?: number;
  total_pages?: number;
  total_results?: number;
  results?: Record<string, unknown>[];
};

/** TMDB discover returns max 500 pages × 20 results */
const TMDB_MAX_PAGES = 500;
const TMDB_PAGE_SIZE = 20;

function tmdbSortParam(
  sort: "popularity" | "rating" | "newest" | "oldest" | "title_asc" | "title_desc" | "runtime",
  media: "movie" | "tv",
): string {
  switch (sort) {
    case "rating":
      return "vote_average.desc";
    case "newest":
      return media === "movie" ? "primary_release_date.desc" : "first_air_date.desc";
    case "oldest":
      return media === "movie" ? "primary_release_date.asc" : "first_air_date.asc";
    case "title_asc":
      return media === "movie" ? "original_title.asc" : "original_name.asc";
    case "title_desc":
      return media === "movie" ? "original_title.desc" : "original_name.desc";
    case "runtime":
      // TMDB discover has no direct runtime sort for lists; fall back to votes
      return "vote_count.desc";
    case "popularity":
    default:
      return "popularity.desc";
  }
}

/**
 * Fetch a catalog "window" by mapping UI page/pageSize onto TMDB's 20-result pages.
 * Exposes nearly the full TMDB discover universe (up to 500 × 20 = 10,000 titles per query).
 */
async function fetchTmdbDiscoverWindow(opts: {
  path: "/discover/movie" | "/discover/tv";
  baseParams: Record<string, string>;
  page: number;
  pageSize: number;
  map: (raw: Record<string, unknown>) => Content | null;
}): Promise<WorldCatalogPage> {
  const page = Math.max(1, opts.page);
  const pageSize = Math.min(100, Math.max(1, opts.pageSize));
  const tmdbPagesNeeded = Math.max(1, Math.ceil(pageSize / TMDB_PAGE_SIZE));
  const startTmdbPage = (page - 1) * tmdbPagesNeeded + 1;

  if (startTmdbPage > TMDB_MAX_PAGES) {
    return { items: [], page, totalPages: TMDB_MAX_PAGES, total: 0 };
  }

  const pageNums = Array.from(
    { length: tmdbPagesNeeded },
    (_, i) => startTmdbPage + i,
  ).filter((p) => p <= TMDB_MAX_PAGES);

  const responses = await Promise.all(
    pageNums.map((p) =>
      tmdbGet<TmdbListResponse>(opts.path, {
        ...opts.baseParams,
        page: String(p),
      }),
    ),
  );

  const first = responses[0];
  const tmdbTotalPages = Math.min(
    TMDB_MAX_PAGES,
    Math.max(1, first?.total_pages ?? 1),
  );
  const tmdbTotalResults = Math.min(
    tmdbTotalPages * TMDB_PAGE_SIZE,
    first?.total_results ?? 0,
  );

  const items = responses
    .flatMap((r) => r?.results ?? [])
    .map(opts.map)
    .filter(Boolean) as Content[];

  // UI total pages so last catalog page still maps into TMDB
  const totalPages = Math.max(
    1,
    Math.ceil(tmdbTotalPages / tmdbPagesNeeded),
  );

  return {
    items: items.slice(0, pageSize),
    page: Math.min(page, totalPages),
    totalPages,
    total: tmdbTotalResults,
  };
}

/** World movie catalog page (TMDB discover) */
export async function fetchWorldMoviesPage(
  page = 1,
  pageSize = 60,
  sort: "popularity" | "rating" | "newest" | "oldest" | "title_asc" | "title_desc" | "runtime" = "popularity",
  includeAdult = false,
  country?: string,
): Promise<WorldCatalogPage> {
  if (!hasTmdbAccess()) {
    return { items: [], page: 1, totalPages: 1, total: 0 };
  }
  const base: Record<string, string> = {
    sort_by: tmdbSortParam(sort, "movie"),
    include_adult: includeAdult ? "true" : "false",
    language: "en-US",
    region: "US",
  };
  // Country-specific catalog: filter at TMDB discover level
  if (country) {
    base.with_origin_country = country.toUpperCase();
  }
  // Rating/newest need a vote floor so empty stubs don't dominate
  if (sort === "rating") {
    base["vote_count.gte"] = "50";
  }
  return fetchTmdbDiscoverWindow({
    path: "/discover/movie",
    baseParams: base,
    page,
    pageSize,
    map: mapTmdbMovie,
  });
}

/** World TV series catalog — never anime, never Asian dramas (own tabs). */
export async function fetchWorldSeriesPage(
  page = 1,
  pageSize = 60,
  sort: "popularity" | "rating" | "newest" | "oldest" | "title_asc" | "title_desc" | "runtime" = "popularity",
  country?: string,
  includeMature = false,
): Promise<WorldCatalogPage> {
  if (!hasTmdbAccess()) {
    return { items: [], page: 1, totalPages: 1, total: 0 };
  }
  const base: Record<string, string> = {
    sort_by: tmdbSortParam(sort, "tv"),
    language: "en-US",
    include_adult: includeMature ? "true" : "false",
    include_null_first_air_dates: "false",
    // Drop Animation (16) at discover so anime never enters the Series tab.
    without_genres: "16",
  };
  // Country-specific catalog: filter at TMDB discover level
  if (country) {
    base.with_origin_country = country.toUpperCase();
  }
  if (sort === "rating") {
    base["vote_count.gte"] = "40";
  }
  const result = await fetchTmdbDiscoverWindow({
    path: "/discover/tv",
    baseParams: base,
    page,
    pageSize: pageSize + 24, // headroom after dropping anime/dramas
    map: (r) => {
      // Hard-drop Animation genre before mapping
      const genreIds = Array.isArray(r.genre_ids)
        ? (r.genre_ids as number[])
        : [];
      if (genreIds.includes(16)) return null;
      return mapTmdbTv(r, false);
    },
  });

  const { isGeneralSeriesOnly } = await import(
    "@/lib/content/classification"
  );

  // Country pages (e.g. PH series) keep origin filter only — still no anime.
  if (country) {
    const items = result.items
      .filter((c) => c.contentType === "series")
      .filter((c) => !c.animeFormat)
      .filter(
        (c) =>
          !c.genres.some((g) => /anim/i.test(g.name) || g.id === "16"),
      )
      .slice(0, pageSize);
    return { ...result, items };
  }

  const items = result.items
    .filter(isGeneralSeriesOnly)
    .slice(0, pageSize);
  return {
    ...result,
    items,
  };
}

/** World drama catalog for a specific type (K/C/J/Thai) — full origin catalog */
export async function fetchWorldDramaPage(
  type: DramaContentType,
  page = 1,
  pageSize = 60,
  sort: "popularity" | "rating" | "newest" | "oldest" | "title_asc" | "title_desc" | "runtime" = "popularity",
  includeMature = false,
): Promise<WorldCatalogPage> {
  if (!hasTmdbAccess()) {
    return { items: [], page: 1, totalPages: 1, total: 0 };
  }
  const base: Record<string, string> = {
    sort_by: tmdbSortParam(sort, "tv"),
    // Origin country only — pipe-OR across all countries for this type so the
    // full catalog (incl. TW/HK for C-drama) paginates through TMDB.
    with_origin_country: dramaDiscoverCountries(type),
    // Exclude Animation so anime is never mislabeled as live-action drama.
    without_genres: "16",
    include_adult: includeMature ? "true" : "false",
    language: "en-US",
  };
  if (sort === "rating") {
    base["vote_count.gte"] = "20";
  }
  return fetchTmdbDiscoverWindow({
    path: "/discover/tv",
    baseParams: base,
    page,
    pageSize,
    map: (r) => mapTmdbTv(r, type),
  });
}

/** World K-drama catalog — Korean origin + language */
export async function fetchWorldKdramaPage(
  page = 1,
  pageSize = 60,
  sort: "popularity" | "rating" | "newest" | "oldest" | "title_asc" | "title_desc" | "runtime" = "popularity",
): Promise<WorldCatalogPage> {
  return fetchWorldDramaPage("kdrama", page, pageSize, sort);
}

/**
 * World anime catalog page via AniList (series + films) + TMDB anime movies.
 * `formatCategory` optionally narrows to anime films ("movie") or everything
 * else — TV/OVA/ONA/SPECIAL/SHORT ("series").
 */
export async function fetchWorldAnimePage(
  page = 1,
  pageSize = 60,
  sort: "popularity" | "rating" | "newest" | "oldest" | "title_asc" | "title_desc" | "runtime" = "popularity",
  includeMature = false,
  formatCategory?: "movie" | "series",
): Promise<WorldCatalogPage> {
  const isMovieOnly = formatCategory === "movie";
  const isSeriesOnly = formatCategory === "series";
  const perPage = Math.min(50, pageSize);
  // AniList max 50/page — if UI wants 60, fetch 2 AniList pages
  const pagesNeeded = Math.max(1, Math.ceil(pageSize / perPage));
  const start = (Math.max(1, page) - 1) * pagesNeeded + 1;

  const anilistSort =
    sort === "rating"
      ? "SCORE_DESC"
      : sort === "newest"
        ? "START_DATE_DESC"
        : sort === "oldest"
          ? "START_DATE_ASC"
          : sort === "title_asc"
            ? "TITLE_ROMAJI"
            : sort === "title_desc"
              ? "TITLE_ROMAJI_DESC"
              : "POPULARITY_DESC";

  // ── Anime films only: AniList MOVIE format (+ TMDB JP animation films) ──
  if (isMovieOnly) {
    // AniList $isAdult defaults to false — passing null never returns adult
    // content. When mature mode is on we must fetch both safe and adult pages.
    const [moviePages, tmdbFilms] = await Promise.all([
      Promise.all(
        Array.from({ length: pagesNeeded }, (_, i) =>
          fetchAnilistAnimePage({
            page: start + i,
            perPage,
            sort: anilistSort,
            format: "MOVIE",
            isAdult: false,
          }),
        ),
      ).then(async (safe) => {
        if (!includeMature) return safe;
        const adult = await Promise.all(
          Array.from({ length: pagesNeeded }, (_, i) =>
            fetchAnilistAnimePage({
              page: start + i,
              perPage,
              sort: anilistSort,
              format: "MOVIE",
              isAdult: true,
            }),
          ),
        );
        return [...safe, ...adult];
      }),
      page === 1
        ? fetchTmdbAnimeMovies().catch(() => [] as Content[])
        : Promise.resolve([] as Content[]),
    ]);
    const firstM = moviePages[0];
    const seenM = new Set<string>();
    const mergedM: Content[] = [];
    const pushM = (list: Content[]) => {
      for (const c of list) {
        if (!c?.id || seenM.has(c.id)) continue;
        if (!includeMature && c.mature) continue;
        // Guard: keep only actual films.
        if (c.animeFormat && c.animeFormat !== "MOVIE") continue;
        seenM.add(c.id);
        mergedM.push(c);
      }
    };
    if (page === 1) pushM(tmdbFilms.slice(0, 20));
    pushM(moviePages.flatMap((p) => p.items));
    // When mature mode is on, moviePages[] contains both safe and adult results.
    const allTotalPagesM = moviePages.map((p) => p.totalPages ?? 1);
    const allTotalsM = moviePages.map((p) => p.total ?? 0);
    const anilistLastM = Math.max(...allTotalPagesM);
    const anilistTotalM = allTotalsM.reduce((a, b) => a + b, 0);
    const totalPagesM = Math.max(1, Math.ceil(anilistLastM / pagesNeeded));
    return {
      items: mergedM.slice(0, pageSize),
      page: Math.min(Math.max(1, page), totalPagesM),
      totalPages: totalPagesM,
      total: anilistTotalM || mergedM.length,
    };
  }

  // ── Anime series only (TV / OVA / ONA / SPECIAL / SHORT) ──
  // Request TV pages explicitly so the Series tab never comes back empty
  // when AniList’s unfiltered mix is flaky or movie-skewed.
  if (isSeriesOnly) {
    const seriesFormats = ["TV", "OVA", "ONA", "SPECIAL"] as const;
    const seriesPages = await Promise.all(
      seriesFormats.map((format) =>
        Promise.all(
          Array.from({ length: pagesNeeded }, (_, i) =>
            fetchAnilistAnimePage({
              page: start + i,
              perPage,
              sort: anilistSort,
              format,
              isAdult: false,
            }),
          ),
        ).then(async (safe) => {
          if (!includeMature) return safe;
          const adult = await Promise.all(
            Array.from({ length: pagesNeeded }, (_, i) =>
              fetchAnilistAnimePage({
                page: start + i,
                perPage,
                sort: anilistSort,
                format,
                isAdult: true,
              }),
            ),
          );
          return [...safe, ...adult];
        }),
      ),
    );

    const seenS = new Set<string>();
    const mergedS: Content[] = [];
    const pushS = (list: Content[]) => {
      for (const c of list) {
        if (!c?.id || seenS.has(c.id)) continue;
        if (!includeMature && c.mature) continue;
        // Never show theatrical films in the Series catalog.
        if (c.animeFormat === "MOVIE") continue;
        // Prefer explicit series formats; also keep items with no format set.
        if (
          c.animeFormat &&
          c.animeFormat !== "TV" &&
          c.animeFormat !== "OVA" &&
          c.animeFormat !== "ONA" &&
          c.animeFormat !== "SPECIAL" &&
          c.animeFormat !== "SHORT"
        ) {
          continue;
        }
        seenS.add(c.id);
        mergedS.push(c);
      }
    };
    for (const fmtPages of seriesPages) {
      pushS(fmtPages.flatMap((p) => p.items));
    }
    // Popularity-first ordering for the series tab
    mergedS.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));

    const flatPages = seriesPages.flat();
    const allTotalPagesS = flatPages.map((p) => p.totalPages ?? 1);
    const allTotalsS = flatPages.map((p) => p.total ?? 0);
    const anilistLastS = Math.max(1, ...allTotalPagesS);
    const anilistTotalS = allTotalsS.reduce((a, b) => a + b, 0);
    const totalPagesS = Math.max(1, Math.ceil(anilistLastS / pagesNeeded));

    return {
      items: mergedS.slice(0, pageSize),
      page: Math.min(Math.max(1, page), totalPagesS),
      totalPages: totalPagesS,
      total: anilistTotalS || mergedS.length,
    };
  }

  // ── Mixed anime catalog (series + films) ──
  // Interleave dedicated MOVIE-format pages so theatrical anime surfaces
  // alongside series (AniList all-format pages skew heavily to TV).
  const injectMovies = page === 1 || page % 3 === 0;
  const moviePage = Math.max(1, Math.ceil(page / 3));

  const [pages, moviePageResult, tmdbAnimeMovies] = await Promise.all([
    Promise.all(
      Array.from({ length: pagesNeeded }, (_, i) =>
        fetchAnilistAnimePage({
          page: start + i,
          perPage,
          sort: anilistSort,
          isAdult: false,
        }),
      ),
    ).then(async (safe) => {
      if (!includeMature) return safe;
      const adult = await Promise.all(
        Array.from({ length: pagesNeeded }, (_, i) =>
          fetchAnilistAnimePage({
            page: start + i,
            perPage,
            sort: anilistSort,
            isAdult: true,
          }),
        ),
      );
      return [...safe, ...adult];
    }),
    injectMovies
      ? fetchAnilistAnimePage({
          page: moviePage,
          perPage: Math.min(25, perPage),
          sort: anilistSort,
          format: "MOVIE",
          isAdult: false,
        })
          .then(async (safe) => {
            if (!includeMature) return safe;
            const adult = await fetchAnilistAnimePage({
              page: moviePage,
              perPage: Math.min(25, perPage),
              sort: anilistSort,
              format: "MOVIE",
              isAdult: true,
            });
            return {
              items: [...safe.items, ...(adult?.items ?? [])],
              total: safe.total + (adult?.total ?? 0),
              totalPages: Math.max(safe.totalPages, adult?.totalPages ?? 1),
            };
          })
          .catch(() => ({ items: [] as Content[], total: 0, totalPages: 1 }))
      : Promise.resolve({ items: [] as Content[], total: 0, totalPages: 1 }),
    page === 1
      ? fetchTmdbAnimeMovies().catch(() => [] as Content[])
      : Promise.resolve([] as Content[]),
  ]);

  const seen = new Set<string>();
  const merged: Content[] = [];
  const push = (list: Content[]) => {
    for (const c of list) {
      if (!c?.id || seen.has(c.id)) continue;
      if (!includeMature && c.mature) continue;
      seen.add(c.id);
      merged.push(c);
    }
  };

  // Surface anime films early on page 1, then series popularity mix
  if (page === 1) {
    push(moviePageResult.items);
    push(tmdbAnimeMovies.slice(0, 20));
  }
  push(pages.flatMap((p) => p.items));
  if (page > 1) push(moviePageResult.items);

  const items = merged.slice(0, pageSize);

  const allTotalPages = pages.map((p) => p.totalPages ?? 1);
  const allTotals = pages.map((p) => p.total ?? 0);
  const anilistLast = Math.max(1, ...allTotalPages);
  const anilistTotal = allTotals.reduce((a, b) => a + b, 0);
  const totalPages = Math.max(1, Math.ceil(anilistLast / pagesNeeded));
  const total = anilistTotal + (moviePageResult.total ?? 0);

  return {
    items,
    page: Math.min(Math.max(1, page), totalPages),
    totalPages,
    total,
  };
}

/** Bulk multi-page TMDB fetch for home/cache warm */
async function tmdbFetchManyPages(
  path: string,
  baseParams: Record<string, string>,
  pages: number,
): Promise<Record<string, unknown>[]> {
  const count = Math.min(pages, 25);
  const responses = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      tmdbGet<TmdbListResponse>(path, {
        ...baseParams,
        page: String(i + 1),
      }),
    ),
  );
  return responses.flatMap((r) => r?.results ?? []);
}

/**
 * Heuristic adult-content detection for TMDB titles.
 *
 * TMDB's `adult` boolean only flags outright pornography, so mainstream 18+
 * films — especially the large Filipino (Vivamax-style) and other regional
 * softcore/erotic-drama categories, plus NC-17/R-18 releases — slip through
 * with `adult:false` and no age rating. This scans the title + overview for
 * explicit-sexual signals so those titles get an "18+" rating and are hidden
 * when the mature toggle is off.
 */
const TMDB_ADULT_OVERVIEW =
  /\b(erotic|erotica|softcore|hardcore|sexual|sensual|seduc|explicit sex|sex scene|sexually|nudity|nude|lust|infidelity affair|adult film|pornograph|xxx|bold film|sultry|steamy affair)\b/i;

const TMDB_ADULT_TITLE =
  /\b(sex|erotic|erotica|xxx|18\+|r-?18|bold|bare|naked|seduction|lust|desire uncut|uncut|kinky)\b/i;

export function tmdbLooksAdult(
  title: string,
  overview: string,
  rawAdult: boolean,
): boolean {
  if (rawAdult) return true;
  if (TMDB_ADULT_OVERVIEW.test(overview)) return true;
  // Title signal alone is weaker (false positives like "Sex Education" exist),
  // so require a title hit AND at least a soft overview corroboration.
  if (TMDB_ADULT_TITLE.test(title) && /\b(affair|desire|passion|body|night|seduc|lust|nude|bed|lover)\b/i.test(overview)) {
    return true;
  }
  return false;
}

function mapTmdbMovie(raw: Record<string, unknown>): Content | null {
  const id = Number(raw.id);
  const title = String(raw.title ?? raw.name ?? "");
  if (!title || !id) return null;
  const posterPath = raw.poster_path ? String(raw.poster_path) : null;
  const backdropPath = raw.backdrop_path ? String(raw.backdrop_path) : null;
  const release = raw.release_date ? String(raw.release_date) : null;
  const lang = raw.original_language
    ? String(raw.original_language)
    : null;
  const origin = Array.isArray(raw.origin_country)
    ? (raw.origin_country as string[])
    : [];
  const genreIds = Array.isArray(raw.genre_ids)
    ? (raw.genre_ids as number[])
    : Array.isArray(raw.genres)
      ? (raw.genres as Array<{ id?: number }>).map((g) => Number(g.id)).filter(Boolean)
      : [];

  // Movies catalog keeps every theatrical title as contentType=movie so the
  // full TMDB movie universe stays browseable. Anime films are ALSO mapped
  // into the Anime tab via mapTmdbAnimeMovie / AniList MOVIE.
  const genres =
    genreIds.length > 0
      ? genreIds.map((gid) => ({
          id: String(gid),
          name: gid === 16 ? "Animation" : `Genre ${gid}`,
        }))
      : [];

  const overview = String(raw.overview ?? "");
  const isAdult = tmdbLooksAdult(title, overview, Boolean(raw.adult));
  const baseTags = lang === "ja" && genreIds.includes(16) ? ["animation", "jp"] : [];

  return safeParse({
    id: `tmdb_movie_${id}`,
    slug: slugify(`${title}-${id}`),
    contentType: "movie",
    title,
    originalTitle: raw.original_title
      ? String(raw.original_title)
      : undefined,
    overview,
    poster: posterPath
      ? { url: tmdbPoster(posterPath)!, source: "tmdb" }
      : { url: posterFallback(title, 0x111827), source: "local" },
    backdrop: backdropPath
      ? { url: tmdbPoster(backdropPath, "w1280")!, source: "tmdb" }
      : null,
    releaseDate: release,
    year: release ? Number(release.slice(0, 4)) : null,
    status: "released",
    language: lang,
    countries: origin,
    genres,
    runtime: raw.runtime != null ? Number(raw.runtime) : null,
    seasonCount: null,
    episodeCount: null,
    ageRating: isAdult ? "18+" : null,
    scores: raw.vote_average
      ? [
          {
            source: "tmdb",
            score: Number(raw.vote_average),
            count: raw.vote_count ? Number(raw.vote_count) : undefined,
          },
        ]
      : [],
    popularity: Number(raw.popularity ?? 0),
    trailer: null,
    watchProviders: [],
    providerIds: { tmdb: id, tmdbMediaType: "movie" },
    studios: [],
    tags: isAdult ? [...baseTags, "18+", "mature", "adult"] : baseTags,
    alternateTitles: [],
    approved: true,
    mature: isAdult,
    lastSyncedAt: new Date().toISOString(),
  });
}

/**
 * Map a TMDB Japanese Animation film into the Anime catalog
 * (contentType=anime, animeFormat=MOVIE) for the Anime tab.
 */
function mapTmdbAnimeMovie(raw: Record<string, unknown>): Content | null {
  const id = Number(raw.id);
  const title = String(raw.title ?? raw.name ?? "");
  if (!title || !id) return null;
  const posterPath = raw.poster_path ? String(raw.poster_path) : null;
  const backdropPath = raw.backdrop_path ? String(raw.backdrop_path) : null;
  const release = raw.release_date ? String(raw.release_date) : null;
  const lang = raw.original_language
    ? String(raw.original_language)
    : "ja";

  return safeParse({
    id: `tmdb_anime_movie_${id}`,
    slug: slugify(`${title}-${id}`),
    contentType: "anime",
    title,
    originalTitle: raw.original_title
      ? String(raw.original_title)
      : undefined,
    overview: String(raw.overview ?? ""),
    poster: posterPath
      ? { url: tmdbPoster(posterPath)!, source: "tmdb" }
      : { url: posterFallback(title, 0x7867ff), source: "local" },
    backdrop: backdropPath
      ? { url: tmdbPoster(backdropPath, "w1280")!, source: "tmdb" }
      : null,
    releaseDate: release,
    year: release ? Number(release.slice(0, 4)) : null,
    status: "released",
    language: lang,
    countries: ["JP"],
    genres: [{ id: "animation", name: "Animation" }],
    runtime: raw.runtime != null ? Number(raw.runtime) : null,
    seasonCount: null,
    episodeCount: 1,
    ageRating: raw.adult ? "18+" : null,
    scores: raw.vote_average
      ? [
          {
            source: "tmdb",
            score: Number(raw.vote_average),
            count: raw.vote_count ? Number(raw.vote_count) : undefined,
          },
        ]
      : [],
    popularity: Number(raw.popularity ?? 0),
    trailer: null,
    watchProviders: [],
    providerIds: { tmdb: id, tmdbMediaType: "movie" },
    animeFormat: "MOVIE",
    studios: [],
    tags: ["anime", "anime-movie", "film"],
    alternateTitles: [],
    approved: true,
    mature: Boolean(raw.adult),
    lastSyncedAt: new Date().toISOString(),
  });
}

/** Theatrical / anime films from TMDB for the Anime catalog */
export async function fetchTmdbAnimeMovies(): Promise<Content[]> {
  if (!hasTmdbAccess()) return [];
  const rows = await tmdbFetchManyPages(
    "/discover/movie",
    {
      sort_by: "popularity.desc",
      with_genres: "16",
      with_original_language: "ja",
      region: "US",
      language: "en-US",
      "vote_count.gte": "10",
    },
    15,
  );
  return rows.map(mapTmdbAnimeMovie).filter(Boolean) as Content[];
}

function mapTmdbTv(
  raw: Record<string, unknown>,
  asDrama: DramaContentType | boolean = false,
): Content | null {
  const id = Number(raw.id);
  const title = String(raw.name ?? raw.title ?? "");
  if (!title || !id) return null;
  const posterPath = raw.poster_path ? String(raw.poster_path) : null;
  const backdropPath = raw.backdrop_path ? String(raw.backdrop_path) : null;
  const release = raw.first_air_date ? String(raw.first_air_date) : null;
  const origin = Array.isArray(raw.origin_country)
    ? (raw.origin_country as string[])
    : [];
  const lang = raw.original_language
    ? String(raw.original_language)
    : null;
  const genreIds = Array.isArray(raw.genre_ids)
    ? (raw.genre_ids as number[])
    : Array.isArray(raw.genres)
      ? (raw.genres as Array<{ id?: number }>).map((g) => Number(g.id)).filter(Boolean)
      : [];
  const isAnimation = genreIds.includes(16);
  const genres =
    genreIds.length > 0
      ? genreIds.map((gid) => ({
          id: String(gid),
          name: gid === 16 ? "Animation" : `Genre ${gid}`,
        }))
      : [];

  // `asDrama` can force a specific type (or true = kdrama for back-compat).
  const forced: DramaContentType | null =
    asDrama === true ? "kdrama" : asDrama === false ? null : asDrama;

  // Animation TV → anime tab, never general series.
  if (isAnimation && !forced) {
    const overview = String(raw.overview ?? "");
    const isAdult = tmdbLooksAdult(title, overview, Boolean(raw.adult));
    return safeParse({
      id: `tmdb_tv_${id}`,
      slug: slugify(`${title}-${id}`),
      contentType: "anime",
      title,
      originalTitle: raw.original_name
        ? String(raw.original_name)
        : undefined,
      overview,
      poster: posterPath
        ? { url: tmdbPoster(posterPath)!, source: "tmdb" }
        : { url: posterFallback(title, 0x7867ff), source: "local" },
      backdrop: backdropPath
        ? { url: tmdbPoster(backdropPath, "w1280")!, source: "tmdb" }
        : null,
      releaseDate: release,
      year: release ? Number(release.slice(0, 4)) : null,
      status: "released",
      language: lang,
      countries: origin,
      genres,
      runtime: null,
      seasonCount:
        raw.number_of_seasons != null ? Number(raw.number_of_seasons) : null,
      episodeCount:
        raw.number_of_episodes != null ? Number(raw.number_of_episodes) : null,
      ageRating: isAdult ? "18+" : null,
      scores: raw.vote_average
        ? [{ source: "tmdb", score: Number(raw.vote_average) }]
        : [],
      popularity: Number(raw.popularity ?? 0),
      trailer: null,
      watchProviders: [],
      providerIds: { tmdb: id, tmdbMediaType: "tv" },
      studios: [],
      tags: isAdult
        ? ["18+", "mature", "adult", "anime", "animation"]
        : ["anime", "animation"],
      alternateTitles: [],
      animeFormat: "TV",
      approved: true,
      mature: isAdult,
      lastSyncedAt: new Date().toISOString(),
    });
  }

  const dramaType =
    forced ??
    classifyDrama({
      isTv: true,
      originalLanguage: lang,
      originCountries: origin,
      genres,
    });
  const isDrama = dramaType != null;
  const overview = String(raw.overview ?? "");
  const isAdult = tmdbLooksAdult(title, overview, Boolean(raw.adult));
  return safeParse({
    id: isDrama ? `tmdb_${dramaType}_${id}` : `tmdb_tv_${id}`,
    slug: slugify(`${title}-${id}`),
    contentType: dramaType ?? "series",
    title,
    originalTitle: raw.original_name
      ? String(raw.original_name)
      : undefined,
    overview,
    poster: posterPath
      ? { url: tmdbPoster(posterPath)!, source: "tmdb" }
      : {
          url: posterFallback(title, isDrama ? 0x5c1a2e : 0x172033),
          source: "local",
        },
    backdrop: backdropPath
      ? { url: tmdbPoster(backdropPath, "w1280")!, source: "tmdb" }
      : null,
    releaseDate: release,
    year: release ? Number(release.slice(0, 4)) : null,
    status: "released",
    language: lang,
    countries: origin,
    genres,
    runtime: null,
    seasonCount: raw.number_of_seasons != null
      ? Number(raw.number_of_seasons)
      : null,
    episodeCount: raw.number_of_episodes != null
      ? Number(raw.number_of_episodes)
      : null,
    ageRating: isAdult ? "18+" : null,
    scores: raw.vote_average
      ? [{ source: "tmdb", score: Number(raw.vote_average) }]
      : [],
    popularity: Number(raw.popularity ?? 0),
    trailer: null,
    watchProviders: [],
    providerIds: { tmdb: id, tmdbMediaType: "tv" },
    studios: [],
    tags: isAdult ? ["18+", "mature", "adult"] : [],
    alternateTitles: [],
    approved: true,
    mature: isAdult,
    lastSyncedAt: new Date().toISOString(),
  });
}

/**
 * Explicit sexual mature library from TMDB (metadata only — never streams).
 * ONLY nudity / sex / erotica / adult-flagged titles — not general R, horror, or TV-MA crime.
 *
 * Keyword ids (TMDB):
 *  9672 male nudity · 9673 female nudity · 155477 erotic · 190370 sex
 */
export async function fetchTmdbMature(): Promise<Content[]> {
  // Nudity / sex / erotic keywords (OR)
  const sexualKw = "9673|9672|155477|190370|12564|249790";

  const [
    adultMovies1,
    adultMovies2,
    adultMovies3,
    nc17,
    movieNudity,
    movieErotic,
    movieSexKw,
    movieSexP2,
    tvNudity,
    tvErotic,
    tvSexP3,
    tvDramaSex,
  ] = await Promise.all([
    tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/movie", {
      sort_by: "popularity.desc",
      include_adult: "true",
      "vote_count.gte": "3",
      page: "1",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/movie", {
      sort_by: "popularity.desc",
      include_adult: "true",
      "vote_count.gte": "3",
      page: "2",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/movie", {
      sort_by: "popularity.desc",
      include_adult: "true",
      "vote_count.gte": "3",
      page: "3",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/movie", {
      sort_by: "popularity.desc",
      certification_country: "US",
      certification: "NC-17",
      "vote_count.gte": "5",
      page: "1",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/movie", {
      sort_by: "popularity.desc",
      with_keywords: sexualKw,
      "vote_count.gte": "20",
      page: "1",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/movie", {
      sort_by: "popularity.desc",
      with_keywords: sexualKw,
      "vote_count.gte": "15",
      page: "2",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/movie", {
      sort_by: "vote_count.desc",
      with_keywords: "9673|9672",
      "vote_count.gte": "30",
      page: "1",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/movie", {
      sort_by: "popularity.desc",
      with_keywords: "9673|155477",
      "vote_count.gte": "20",
      page: "3",
    }),
    // Series only (not forced K-drama) with sexual keywords
    tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/tv", {
      sort_by: "popularity.desc",
      with_keywords: sexualKw,
      "vote_count.gte": "15",
      page: "1",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/tv", {
      sort_by: "popularity.desc",
      with_keywords: "9673|9672|155477",
      "vote_count.gte": "10",
      page: "2",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/tv", {
      sort_by: "popularity.desc",
      with_keywords: sexualKw,
      "vote_count.gte": "10",
      page: "3",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/tv", {
      sort_by: "popularity.desc",
      with_genres: "18",
      with_keywords: "9673|9672",
      "vote_count.gte": "25",
      page: "1",
    }),
  ]);

  const markExplicit = (
    c: Content | null,
    extraTags: string[] = [],
  ): Content | null => {
    if (!c) return null;
    // Mature library: movies / series / anime only — drop K-drama
    if (c.contentType === "kdrama") return null;
    return {
      ...c,
      mature: true,
      ageRating: c.ageRating || "18+",
      tags: Array.from(
        new Set([
          ...(c.tags ?? []),
          "18+",
          "mature",
          "explicit",
          "nudity",
          ...extraTags,
        ]),
      ),
    };
  };

  const mappedMovies = [
    ...(adultMovies1?.results ?? []),
    ...(adultMovies2?.results ?? []),
    ...(adultMovies3?.results ?? []),
    ...(nc17?.results ?? []),
    ...(movieNudity?.results ?? []),
    ...(movieErotic?.results ?? []),
    ...(movieSexKw?.results ?? []),
    ...(movieSexP2?.results ?? []),
  ]
    .map((r) =>
      markExplicit(mapTmdbMovie(r), [
        Boolean(r.adult) ? "adult" : "sexual-content",
        "explicit",
        "nudity",
      ]),
    )
    .filter(Boolean) as Content[];

  // Force series (not kdrama) for TV results
  const mappedTv = [
    ...(tvNudity?.results ?? []),
    ...(tvErotic?.results ?? []),
    ...(tvSexP3?.results ?? []),
    ...(tvDramaSex?.results ?? []),
  ]
    .map((r) => {
      const c = mapTmdbTv(r, false);
      if (!c) return null;
      // Skip Korean-origin if classified as kdrama — re-tag as series only when explicit
      const series: Content = {
        ...c,
        contentType: "series",
        id: c.id.replace("tmdb_kdrama_", "tmdb_tv_"),
      };
      return markExplicit(series, ["sexual-content", "nudity", "explicit"]);
    })
    .filter(Boolean) as Content[];

  return [...mappedMovies, ...mappedTv];
}

export async function fetchTmdbMovies(): Promise<Content[]> {
  // Warm cache: deep popular + top + now + multi-genre (world-scale browse is paginated on demand)
  const [popular, top, now, upcoming, action, comedy, scifi, thriller, horror, romance, drama, adventure] =
    await Promise.all([
      tmdbFetchManyPages("/discover/movie", {
        sort_by: "popularity.desc",
        include_adult: "false",
        region: "US",
        language: "en-US",
      }, 20),
      tmdbFetchManyPages("/movie/top_rated", { region: "US", language: "en-US" }, 8),
      tmdbFetchManyPages("/movie/now_playing", { region: "US", language: "en-US" }, 4),
      tmdbFetchManyPages("/movie/upcoming", { region: "US", language: "en-US" }, 3),
      tmdbFetchManyPages("/discover/movie", {
        sort_by: "popularity.desc",
        with_genres: "28",
        "vote_count.gte": "50",
        region: "US",
      }, 3),
      tmdbFetchManyPages("/discover/movie", {
        sort_by: "popularity.desc",
        with_genres: "35",
        "vote_count.gte": "50",
        region: "US",
      }, 3),
      tmdbFetchManyPages("/discover/movie", {
        sort_by: "popularity.desc",
        with_genres: "878",
        "vote_count.gte": "40",
        region: "US",
      }, 3),
      tmdbFetchManyPages("/discover/movie", {
        sort_by: "popularity.desc",
        with_genres: "53",
        "vote_count.gte": "40",
        region: "US",
      }, 3),
      tmdbFetchManyPages("/discover/movie", {
        sort_by: "popularity.desc",
        with_genres: "27",
        "vote_count.gte": "30",
        region: "US",
      }, 3),
      tmdbFetchManyPages("/discover/movie", {
        sort_by: "popularity.desc",
        with_genres: "10749",
        "vote_count.gte": "30",
        region: "US",
      }, 3),
      tmdbFetchManyPages("/discover/movie", {
        sort_by: "popularity.desc",
        with_genres: "18",
        "vote_count.gte": "50",
        region: "US",
      }, 3),
      tmdbFetchManyPages("/discover/movie", {
        sort_by: "popularity.desc",
        with_genres: "12",
        "vote_count.gte": "40",
        region: "US",
      }, 3),
    ]);
  return [
    ...popular,
    ...top,
    ...now,
    ...upcoming,
    ...action,
    ...comedy,
    ...scifi,
    ...thriller,
    ...horror,
    ...romance,
    ...drama,
    ...adventure,
  ]
    .map(mapTmdbMovie)
    .filter(Boolean) as Content[];
}

/**
 * Popular movies for a specific origin country (Korean / Japanese / Chinese /
 * Thai / Filipino …). Feeds the homepage "Popular {country} movies" rows and
 * warms the country movie catalog. Tagged popular so todayOnly() surfaces them.
 */
export async function fetchTmdbMoviesByCountry(
  country: string,
  includeMature = false,
): Promise<Content[]> {
  const cc = country.toUpperCase();
  const adult = includeMature ? "true" : "false";
  const [popular, top, recent] = await Promise.all([
    tmdbFetchManyPages(
      "/discover/movie",
      {
        with_origin_country: cc,
        sort_by: "popularity.desc",
        include_adult: adult,
        language: "en-US",
      },
      8,
    ),
    tmdbFetchManyPages(
      "/discover/movie",
      {
        with_origin_country: cc,
        sort_by: "vote_average.desc",
        "vote_count.gte": "20",
        include_adult: adult,
        language: "en-US",
      },
      4,
    ),
    tmdbFetchManyPages(
      "/discover/movie",
      {
        with_origin_country: cc,
        sort_by: "primary_release_date.desc",
        "primary_release_date.lte": new Date().toISOString().slice(0, 10),
        "vote_count.gte": "5",
        include_adult: adult,
        language: "en-US",
      },
      4,
    ),
  ]);
  return [...popular, ...top, ...recent]
    .map(mapTmdbMovie)
    .map((c) =>
      c
        ? {
            ...c,
            tags: Array.from(
              new Set([...(c.tags ?? []), "trending-today", "popular"]),
            ),
          }
        : c,
    )
    .filter(Boolean) as Content[];
}

/**
 * Popular live-action series for a specific origin country, EXCLUDING animation
 * (anime) and drama-classified titles handled elsewhere. Feeds the homepage
 * "Popular {country} series" rows.
 */
export async function fetchTmdbSeriesByCountry(
  country: string,
  includeMature = false,
): Promise<Content[]> {
  const cc = country.toUpperCase();
  const adult = includeMature ? "true" : "false";
  const [popular, recent] = await Promise.all([
    tmdbFetchManyPages(
      "/discover/tv",
      {
        with_origin_country: cc,
        without_genres: "16",
        include_adult: adult,
        sort_by: "popularity.desc",
        language: "en-US",
      },
      8,
    ),
    tmdbFetchManyPages(
      "/discover/tv",
      {
        with_origin_country: cc,
        without_genres: "16",
        include_adult: adult,
        sort_by: "first_air_date.desc",
        "vote_count.gte": "5",
        language: "en-US",
      },
      4,
    ),
  ]);
  return [...popular, ...recent]
    .map((r) => mapTmdbTv(r))
    .map((c) =>
      c
        ? {
            ...c,
            tags: Array.from(
              new Set([...(c.tags ?? []), "trending-today", "popular"]),
            ),
          }
        : c,
    )
    .filter(Boolean) as Content[];
}

export async function fetchTmdbSeries(): Promise<Content[]> {
  const [popular, top, airing, drama, crime, scifi, comedy, action] =
    await Promise.all([
      tmdbFetchManyPages("/discover/tv", {
        sort_by: "popularity.desc",
        language: "en-US",
      }, 18),
      tmdbFetchManyPages("/tv/top_rated", { language: "en-US" }, 6),
      tmdbFetchManyPages("/tv/on_the_air", { language: "en-US" }, 4),
      tmdbFetchManyPages("/discover/tv", {
        sort_by: "popularity.desc",
        with_genres: "18",
        "vote_count.gte": "40",
      }, 3),
      tmdbFetchManyPages("/discover/tv", {
        sort_by: "popularity.desc",
        with_genres: "80",
        "vote_count.gte": "40",
      }, 3),
      tmdbFetchManyPages("/discover/tv", {
        sort_by: "popularity.desc",
        with_genres: "10765",
        "vote_count.gte": "30",
      }, 3),
      tmdbFetchManyPages("/discover/tv", {
        sort_by: "popularity.desc",
        with_genres: "35",
        "vote_count.gte": "30",
      }, 3),
      tmdbFetchManyPages("/discover/tv", {
        sort_by: "popularity.desc",
        with_genres: "10759",
        "vote_count.gte": "30",
      }, 3),
    ]);
  return [
    ...popular,
    ...top,
    ...airing,
    ...drama,
    ...crime,
    ...scifi,
    ...comedy,
    ...action,
  ]
    .map((r) => mapTmdbTv(r))
    .filter(Boolean) as Content[];
}

export async function fetchTmdbTrending(): Promise<Content[]> {
  const [week, day, moviesDay, tvDay, animeDay, kdramaDay] = await Promise.all([
    tmdbGet<{ results?: Record<string, unknown>[] }>("/trending/all/week"),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/trending/all/day"),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/trending/movie/day"),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/trending/tv/day"),
    // Trending animation / anime (JP origin)
    tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/tv", {
      with_genres: "16",
      with_original_language: "ja",
      sort_by: "popularity.desc",
      "vote_count.gte": "20",
      page: "1",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/tv", {
      with_origin_country: "KR",
      with_original_language: "ko",
      sort_by: "popularity.desc",
      page: "1",
    }),
  ]);

  const fromMixed = [...(week?.results ?? []), ...(day?.results ?? [])].map(
    (r) => (r.media_type === "tv" ? mapTmdbTv(r) : mapTmdbMovie(r)),
  );
  const fromMovies = (moviesDay?.results ?? []).map((r) => mapTmdbMovie(r));
  const fromTv = (tvDay?.results ?? []).map((r) => mapTmdbTv(r));
  const fromAnime = (animeDay?.results ?? []).map((r) => {
    const c = mapTmdbTv(r);
    if (!c) return null;
    return {
      ...c,
      contentType: "anime" as const,
      id: c.id.startsWith("tmdb_") ? c.id.replace("tmdb_tv_", "tmdb_anime_") : c.id,
      tags: Array.from(new Set([...(c.tags ?? []), "trending-today", "anime"])),
    };
  });
  const fromKdrama = (kdramaDay?.results ?? []).map((r) => mapTmdbTv(r, true));

  return [
    ...fromMovies,
    ...fromTv,
    ...fromAnime,
    ...fromKdrama,
    ...fromMixed,
  ].filter(Boolean) as Content[];
}

/** Explicit day-trending buckets for homepage featured (US market) */
export async function fetchTrendingTodayByType(): Promise<{
  movies: Content[];
  series: Content[];
  anime: Content[];
  kdrama: Content[];
}> {
  const [
    moviesDay,
    tvDay,
    animeDay,
    animeDay2,
    kdramaDay,
    kdramaDay2,
    popularMovies,
    popularMovies2,
    popularTv,
    popularTv2,
  ] = await Promise.all([
      tmdbGet<{ results?: Record<string, unknown>[] }>("/trending/movie/day"),
      tmdbGet<{ results?: Record<string, unknown>[] }>("/trending/tv/day"),
      tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/tv", {
        with_genres: "16",
        with_original_language: "ja",
        sort_by: "popularity.desc",
        "vote_count.gte": "30",
        page: "1",
      }),
      tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/tv", {
        with_genres: "16",
        with_original_language: "ja",
        sort_by: "popularity.desc",
        "vote_count.gte": "20",
        page: "2",
      }),
      tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/tv", {
        with_origin_country: "KR",
        with_original_language: "ko",
        sort_by: "popularity.desc",
        page: "1",
      }),
      tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/tv", {
        with_origin_country: "KR",
        with_original_language: "ko",
        sort_by: "popularity.desc",
        page: "2",
      }),
      tmdbGet<{ results?: Record<string, unknown>[] }>("/movie/popular", {
        region: "US",
        page: "1",
      }),
      tmdbGet<{ results?: Record<string, unknown>[] }>("/movie/popular", {
        region: "US",
        page: "2",
      }),
      tmdbGet<{ results?: Record<string, unknown>[] }>("/tv/popular", {
        page: "1",
      }),
      tmdbGet<{ results?: Record<string, unknown>[] }>("/tv/popular", {
        page: "2",
      }),
    ]);

  const movies = [
    ...(moviesDay?.results ?? []),
    ...(popularMovies?.results ?? []),
    ...(popularMovies2?.results ?? []),
  ]
    .map((r) => {
      const c = mapTmdbMovie(r);
      if (!c) return null;
      return {
        ...c,
        tags: Array.from(new Set([...(c.tags ?? []), "trending-today", "popular"])),
        popularity: (c.popularity ?? 0) + 50,
      };
    })
    .filter(Boolean) as Content[];

  const series = [
    ...(tvDay?.results ?? []),
    ...(popularTv?.results ?? []),
    ...(popularTv2?.results ?? []),
  ]
    .map((r) => {
      const c = mapTmdbTv(r);
      if (!c || c.contentType === "kdrama") return null;
      // Exclude JP animation from generic series when possible
      if (c.language === "ja" && c.genres.some((g) => /anim/i.test(g.name))) {
        return null;
      }
      return {
        ...c,
        tags: Array.from(new Set([...(c.tags ?? []), "trending-today", "popular"])),
        popularity: (c.popularity ?? 0) + 40,
      };
    })
    .filter(Boolean) as Content[];

  const anime = [...(animeDay?.results ?? []), ...(animeDay2?.results ?? [])]
    .map((r) => {
      const c = mapTmdbTv(r);
      if (!c) return null;
      return {
        ...c,
        contentType: "anime" as const,
        id: c.id.replace("tmdb_tv_", "tmdb_anime_"),
        tags: Array.from(new Set([...(c.tags ?? []), "trending-today", "popular", "anime"])),
        popularity: (c.popularity ?? 0) + 45,
      };
    })
    .filter(Boolean) as Content[];

  const kdrama = [
    ...(kdramaDay?.results ?? []),
    ...(kdramaDay2?.results ?? []),
  ]
    .map((r) => {
      const c = mapTmdbTv(r, true);
      if (!c) return null;
      return {
        ...c,
        tags: Array.from(
          new Set([...(c.tags ?? []), "trending-today", "popular", "kdrama"]),
        ),
        popularity: (c.popularity ?? 0) + 42,
      };
    })
    .filter(Boolean) as Content[];

  return { movies, series, anime, kdrama };
}

/**
 * TMDB discover filters for a given drama type.
 *
 * Filters by ORIGIN COUNTRY only (the definitional signal for a national drama),
 * pipe-OR across every 2-letter ISO-3166 code in DRAMA_META so the FULL catalog
 * surfaces — e.g. C-drama covers Mainland (CN), Taiwan (TW) and Hong Kong (HK),
 * not just CN. Language is intentionally NOT constrained here: adding
 * `with_original_language` can only subtract (e.g. drop a Cantonese/Hokkien
 * Taiwanese series), never widen. TMDB rejects 3-letter codes on discover.
 */
function dramaDiscoverCountries(type: DramaContentType): string {
  const countries = Array.from(
    new Set(DRAMA_META[type].countries.filter((c) => c.length === 2)),
  );
  return countries.join("|"); // pipe = OR
}

export async function fetchTmdbDrama(
  type: DramaContentType,
  includeMature = false,
): Promise<Content[]> {
  const country = dramaDiscoverCountries(type);
  // Exclude Animation (16) so anime never gets mislabeled as a live-action
  // drama — critical for J-drama (JP origin includes anime).
  const base = {
    with_origin_country: country,
    without_genres: "16",
    include_adult: includeMature ? "true" : "false",
    language: "en-US",
  };
  const [popular, top, newest, all] = await Promise.all([
    tmdbFetchManyPages(
      "/discover/tv",
      { ...base, sort_by: "popularity.desc" },
      30,
    ),
    tmdbFetchManyPages(
      "/discover/tv",
      { ...base, sort_by: "vote_average.desc", "vote_count.gte": "20" },
      10,
    ),
    tmdbFetchManyPages(
      "/discover/tv",
      { ...base, sort_by: "first_air_date.desc" },
      10,
    ),
    // No vote floor — pull the long tail so obscure/older titles are included.
    tmdbFetchManyPages(
      "/discover/tv",
      {
        ...base,
        sort_by: "first_air_date.desc",
        "first_air_date.lte": new Date().toISOString().slice(0, 10),
      },
      20,
    ),
  ]);
  return [...popular, ...top, ...newest, ...all]
    .map((r) => mapTmdbTv(r, type))
    .filter(Boolean) as Content[];
}

export async function fetchTmdbKdrama(): Promise<Content[]> {
  return fetchTmdbDrama("kdrama");
}

export async function fetchTmdbWatchProviders(
  mediaType: "movie" | "tv",
  id: number,
  region = "US",
): Promise<WatchProvider[]> {
  const data = await tmdbGet<{
    results?: Record<
      string,
      {
        link?: string;
        flatrate?: Array<{
          provider_id?: number;
          provider_name?: string;
          logo_path?: string | null;
          display_priority?: number;
        }>;
        rent?: Array<{
          provider_id?: number;
          provider_name?: string;
          logo_path?: string | null;
          display_priority?: number;
        }>;
        buy?: Array<{
          provider_id?: number;
          provider_name?: string;
          logo_path?: string | null;
          display_priority?: number;
        }>;
        free?: Array<{
          provider_id?: number;
          provider_name?: string;
          logo_path?: string | null;
          display_priority?: number;
        }>;
        ads?: Array<{
          provider_id?: number;
          provider_name?: string;
          logo_path?: string | null;
          display_priority?: number;
        }>;
      }
    >;
  }>(`/${mediaType}/${id}/watch/providers`);

  const regionData = data?.results?.[region] ?? data?.results?.US;
  if (!regionData) return [];

  const link = regionData.link ?? null;
  const out: WatchProvider[] = [];
  const push = (
    list: Array<{
      provider_id?: number;
      provider_name?: string;
      logo_path?: string | null;
      display_priority?: number;
    }> | undefined,
    type: WatchProvider["type"],
  ) => {
    for (const p of list ?? []) {
      if (!p.provider_id || !p.provider_name) continue;
      out.push({
        id: p.provider_id,
        name: p.provider_name,
        logoPath: tmdbPoster(p.logo_path, "w92"),
        type,
        displayPriority: p.display_priority,
        link,
      });
    }
  };
  push(regionData.flatrate, "flatrate");
  push(regionData.free, "free");
  push(regionData.ads, "ads");
  push(regionData.rent, "rent");
  push(regionData.buy, "buy");
  return out;
}

export async function fetchTmdbSeasons(
  tvId: number,
  contentId: string,
): Promise<Season[]> {
  const detail = await tmdbGet<{
    seasons?: Array<{
      id?: number;
      name?: string;
      overview?: string;
      poster_path?: string | null;
      air_date?: string | null;
      season_number?: number;
      episode_count?: number;
    }>;
  }>(`/tv/${tvId}`);
  return (detail?.seasons ?? [])
    .filter((s) => (s.season_number ?? -1) >= 0)
    .map((s) => ({
      id: `${contentId}_s${s.season_number ?? 0}`,
      contentId,
      seasonNumber: s.season_number ?? 0,
      name: s.name ?? `Season ${s.season_number ?? 0}`,
      overview: s.overview ?? "",
      poster: s.poster_path
        ? { url: tmdbPoster(s.poster_path)!, source: "tmdb" as const }
        : null,
      airDate: s.air_date ?? null,
      episodeCount: s.episode_count ?? 0,
    }));
}

export async function fetchTmdbSeasonEpisodes(
  tvId: number,
  seasonNumber: number,
  contentId: string,
): Promise<Episode[]> {
  const data = await tmdbGet<{
    episodes?: Array<{
      id?: number;
      name?: string;
      overview?: string;
      still_path?: string | null;
      air_date?: string | null;
      episode_number?: number;
      runtime?: number | null;
      season_number?: number;
    }>;
  }>(`/tv/${tvId}/season/${seasonNumber}`);
  const seasonId = `${contentId}_s${seasonNumber}`;
  return (data?.episodes ?? []).map((e) => ({
    id: `${seasonId}_e${e.episode_number ?? e.id ?? 0}`,
    contentId,
    seasonId,
    seasonNumber,
    episodeNumber: e.episode_number ?? 0,
    name: e.name ?? `Episode ${e.episode_number ?? 0}`,
    overview: e.overview ?? "",
    stillPath: tmdbPoster(e.still_path, "w300"),
    airDate: e.air_date ?? null,
    runtime: e.runtime ?? null,
  }));
}

export async function fetchTmdbSearch(q: string): Promise<Content[]> {
  if (!q.trim()) return [];
  const [movies1, movies2, tv1, tv2] = await Promise.all([
    tmdbGet<TmdbListResponse>("/search/movie", { query: q, page: "1" }),
    tmdbGet<TmdbListResponse>("/search/movie", { query: q, page: "2" }),
    tmdbGet<TmdbListResponse>("/search/tv", { query: q, page: "1" }),
    tmdbGet<TmdbListResponse>("/search/tv", { query: q, page: "2" }),
  ]);
  return [
    ...(movies1?.results ?? []),
    ...(movies2?.results ?? []),
    ...(tv1?.results ?? []),
    ...(tv2?.results ?? []),
  ]
    .map((r) =>
      r.media_type === "tv" || r.first_air_date != null || r.name != null
        ? mapTmdbTv(r)
        : mapTmdbMovie(r),
    )
    .filter(Boolean) as Content[];
}

/**
 * TMDB videos → official YouTube trailers only.
 * Movies, TV, anime, and K-drama all use this path.
 * Excludes Clip / Featurette / Behind the Scenes / Teaser / etc.
 */
export async function fetchTmdbVideos(
  mediaType: "movie" | "tv",
  id: number,
): Promise<Trailer[]> {
  const data = await tmdbGet<{
    results?: Array<{
      id?: string;
      key?: string;
      site?: string;
      name?: string;
      type?: string;
      official?: boolean;
    }>;
  }>(`/${mediaType}/${id}/videos`);

  const mapped: Trailer[] = (data?.results ?? [])
    .filter((v) => v.site === "YouTube" && v.key)
    .map((v) => ({
      id: v.id ?? `yt_${String(v.key).trim()}`,
      key: String(v.key).trim(),
      site: "youtube" as const,
      name: v.name ?? "Official Trailer",
      official: Boolean(v.official),
      type: v.type ?? "Trailer",
    }));

  // Strict: Trailer type only, official preferred (see filterOfficialTrailers)
  return filterOfficialTrailers(mapped);
}

export async function fetchTmdbCredits(
  mediaType: "movie" | "tv",
  id: number,
  contentId: string,
): Promise<{ cast: Credit[]; crew: Credit[] }> {
  const data = await tmdbGet<{
    cast?: Array<{
      id?: number;
      name?: string;
      character?: string;
      profile_path?: string | null;
      order?: number;
    }>;
    crew?: Array<{
      id?: number;
      name?: string;
      job?: string;
      department?: string;
      profile_path?: string | null;
    }>;
  }>(`/${mediaType}/${id}/credits`);

  const cast: Credit[] = (data?.cast ?? []).slice(0, 24).map((c, i) => ({
    id: `${contentId}_tmdb_cast_${c.id ?? i}`,
    contentId,
    personId: `tmdb_person_${c.id ?? i}`,
    personName: c.name ?? "Unknown",
    profilePath: tmdbPoster(c.profile_path, "w185"),
    character: c.character ?? null,
    job: null,
    department: "Acting",
    order: c.order ?? i,
    creditType: "cast" as const,
  }));

  const crew: Credit[] = (data?.crew ?? [])
    .filter((c) =>
      ["Director", "Writer", "Screenplay", "Producer", "Creator"].includes(
        c.job ?? "",
      ),
    )
    .slice(0, 16)
    .map((c, i) => ({
      id: `${contentId}_tmdb_crew_${c.id ?? i}_${c.job}`,
      contentId,
      personId: `tmdb_person_${c.id ?? i}`,
      personName: c.name ?? "Unknown",
      profilePath: tmdbPoster(c.profile_path, "w185"),
      character: null,
      job: c.job ?? "Crew",
      department: c.department ?? "Crew",
      order: i,
      creditType: "crew" as const,
    }));

  return { cast, crew };
}

export async function fetchTmdbDetail(
  mediaType: "movie" | "tv",
  id: number,
  asKdrama = false,
): Promise<Content | null> {
  const raw = await tmdbGet<Record<string, unknown>>(`/${mediaType}/${id}`);
  if (!raw) return null;
  return mediaType === "movie"
    ? mapTmdbMovie(raw)
    : mapTmdbTv(raw, asKdrama);
}

/** Catalog IDs with free legal full in-app playback (archive embeds). */
export { FREE_FULL_PLAYBACK_MAP as LEGAL_FULL_PLAYBACK } from "@/lib/playback/free-movies";

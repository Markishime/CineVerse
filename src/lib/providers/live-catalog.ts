/**
 * Live catalog providers (server-only).
 * Keyless: AniList, TVMaze, Jikan
 * Optional: TMDB_ACCESS_TOKEN for richer movies / K-drama / credits / trailers
 */
import { slugify } from "@/lib/utils";
import {
  isKDrama,
  normalizeAnimeFormat,
} from "@/lib/content/classification";
import { filterOfficialTrailers } from "@/lib/content/trailers";
import type {
  Content,
  ContentType,
  Credit,
  Episode,
  Season,
  Trailer,
  WatchProvider,
} from "@/types/content";
import { ContentSchema } from "@/types/content";

const ANILIST = "https://graphql.anilist.co";
const TVMAZE = "https://api.tvmaze.com";
const JIKAN = "https://api.jikan.moe/v4";
const TMDB = "https://api.themoviedb.org/3";
const TMDB_IMG = "https://image.tmdb.org/t/p";

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 14_000,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      // Short TTL so catalog feels real-time when TMDB token is configured
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function posterFallback(title: string, hue: number): string {
  const seed = encodeURIComponent(title.slice(0, 32) || "cineverse");
  // Prefer photographic posters so every card has a real image
  return `https://picsum.photos/seed/cv-${seed}-${hue}/500/750`;
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
query ($page: Int, $perPage: Int, $sort: [MediaSort], $search: String, $status: MediaStatus, $seasonYear: Int, $isAdult: Boolean) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, isAdult: $isAdult, sort: $sort, search: $search, status: $status, seasonYear: $seasonYear) {
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

    for (const r of movies?.results ?? []) {
      const s = scoreHit(r, "movie");
      if (s >= 0 && r.id) {
        candidates.push({ tmdb: r.id, tmdbMediaType: "movie", score: s });
      }
    }
    for (const r of tv?.results ?? []) {
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
    ageRating: m.isAdult ? "18+" : null,
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
    // AniList isAdult is the ground truth for adult anime (not mere ecchi)
    tags: m.isAdult
      ? ["18+", "mature", "adult-anime", "anilist-adult", "anime", "explicit"]
      : ["anime"],
    nextEpisodeAt: m.nextAiringEpisode?.airingAt
      ? new Date(m.nextAiringEpisode.airingAt * 1000).toISOString()
      : null,
    approved: true,
    mature: Boolean(m.isAdult),
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

export async function fetchAnilistAnime(opts?: {
  page?: number;
  search?: string;
  sort?: string;
  status?: string;
  perPage?: number;
  seasonYear?: number;
  /** When true, request 18+ anime catalog from AniList */
  isAdult?: boolean;
}): Promise<Content[]> {
  const data = await fetchJson<{
    data?: { Page?: { media?: AnilistMedia[] } };
  }>(ANILIST, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: ANIME_QUERY,
      variables: {
        page: opts?.page ?? 1,
        perPage: opts?.perPage ?? 40,
        sort: [opts?.sort ?? "POPULARITY_DESC"],
        search: opts?.search || undefined,
        status: opts?.status || undefined,
        seasonYear: opts?.seasonYear || undefined,
        isAdult: Boolean(opts?.isAdult),
      },
    }),
  });
  return (data?.data?.Page?.media ?? [])
    .map(mapAnilist)
    .filter(Boolean) as Content[];
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
  const [
    popular1,
    popular2,
    popular3,
    trending,
    trending2,
    releasing,
    yearScore,
    yearScore2,
    classicScore,
    decade2010,
    decade2000,
    decade1990,
    ...maturePages
  ] = await Promise.all([
    fetchAnilistAnime({ page: 1, perPage: 50, sort: "POPULARITY_DESC" }),
    fetchAnilistAnime({ page: 2, perPage: 50, sort: "POPULARITY_DESC" }),
    fetchAnilistAnime({ page: 3, perPage: 50, sort: "POPULARITY_DESC" }),
    fetchAnilistAnime({ page: 1, perPage: 50, sort: "TRENDING_DESC" }),
    fetchAnilistAnime({ page: 2, perPage: 40, sort: "TRENDING_DESC" }),
    fetchAnilistAnime({
      page: 1,
      perPage: 50,
      status: "RELEASING",
      sort: "POPULARITY_DESC",
    }),
    fetchAnilistAnime({
      page: 1,
      perPage: 40,
      sort: "SCORE_DESC",
      seasonYear: year,
    }),
    fetchAnilistAnime({
      page: 1,
      perPage: 40,
      sort: "POPULARITY_DESC",
      seasonYear: year,
    }),
    fetchAnilistAnime({
      page: 1,
      perPage: 40,
      sort: "SCORE_DESC",
      seasonYear: year - 5,
    }),
    fetchAnilistAnime({
      page: 1,
      perPage: 40,
      sort: "POPULARITY_DESC",
      seasonYear: 2010,
    }),
    fetchAnilistAnime({
      page: 1,
      perPage: 40,
      sort: "POPULARITY_DESC",
      seasonYear: 2000,
    }),
    fetchAnilistAnime({
      page: 1,
      perPage: 40,
      sort: "POPULARITY_DESC",
      seasonYear: 1995,
    }),
    ...(includeMature
      ? [
          // Accurate 18+ adult anime only (AniList isAdult:true — never soft ecchi)
          fetchAnilistAnime({
            page: 1,
            perPage: 50,
            sort: "POPULARITY_DESC",
            isAdult: true,
          }),
          fetchAnilistAnime({
            page: 2,
            perPage: 50,
            sort: "POPULARITY_DESC",
            isAdult: true,
          }),
          fetchAnilistAnime({
            page: 3,
            perPage: 50,
            sort: "POPULARITY_DESC",
            isAdult: true,
          }),
          fetchAnilistAnime({
            page: 4,
            perPage: 50,
            sort: "POPULARITY_DESC",
            isAdult: true,
          }),
          fetchAnilistAnime({
            page: 5,
            perPage: 50,
            sort: "POPULARITY_DESC",
            isAdult: true,
          }),
          fetchAnilistAnime({
            page: 1,
            perPage: 50,
            sort: "SCORE_DESC",
            isAdult: true,
          }),
          fetchAnilistAnime({
            page: 2,
            perPage: 50,
            sort: "SCORE_DESC",
            isAdult: true,
          }),
          fetchAnilistAnime({
            page: 1,
            perPage: 50,
            sort: "TRENDING_DESC",
            isAdult: true,
          }),
          fetchAnilistAnime({
            page: 2,
            perPage: 50,
            sort: "TRENDING_DESC",
            isAdult: true,
          }),
          fetchAnilistAnime({
            page: 1,
            perPage: 40,
            sort: "START_DATE_DESC",
            isAdult: true,
          }),
          fetchAnilistAnime({
            page: 1,
            perPage: 40,
            sort: "FAVOURITES_DESC",
            isAdult: true,
          }),
        ]
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

  const todayAnime = [
    ...tagToday(trending, ["anilist-trending"]),
    ...tagToday(trending2, ["anilist-trending"]),
    ...tagToday(popular1, ["anilist-popular"]),
    ...tagToday(releasing, ["airing"]),
  ];

  const rest = [
    ...popular2,
    ...popular3,
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
  const kdrama =
    forceType === "kdrama" ||
    isKDrama({
      isTv: true,
      originalLanguage:
        s.language?.toLowerCase() === "korean" ? "ko" : s.language,
      originCountries: countries,
      genres,
      typeLabel: s.type,
    });
  if (forceType === "kdrama" && !kdrama && s.language?.toLowerCase() !== "korean") {
    // still allow KR origin
    if (!countries.includes("KR") && s.language?.toLowerCase() !== "korean") {
      return null;
    }
  }
  const contentType: ContentType =
    forceType === "kdrama" || kdrama ? "kdrama" : "series";
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
            contentType === "kdrama" ? 0x5c1a2e : 0x172033,
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
  // First page = highest-weight shows — treat as popular/trending today
  const [page0, page1, page2, page3, page4] = await Promise.all([
    fetchJson<TvMazeShow[]>(`${TVMAZE}/shows?page=0`),
    fetchJson<TvMazeShow[]>(`${TVMAZE}/shows?page=1`),
    fetchJson<TvMazeShow[]>(`${TVMAZE}/shows?page=2`),
    fetchJson<TvMazeShow[]>(`${TVMAZE}/shows?page=3`),
    fetchJson<TvMazeShow[]>(`${TVMAZE}/shows?page=4`),
  ]);
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

  const rest = [page1, page2, page3, page4]
    .flatMap((p) => p ?? [])
    .map((s) => mapTvMaze(s))
    .filter(Boolean) as Content[];

  return [...tagToday(page0), ...rest].slice(0, 320);
}

export async function fetchTvMazeSearch(q: string): Promise<Content[]> {
  if (!q.trim()) return [];
  const data = await fetchJson<Array<{ show: TvMazeShow }>>(
    `${TVMAZE}/search/shows?q=${encodeURIComponent(q)}`,
  );
  return (data ?? [])
    .map((r) => mapTvMaze(r.show))
    .filter(Boolean) as Content[];
}

/** Resolve a TVMaze show id by title (single best match). */
export async function resolveTvMazeShowId(title: string): Promise<number | null> {
  if (!title.trim()) return null;
  const data = await fetchJson<Array<{ show: TvMazeShow; score?: number }>>(
    `${TVMAZE}/search/shows?q=${encodeURIComponent(title)}`,
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
  const data = await fetchJson<TvMazeSeason[]>(
    `${TVMAZE}/shows/${showId}/seasons`,
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
  const data = await fetchJson<TvMazeEpisode[]>(
    `${TVMAZE}/shows/${showId}/episodes`,
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
  const queries = [
    "korean",
    "korea",
    "seoul",
    "netflix korea",
    "reply",
    "goblin",
    "crash landing",
    "squid game",
    "business proposal",
    "descendants of the sun",
  ];
  const results: Content[] = [];
  await Promise.all(
    queries.map(async (q) => {
      const data = await fetchJson<Array<{ show: TvMazeShow }>>(
        `${TVMAZE}/search/shows?q=${encodeURIComponent(q)}`,
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
    }),
  );
  const byId = new Map(results.map((c) => [c.id, c]));
  return Array.from(byId.values());
}

export async function fetchTvMazeById(id: number): Promise<{
  content: Content | null;
  cast: Credit[];
  crew: Credit[];
}> {
  const show = await fetchJson<TvMazeShow>(
    `${TVMAZE}/shows/${id}?embed[]=cast&embed[]=crew`,
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
  const [popular, airing, favorite, movie] = await Promise.all([
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

function mapTmdbMovie(raw: Record<string, unknown>): Content | null {
  const id = Number(raw.id);
  const title = String(raw.title ?? raw.name ?? "");
  if (!title || !id) return null;
  const posterPath = raw.poster_path ? String(raw.poster_path) : null;
  const backdropPath = raw.backdrop_path ? String(raw.backdrop_path) : null;
  const release = raw.release_date ? String(raw.release_date) : null;
  return safeParse({
    id: `tmdb_movie_${id}`,
    slug: slugify(`${title}-${id}`),
    contentType: "movie",
    title,
    originalTitle: raw.original_title
      ? String(raw.original_title)
      : undefined,
    overview: String(raw.overview ?? ""),
    poster: posterPath
      ? { url: tmdbPoster(posterPath)!, source: "tmdb" }
      : { url: posterFallback(title, 0x111827), source: "local" },
    backdrop: backdropPath
      ? { url: tmdbPoster(backdropPath, "w1280")!, source: "tmdb" }
      : null,
    releaseDate: release,
    year: release ? Number(release.slice(0, 4)) : null,
    status: "released",
    language: raw.original_language
      ? String(raw.original_language)
      : null,
    countries: [],
    genres: [],
    runtime: raw.runtime != null ? Number(raw.runtime) : null,
    seasonCount: null,
    episodeCount: null,
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
    studios: [],
    tags: [],
    alternateTitles: [],
    approved: true,
    mature: Boolean(raw.adult),
    lastSyncedAt: new Date().toISOString(),
  });
}

function mapTmdbTv(
  raw: Record<string, unknown>,
  asKdrama = false,
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
  const kdrama =
    asKdrama ||
    isKDrama({
      isTv: true,
      originalLanguage: lang,
      originCountries: origin,
    });
  return safeParse({
    id: kdrama ? `tmdb_kdrama_${id}` : `tmdb_tv_${id}`,
    slug: slugify(`${title}-${id}`),
    contentType: kdrama ? "kdrama" : "series",
    title,
    originalTitle: raw.original_name
      ? String(raw.original_name)
      : undefined,
    overview: String(raw.overview ?? ""),
    poster: posterPath
      ? { url: tmdbPoster(posterPath)!, source: "tmdb" }
      : {
          url: posterFallback(title, kdrama ? 0x5c1a2e : 0x172033),
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
    genres: [],
    runtime: null,
    seasonCount: raw.number_of_seasons != null
      ? Number(raw.number_of_seasons)
      : null,
    episodeCount: raw.number_of_episodes != null
      ? Number(raw.number_of_episodes)
      : null,
    ageRating: null,
    scores: raw.vote_average
      ? [{ source: "tmdb", score: Number(raw.vote_average) }]
      : [],
    popularity: Number(raw.popularity ?? 0),
    trailer: null,
    watchProviders: [],
    providerIds: { tmdb: id, tmdbMediaType: "tv" },
    studios: [],
    tags: [],
    alternateTitles: [],
    approved: true,
    mature: false,
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
  const [
    popular,
    top,
    now,
    upcoming,
    page2,
    page3,
    page4,
    top2,
    now2,
    action,
    comedy,
    scifi,
  ] = await Promise.all([
    tmdbGet<{ results?: Record<string, unknown>[] }>("/movie/popular", {
      page: "1",
      region: "US",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/movie/top_rated", {
      page: "1",
      region: "US",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/movie/now_playing", {
      page: "1",
      region: "US",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/movie/upcoming", {
      page: "1",
      region: "US",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/movie/popular", {
      page: "2",
      region: "US",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/movie/popular", {
      page: "3",
      region: "US",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/movie/popular", {
      page: "4",
      region: "US",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/movie/top_rated", {
      page: "2",
      region: "US",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/movie/now_playing", {
      page: "2",
      region: "US",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/movie", {
      sort_by: "popularity.desc",
      with_genres: "28",
      "vote_count.gte": "100",
      region: "US",
      page: "1",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/movie", {
      sort_by: "popularity.desc",
      with_genres: "35",
      "vote_count.gte": "100",
      region: "US",
      page: "1",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/movie", {
      sort_by: "popularity.desc",
      with_genres: "878",
      "vote_count.gte": "100",
      region: "US",
      page: "1",
    }),
  ]);
  return [
    ...(popular?.results ?? []),
    ...(top?.results ?? []),
    ...(now?.results ?? []),
    ...(upcoming?.results ?? []),
    ...(page2?.results ?? []),
    ...(page3?.results ?? []),
    ...(page4?.results ?? []),
    ...(top2?.results ?? []),
    ...(now2?.results ?? []),
    ...(action?.results ?? []),
    ...(comedy?.results ?? []),
    ...(scifi?.results ?? []),
  ]
    .map(mapTmdbMovie)
    .filter(Boolean) as Content[];
}

export async function fetchTmdbSeries(): Promise<Content[]> {
  const [popular, top, airing, page2, page3, top2, drama, crime] =
    await Promise.all([
      tmdbGet<{ results?: Record<string, unknown>[] }>("/tv/popular", {
        page: "1",
      }),
      tmdbGet<{ results?: Record<string, unknown>[] }>("/tv/top_rated", {
        page: "1",
      }),
      tmdbGet<{ results?: Record<string, unknown>[] }>("/tv/on_the_air", {
        page: "1",
      }),
      tmdbGet<{ results?: Record<string, unknown>[] }>("/tv/popular", {
        page: "2",
      }),
      tmdbGet<{ results?: Record<string, unknown>[] }>("/tv/popular", {
        page: "3",
      }),
      tmdbGet<{ results?: Record<string, unknown>[] }>("/tv/top_rated", {
        page: "2",
      }),
      tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/tv", {
        sort_by: "popularity.desc",
        with_genres: "18",
        "vote_count.gte": "80",
        page: "1",
      }),
      tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/tv", {
        sort_by: "popularity.desc",
        with_genres: "80",
        "vote_count.gte": "80",
        page: "1",
      }),
    ]);
  return [
    ...(popular?.results ?? []),
    ...(top?.results ?? []),
    ...(airing?.results ?? []),
    ...(page2?.results ?? []),
    ...(page3?.results ?? []),
    ...(top2?.results ?? []),
    ...(drama?.results ?? []),
    ...(crime?.results ?? []),
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

export async function fetchTmdbKdrama(): Promise<Content[]> {
  const [a, b, c, d, e] = await Promise.all([
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
    tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/tv", {
      with_origin_country: "KR",
      with_original_language: "ko",
      sort_by: "vote_average.desc",
      "vote_count.gte": "50",
      page: "1",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/tv", {
      with_origin_country: "KR",
      with_original_language: "ko",
      sort_by: "popularity.desc",
      page: "3",
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/discover/tv", {
      with_origin_country: "KR",
      with_original_language: "ko",
      sort_by: "first_air_date.desc",
      "vote_count.gte": "20",
      page: "1",
    }),
  ]);
  return [
    ...(a?.results ?? []),
    ...(b?.results ?? []),
    ...(c?.results ?? []),
    ...(d?.results ?? []),
    ...(e?.results ?? []),
  ]
    .map((r) => mapTmdbTv(r, true))
    .filter(Boolean) as Content[];
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
  const [movies, tv] = await Promise.all([
    tmdbGet<{ results?: Record<string, unknown>[] }>("/search/movie", {
      query: q,
    }),
    tmdbGet<{ results?: Record<string, unknown>[] }>("/search/tv", {
      query: q,
    }),
  ]);
  return [
    ...(movies?.results ?? []).map(mapTmdbMovie),
    ...(tv?.results ?? []).map((r) => mapTmdbTv(r)),
  ].filter(Boolean) as Content[];
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

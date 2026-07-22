import { slugify } from "@/lib/utils";
import {
  ContentSchema,
  isDramaType,
  type AnimeFormat,
  type Content,
  type ContentStatus,
  type ContentType,
  type Genre,
  type Trailer,
  type WatchProvider,
} from "@/types/content";
import {
  classifyDrama,
  isValidAnime,
  normalizeAnimeFormat,
  resolveContentType,
} from "./classification";

const TMDB_IMG = "https://image.tmdb.org/t/w500";
const TMDB_BACKDROP = "https://image.tmdb.org/t/w1280";

export function tmdbImage(
  path: string | null | undefined,
  type: "poster" | "backdrop" = "poster",
): { url: string; source: "tmdb" } | null {
  if (!path) return null;
  const base = type === "backdrop" ? TMDB_BACKDROP : TMDB_IMG;
  return { url: `${base}${path}`, source: "tmdb" };
}

function mapStatus(raw?: string | null): ContentStatus {
  if (!raw) return "unknown";
  const s = raw.toLowerCase().replace(/\s+/g, "_");
  const map: Record<string, ContentStatus> = {
    rumored: "rumored",
    planned: "planned",
    "in production": "in_production",
    in_production: "in_production",
    "post production": "post_production",
    post_production: "post_production",
    released: "released",
    ended: "ended",
    canceled: "canceled",
    cancelled: "canceled",
    returning_series: "airing",
    "returning series": "airing",
    airing: "airing",
    "currently airing": "airing",
    finished: "ended",
    "not yet released": "upcoming",
    upcoming: "upcoming",
    finished_airing: "ended",
    not_yet_released: "upcoming",
  };
  return map[s] ?? map[raw.toLowerCase()] ?? "unknown";
}

function yearFromDate(date?: string | null): number | null {
  if (!date) return null;
  const y = Number(date.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

function makeId(prefix: string, externalId: number | string): string {
  return `${prefix}_${externalId}`;
}

export interface TmdbMovieRaw {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  genres?: Array<{ id: number; name: string }>;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  original_language?: string;
  origin_country?: string[];
  runtime?: number;
  status?: string;
  adult?: boolean;
  number_of_seasons?: number;
  number_of_episodes?: number;
  media_type?: string;
  imdb_id?: string;
}

const TMDB_GENRE_MAP: Record<number, string> = {
  28: "Action",
  12: "Adventure",
  16: "Animation",
  35: "Comedy",
  80: "Crime",
  99: "Documentary",
  18: "Drama",
  10751: "Family",
  14: "Fantasy",
  36: "History",
  27: "Horror",
  10402: "Music",
  9648: "Mystery",
  10749: "Romance",
  878: "Science Fiction",
  10770: "TV Movie",
  53: "Thriller",
  10752: "War",
  37: "Western",
  10759: "Action & Adventure",
  10762: "Kids",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
};

function genresFromTmdb(raw: TmdbMovieRaw): Genre[] {
  if (raw.genres?.length) {
    return raw.genres.map((g) => ({ id: String(g.id), name: g.name }));
  }
  return (raw.genre_ids ?? [])
    .map((id) =>
      TMDB_GENRE_MAP[id]
        ? { id: String(id), name: TMDB_GENRE_MAP[id] }
        : null,
    )
    .filter(Boolean) as Genre[];
}

export function normalizeTmdbMovie(
  raw: TmdbMovieRaw,
  opts?: { forceType?: ContentType },
): Content {
  const title = raw.title ?? raw.name ?? "Untitled";
  const releaseDate = raw.release_date ?? raw.first_air_date ?? null;
  const content: Content = {
    id: makeId("tmdb_movie", raw.id),
    slug: slugify(`${title}-${raw.id}`),
    contentType: opts?.forceType ?? "movie",
    title,
    originalTitle: raw.original_title ?? raw.original_name,
    overview: raw.overview ?? "",
    poster: tmdbImage(raw.poster_path, "poster"),
    backdrop: tmdbImage(raw.backdrop_path, "backdrop"),
    releaseDate,
    year: yearFromDate(releaseDate),
    status: mapStatus(raw.status) || (releaseDate ? "released" : "unknown"),
    language: raw.original_language ?? null,
    countries: raw.origin_country ?? [],
    genres: genresFromTmdb(raw),
    runtime: raw.runtime ?? null,
    seasonCount: null,
    episodeCount: null,
    ageRating: raw.adult ? "R" : null,
    scores: raw.vote_average
      ? [
          {
            source: "tmdb",
            score: raw.vote_average,
            count: raw.vote_count,
          },
        ]
      : [],
    popularity: raw.popularity ?? 0,
    trailer: null,
    watchProviders: [],
    providerIds: {
      tmdb: raw.id,
      tmdbMediaType: "movie",
      imdb: raw.imdb_id,
    },
    studios: [],
    tags: [],
    alternateTitles: [],
    approved: true,
    mature: Boolean(raw.adult),
    lastSyncedAt: new Date().toISOString(),
  };
  return ContentSchema.parse(content);
}

export function normalizeTmdbTv(
  raw: TmdbMovieRaw,
  opts?: { forceType?: ContentType },
): Content {
  const title = raw.name ?? raw.title ?? "Untitled";
  const releaseDate = raw.first_air_date ?? raw.release_date ?? null;
  const genres = genresFromTmdb(raw);

  const dramaType = classifyDrama({
    isTv: true,
    originalLanguage: raw.original_language,
    originCountries: raw.origin_country,
    genres,
    override: opts?.forceType ?? null,
  });

  const contentType = resolveContentType({
    dramaType,
    isTv: true,
    override: opts?.forceType,
  });

  const content: Content = {
    id: makeId(
      isDramaType(contentType) ? `tmdb_${contentType}` : "tmdb_tv",
      raw.id,
    ),
    slug: slugify(`${title}-${raw.id}`),
    contentType,
    title,
    originalTitle: raw.original_name ?? raw.original_title,
    overview: raw.overview ?? "",
    poster: tmdbImage(raw.poster_path, "poster"),
    backdrop: tmdbImage(raw.backdrop_path, "backdrop"),
    releaseDate,
    year: yearFromDate(releaseDate),
    status: mapStatus(raw.status) || (releaseDate ? "released" : "unknown"),
    language: raw.original_language ?? null,
    countries: raw.origin_country ?? [],
    genres,
    runtime: raw.runtime ?? null,
    seasonCount: raw.number_of_seasons ?? null,
    episodeCount: raw.number_of_episodes ?? null,
    ageRating: null,
    scores: raw.vote_average
      ? [
          {
            source: "tmdb",
            score: raw.vote_average,
            count: raw.vote_count,
          },
        ]
      : [],
    popularity: raw.popularity ?? 0,
    trailer: null,
    watchProviders: [],
    providerIds: {
      tmdb: raw.id,
      tmdbMediaType: "tv",
      imdb: raw.imdb_id,
    },
    studios: [],
    tags: [],
    alternateTitles: [],
    approved: true,
    mature: Boolean(raw.adult),
    lastSyncedAt: new Date().toISOString(),
  };
  return ContentSchema.parse(content);
}

export interface AnilistMediaRaw {
  id: number;
  idMal?: number | null;
  type?: string;
  format?: string | null;
  status?: string | null;
  description?: string | null;
  episodes?: number | null;
  duration?: number | null;
  genres?: string[] | null;
  tags?: Array<{ name: string; isAdult?: boolean }> | null;
  isAdult?: boolean;
  averageScore?: number | null;
  popularity?: number | null;
  title?: {
    romaji?: string | null;
    english?: string | null;
    native?: string | null;
  } | null;
  coverImage?: {
    large?: string | null;
    extraLarge?: string | null;
  } | null;
  bannerImage?: string | null;
  startDate?: { year?: number | null } | null;
  studios?: {
    nodes?: Array<{ name?: string }>;
  } | null;
  nextAiringEpisode?: {
    airingAt?: number;
    episode?: number;
  } | null;
  trailer?: {
    id?: string;
    site?: string;
  } | null;
}

export function normalizeAnilist(
  raw: AnilistMediaRaw,
  opts?: { forceType?: ContentType },
): Content | null {
  const title =
    raw.title?.english ||
    raw.title?.romaji ||
    raw.title?.native ||
    null;

  const valid = isValidAnime({
    format: raw.format,
    isAdult: raw.isAdult,
    hasTitle: Boolean(title),
    hasCover: Boolean(raw.coverImage?.large || raw.coverImage?.extraLarge),
    mediaType: raw.type,
    override: opts?.forceType ?? null,
  });
  if (!valid && opts?.forceType !== "anime") return null;

  const year = raw.startDate?.year ?? null;
  const cover =
    raw.coverImage?.extraLarge || raw.coverImage?.large || null;

  let trailer: Trailer | null = null;
  if (raw.trailer?.id && raw.trailer.site?.toLowerCase() === "youtube") {
    trailer = {
      id: `yt_${raw.trailer.id}`,
      key: raw.trailer.id,
      site: "youtube",
      name: "Trailer",
      official: true,
      type: "Trailer",
    };
  }

  const format = normalizeAnimeFormat(raw.format) as AnimeFormat | undefined;

  const content: Content = {
    id: makeId("anilist", raw.id),
    slug: slugify(`${title}-${raw.id}`),
    contentType: "anime",
    title: title as string,
    originalTitle: raw.title?.native ?? undefined,
    englishTitle: raw.title?.english ?? undefined,
    romajiTitle: raw.title?.romaji ?? undefined,
    nativeTitle: raw.title?.native ?? undefined,
    alternateTitles: [
      raw.title?.english,
      raw.title?.romaji,
      raw.title?.native,
    ].filter(Boolean) as string[],
    overview: (raw.description ?? "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
    poster: cover ? { url: cover, source: "anilist" } : null,
    backdrop: raw.bannerImage
      ? { url: raw.bannerImage, source: "anilist" }
      : null,
    releaseDate: year ? `${year}-01-01` : null,
    year,
    status: mapStatus(raw.status),
    language: "ja",
    countries: ["JP"],
    genres: (raw.genres ?? []).map((g) => ({
      id: slugify(g),
      name: g,
    })),
    runtime: raw.duration ?? null,
    seasonCount: null,
    episodeCount: raw.episodes ?? null,
    ageRating: raw.isAdult ? "R+" : null,
    scores: raw.averageScore
      ? [
          {
            source: "anilist",
            score: raw.averageScore / 10,
            count: undefined,
          },
        ]
      : [],
    popularity: raw.popularity ?? 0,
    trailer,
    watchProviders: [],
    providerIds: {
      anilist: raw.id,
    },
    animeFormat: format,
    studios: (raw.studios?.nodes ?? [])
      .map((s) => s.name)
      .filter(Boolean) as string[],
    tags: (raw.tags ?? [])
      .filter((t) => !t.isAdult)
      .map((t) => t.name)
      .slice(0, 20),
    nextEpisodeAt: raw.nextAiringEpisode?.airingAt
      ? new Date(raw.nextAiringEpisode.airingAt * 1000).toISOString()
      : null,
    approved: true,
    mature: Boolean(raw.isAdult),
    lastSyncedAt: new Date().toISOString(),
  };
  return ContentSchema.parse(content);
}

export function normalizeWatchProviders(
  providers: Array<{
    provider_id: number;
    provider_name: string;
    logo_path?: string | null;
    display_priority?: number;
  }>,
  type: WatchProvider["type"],
): WatchProvider[] {
  return providers.map((p) => ({
    id: p.provider_id,
    name: p.provider_name,
    logoPath: p.logo_path
      ? `https://image.tmdb.org/t/p/w92${p.logo_path}`
      : null,
    type,
    displayPriority: p.display_priority,
  }));
}

export function displayTitle(
  content: Content,
  preference: "english" | "romaji" | "native" = "english",
): string {
  if (content.contentType !== "anime") return content.title;
  if (preference === "romaji" && content.romajiTitle) return content.romajiTitle;
  if (preference === "native" && content.nativeTitle) return content.nativeTitle;
  if (preference === "english" && content.englishTitle) return content.englishTitle;
  return (
    content.englishTitle ||
    content.romajiTitle ||
    content.nativeTitle ||
    content.title
  );
}

export function primaryScore(content: Content): number | null {
  if (!content.scores?.length) return null;
  const preferred =
    content.scores.find((s) => s.source === "cineverse") ??
    content.scores.find((s) => s.source === "tmdb") ??
    content.scores.find((s) => s.source === "anilist") ??
    content.scores[0];
  return preferred?.score ?? null;
}

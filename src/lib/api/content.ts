import type {
  Content,
  Credit,
  Episode,
  Recommendation,
  Season,
  Trailer,
  WatchProvider,
} from "@/types/content";
import { apiFetch, buildQuery } from "./client";

export interface Paginated<T> {
  items: T[];
  page: number;
  totalPages: number;
  total?: number;
}

export interface HomePayload {
  featured: Content | null;
  featuredCarousel?: Content[];
  /** ISO timestamp when featured pool was built (for live hero refresh) */
  featuredUpdatedAt?: string;
  /** Region used to build this payload */
  region?: string;
  trending: Content[];
  popularMovies: Content[];
  popularSeries: Content[];
  airingAnime: Content[];
  trendingKdramas: Content[];
  trendingCdramas: Content[];
  trendingJdramas: Content[];
  trendingThaidramas: Content[];
  koreanMovies: Content[];
  koreanSeries: Content[];
  japaneseMovies: Content[];
  japaneseSeries: Content[];
  chineseMovies: Content[];
  chineseSeries: Content[];
  thaiMovies: Content[];
  thaiSeries: Content[];
  filipinoMovies: Content[];
  filipinoSeries: Content[];
  newReleases: Content[];
  comingSoon: Content[];
  topRated: Content[];
  animeNextEpisode: Content[];
  freeLegal: Content[];
  /** Present when 18+ mature is enabled */
  matureMovies?: Content[];
  matureSeries?: Content[];
  matureAnime?: Content[];
  matureKdramas?: Content[];
  communityFavorites: Content[];
  editorial: Content[];
  continueWatching?: Content[];
  becauseYouWatched?: Recommendation[];
  moods: Array<{ id: string; label: string; emoji: string }>;
  genres: Array<{ id: string; name: string; contentType?: string }>;
  /** Trakt trending shows + movies */
  traktTrending?: Content[];
  /** Free Thai dramas from GMMTV official YouTube */
  gmmtvDramas?: Content[];
}

export function fetchHome(region?: string, mature?: boolean) {
  // Client hard-timeout so a hung SSR function never leaves the home skeleton up forever.
  const path = `/home${buildQuery({ region, mature: mature ? "1" : undefined })}`;
  return Promise.race([
    apiFetch<HomePayload>(path, { auth: true }),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Home catalog timed out — try again")),
        12_000,
      ),
    ),
  ]);
}

export function fetchMovies(params: {
  page?: number;
  pageSize?: number;
  sort?: string;
  genre?: string;
  year?: number;
  mature?: boolean;
  /** Only titles with free full legal playback (Watch Now) */
  playable?: boolean;
  region?: string;
  country?: string;
}) {
  return apiFetch<Paginated<Content>>(
    `/movies${buildQuery({
      ...params,
      mature: params.mature ? "1" : undefined,
      playable: params.playable ? "1" : undefined,
      region: params.region,
      country: params.country,
    })}`,
  );
}

export function fetchSeries(params: {
  page?: number;
  pageSize?: number;
  sort?: string;
  genre?: string;
  year?: number;
  mature?: boolean;
  playable?: boolean;
  region?: string;
  country?: string;
}) {
  return apiFetch<Paginated<Content>>(
    `/series${buildQuery({
      ...params,
      mature: params.mature ? "1" : undefined,
      playable: params.playable ? "1" : undefined,
      region: params.region,
      country: params.country,
    })}`,
  );
}

export function fetchAnime(params: {
  page?: number;
  pageSize?: number;
  sort?: string;
  format?: string;
  season?: string;
  genre?: string;
  mature?: boolean;
  playable?: boolean;
  region?: string;
}) {
  return apiFetch<Paginated<Content>>(
    `/anime${buildQuery({
      ...params,
      mature: params.mature ? "1" : undefined,
      playable: params.playable ? "1" : undefined,
      region: params.region,
    })}`,
  );
}

export function fetchMatureLibrary(params: {
  page?: number;
  pageSize?: number;
  type?: string;
}) {
  return apiFetch<Paginated<Content>>(
    `/mature${buildQuery({
      page: params.page,
      pageSize: params.pageSize,
      type: params.type,
    })}`,
  );
}

export function fetchDrama(
  type: "kdrama" | "cdrama" | "jdrama" | "thaidrama",
  params: {
    page?: number;
    pageSize?: number;
    sort?: string;
    mature?: boolean;
    genre?: string;
    status?: string;
    playable?: boolean;
    region?: string;
  },
) {
  return apiFetch<Paginated<Content>>(
    `/${type}${buildQuery({
      ...params,
      mature: params.mature ? "1" : undefined,
      playable: params.playable ? "1" : undefined,
      region: params.region,
    })}`,
  );
}

export function fetchKdrama(params: {
  page?: number;
  pageSize?: number;
  sort?: string;
  mature?: boolean;
  genre?: string;
  status?: string;
  playable?: boolean;
  region?: string;
}) {
  return fetchDrama("kdrama", params);
}

export function fetchDiscover(params: Record<string, string | number | undefined>) {
  return apiFetch<Paginated<Content>>(`/discover${buildQuery(params)}`);
}

export function searchContent(params: {
  q: string;
  type?: string;
  page?: number;
  genre?: string;
  year?: number;
  language?: string;
  country?: string;
  status?: string;
  format?: string;
  mature?: boolean;
}) {
  return apiFetch<Paginated<Content>>(
    `/search${buildQuery({
      ...params,
      mature: params.mature ? "1" : undefined,
    })}`,
  );
}

export function fetchContentById(id: string) {
  return apiFetch<Content>(`/content/${encodeURIComponent(id)}`);
}

export function fetchContentBySlug(slug: string) {
  return apiFetch<Content>(`/content/slug/${encodeURIComponent(slug)}`);
}

export function fetchCredits(id: string) {
  return apiFetch<{ cast: Credit[]; crew: Credit[] }>(
    `/content/${encodeURIComponent(id)}/credits`,
  );
}

export function fetchTrailers(id: string) {
  return apiFetch<{ trailers: Trailer[] }>(
    `/content/${encodeURIComponent(id)}/trailers`,
  );
}

export function fetchProviders(id: string, region?: string) {
  return apiFetch<{ providers: WatchProvider[]; region: string }>(
    `/content/${encodeURIComponent(id)}/providers${buildQuery({ region })}`,
  );
}

export function fetchRecommendations(id: string) {
  return apiFetch<{ items: Recommendation[] }>(
    `/content/${encodeURIComponent(id)}/recommendations`,
  );
}

export function fetchSeasons(id: string) {
  return apiFetch<{ seasons: Season[] }>(
    `/content/${encodeURIComponent(id)}/seasons`,
  );
}

export function fetchEpisodes(seasonId: string) {
  return apiFetch<{ episodes: Episode[] }>(
    `/seasons/${encodeURIComponent(seasonId)}/episodes`,
  );
}

export function fetchPerson(id: string) {
  return apiFetch<{
    person: import("@/types/content").Person;
    credits: Content[];
  }>(`/people/${encodeURIComponent(id)}`);
}

export function fetchPlaybackEligibility(id: string, region?: string) {
  return apiFetch<{
    eligible: boolean;
    playable?: boolean;
    watchLabel?: "Watch Now" | "Watch Trailer" | "Not Available on CineVerse";
    reason?: string;
    assetUrl?: string;
    trailer?: Trailer | null;
    providers: WatchProvider[];
    legalFull?: {
      type: "archive" | "youtube" | "hls" | "mp4" | "vimeo";
      embedUrl: string;
      label: string;
      sourceType?: string;
      attributionText?: string;
      rightsHolder?: string;
      youtubeVideoId?: string;
      vimeoVideoId?: string;
      downloadUrl?: string;
      downloadLabel?: string;
    } | null;
    resolved?: {
      playable: boolean;
      mode?: string;
      sourceType?: string;
      youtubeVideoId?: string;
      vimeoVideoId?: string;
      signedUrl?: string;
      downloadUrl?: string;
      downloadLabel?: string;
      reason?: string;
      watchLabel?: string;
    } | null;
    region?: string;
    tmdbIsMetadataOnly?: boolean;
  }>(
    `/content/${encodeURIComponent(id)}/playback${buildQuery({ region })}`,
  );
}

/** Authenticated per-title / per-episode legal session */
export function createPlaybackSession(body: {
  titleId: string;
  episodeId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  region?: string;
  contentIdAliases?: string[];
}) {
  return apiFetch<{
    allowed: boolean;
    playable?: boolean;
    provider?: string | null;
    mode?: string;
    youtubeVideoId?: string;
    vimeoVideoId?: string;
    videoUid?: string;
    cloudflareVideoUid?: string;
    cloudflareCustomerCode?: string;
    cloudflareToken?: string;
    playbackUrl?: string;
    expiresAt?: string;
    reason?: string;
    watchLabel?: string;
    rightsHolder?: string;
    providerName?: string;
    attributionText?: string;
  }>("/playback/session", {
    method: "POST",
    body: JSON.stringify(body),
    auth: true,
  });
}

/** Full playback mapping — never uses TMDB /videos as stream */
export function getFullPlaybackSource(params: {
  titleId: string;
  episodeId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  region?: string;
}) {
  return apiFetch<{
    available: boolean;
    provider?: string;
    videoUid?: string;
    cloudflareVideoUid?: string;
    cloudflareCustomerCode?: string;
    cloudflareToken?: string;
    videoId?: string;
    youtubeVideoId?: string;
    playbackUrl?: string;
    message?: string;
    watchLabel?: string;
  }>(
    `/playback/source${buildQuery({
      titleId: params.titleId,
      episodeId: params.episodeId,
      seasonNumber: params.seasonNumber,
      episodeNumber: params.episodeNumber,
      region: params.region,
    })}`,
  );
}

export function resolveEpisodePlayback(body: {
  titleId: string;
  episodeId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  region?: string;
  contentIdAliases?: string[];
}) {
  return apiFetch<{
    playable: boolean;
    mode?: string;
    youtubeVideoId?: string;
    signedUrl?: string;
    reason?: string;
    watchLabel?: string;
  }>("/playback/resolve", {
    method: "POST",
    body: JSON.stringify(body),
    auth: true,
  });
}

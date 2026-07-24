/**
 * TMDb metadata fetcher for the embed-based watch pages.
 * Used server-side only to fetch full metadata (title, overview, cast, backdrop, etc.)
 * when serving /watch/movie/[id] and /watch/tv/[id]/[season]/[episode].
 */

import { tmdbFetch } from "@/lib/providers/tmdb-client";

export interface TmdbMovieDetail {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  runtime: number | null;
  vote_average: number;
  vote_count: number;
  genres: Array<{ id: number; name: string }>;
  status: string;
  original_language: string;
  tagline: string | null;
  production_companies: Array<{ id: number; name: string }>;
  production_countries?: Array<{ iso_3166_1: string; name: string }>;
  belongs_to_collection: { id: number; name: string } | null;
  number_of_seasons?: number;
  number_of_episodes?: number;
}

export interface TmdbTvDetail extends TmdbMovieDetail {
  name: string;
  first_air_date: string;
  last_air_date: string | null;
  number_of_seasons: number;
  number_of_episodes: number;
  origin_country?: string[];
  seasons: Array<{
    id: number;
    season_number: number;
    name: string;
    overview: string;
    poster_path: string | null;
    air_date: string | null;
    episode_count: number;
  }>;
  episode_run_time: number[];
  created_by: Array<{ id: number; name: string }>;
  networks: Array<{ id: number; name: string }>;
}

export interface TmdbEpisodeDetail {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  season_number: number;
  air_date: string;
  runtime: number | null;
  still_path: string | null;
  vote_average: number;
  guest_stars: Array<{
    id: number;
    name: string;
    character: string;
    profile_path: string | null;
  }>;
  crew: Array<{
    id: number;
    name: string;
    job: string;
  }>;
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TmdbCastResponse {
  id: number;
  cast: TmdbCastMember[];
  crew: Array<{
    id: number;
    name: string;
    job: string;
    department: string;
    profile_path: string | null;
  }>;
}

const TMDB_IMG_BASE = "https://image.tmdb.org/t/p";

export function tmdbPosterUrl(
  path: string | null | undefined,
  size: "w342" | "w500" | "w780" = "w500",
): string | null {
  if (!path) return null;
  return `${TMDB_IMG_BASE}/${size}${path}`;
}

export function tmdbBackdropUrl(
  path: string | null | undefined,
  size: "w780" | "w1280" | "original" = "w1280",
): string | null {
  if (!path) return null;
  return `${TMDB_IMG_BASE}/${size}${path}`;
}

/** Fetch movie metadata from TMDb */
export async function fetchTmdbMovie(
  tmdbId: number,
): Promise<TmdbMovieDetail | null> {
  return tmdbFetch<TmdbMovieDetail>(`/movie/${tmdbId}`, {
    append_to_response: "credits",
  });
}

/** Fetch TV show metadata from TMDb */
export async function fetchTmdbTvShow(
  tmdbId: number,
): Promise<TmdbTvDetail | null> {
  return tmdbFetch<TmdbTvDetail>(`/tv/${tmdbId}`, {
    append_to_response: "credits",
  });
}

/** Fetch TV episode metadata from TMDb */
export async function fetchTmdbEpisode(
  tmdbId: number,
  season: number,
  episode: number,
): Promise<TmdbEpisodeDetail | null> {
  return tmdbFetch<TmdbEpisodeDetail>(
    `/tv/${tmdbId}/season/${season}/episode/${episode}`,
  );
}

/** Fetch cast for a movie */
export async function fetchTmdbCast(
  tmdbId: number,
): Promise<TmdbCastResponse | null> {
  return tmdbFetch<TmdbCastResponse>(`/movie/${tmdbId}/credits`);
}

/** Fetch cast for a TV show */
export async function fetchTmdbTvCast(
  tmdbId: number,
): Promise<TmdbCastResponse | null> {
  return tmdbFetch<TmdbCastResponse>(`/tv/${tmdbId}/credits`);
}

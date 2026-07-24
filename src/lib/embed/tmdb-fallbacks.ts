/**
 * Minimal TMDB-shaped metadata used when the TMDB API is unavailable
 * (missing token on Vercel, network error, etc.). Playback only needs the id;
 * the embed player works without full metadata.
 */

import type {
  TmdbEpisodeDetail,
  TmdbMovieDetail,
  TmdbTvDetail,
} from "@/lib/embed/tmdb-fetcher";

export function fallbackMovie(tmdbId: number): TmdbMovieDetail {
  return {
    id: tmdbId,
    title: `Movie ${tmdbId}`,
    original_title: `Movie ${tmdbId}`,
    overview: "",
    poster_path: null,
    backdrop_path: null,
    release_date: "",
    runtime: null,
    vote_average: 0,
    vote_count: 0,
    genres: [],
    status: "Released",
    original_language: "en",
    tagline: null,
    production_companies: [],
    belongs_to_collection: null,
  };
}

export function fallbackTvShow(
  tmdbId: number,
  season: number,
  episode: number,
): TmdbTvDetail {
  const seasonNum = Math.max(1, season);
  const episodeCount = Math.max(episode, 24);
  return {
    id: tmdbId,
    title: `Show ${tmdbId}`,
    name: `Show ${tmdbId}`,
    original_title: `Show ${tmdbId}`,
    overview: "",
    poster_path: null,
    backdrop_path: null,
    release_date: "",
    first_air_date: "",
    last_air_date: null,
    runtime: null,
    vote_average: 0,
    vote_count: 0,
    genres: [],
    status: "Returning Series",
    original_language: "en",
    tagline: null,
    production_companies: [],
    belongs_to_collection: null,
    number_of_seasons: seasonNum,
    number_of_episodes: episodeCount,
    seasons: [
      {
        id: seasonNum,
        season_number: seasonNum,
        name: `Season ${seasonNum}`,
        overview: "",
        poster_path: null,
        air_date: null,
        episode_count: episodeCount,
      },
    ],
    episode_run_time: [],
    created_by: [],
    networks: [],
  };
}

export function fallbackEpisode(
  season: number,
  episode: number,
): TmdbEpisodeDetail {
  return {
    id: 0,
    name: `Episode ${episode}`,
    overview: "",
    episode_number: episode,
    season_number: season,
    air_date: "",
    runtime: null,
    still_path: null,
    vote_average: 0,
    guest_stars: [],
    crew: [],
  };
}

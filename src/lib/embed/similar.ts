import { tmdbFetch } from "@/lib/providers/tmdb-client";
import {
  TMDB_ADULT_COMPANY_IDS,
  TMDB_ADULT_KEYWORD_IDS,
  textLooksAdult,
} from "@/lib/content/adult-filter";

export interface SimilarTitle {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  year: number | null;
  rating: number | null;
  backdrop: string | null;
  poster: string | null;
  href: string;
}

interface TmdbRow {
  id?: number;
  title?: string;
  name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  backdrop_path?: string | null;
  poster_path?: string | null;
  adult?: boolean;
  genre_ids?: number[];
}

interface TmdbList {
  results?: TmdbRow[];
}

const IMG = "https://image.tmdb.org/t/p";
const LIMIT = 16;

function toTitle(row: TmdbRow, mediaType: "movie" | "tv"): SimilarTitle | null {
  const title = row.title ?? row.name;
  if (!row.id || !title || row.adult) return null;
  if (textLooksAdult(title, row.overview ?? "")) return null;
  if (!row.backdrop_path && !row.poster_path) return null;
  const date = row.release_date ?? row.first_air_date ?? "";
  const year = date ? Number(date.slice(0, 4)) : null;
  return {
    tmdbId: row.id,
    mediaType,
    title,
    year: year && Number.isFinite(year) ? year : null,
    rating: row.vote_average ? Math.round(row.vote_average * 10) / 10 : null,
    backdrop: row.backdrop_path ? `${IMG}/w500${row.backdrop_path}` : null,
    poster: row.poster_path ? `${IMG}/w342${row.poster_path}` : null,
    href:
      mediaType === "movie"
        ? `/watch/movie/${row.id}`
        : `/watch/tv/${row.id}/1/1`,
  };
}

/**
 * Titles related to a movie/series: TMDB recommendations first, then "similar",
 * then a same-genre discover so the row is never empty for niche titles.
 */
export async function fetchSimilarTitles(
  tmdbId: number,
  mediaType: "movie" | "tv",
): Promise<SimilarTitle[]> {
  const [recs, similar, detail] = await Promise.all([
    tmdbFetch<TmdbList>(`/${mediaType}/${tmdbId}/recommendations`),
    tmdbFetch<TmdbList>(`/${mediaType}/${tmdbId}/similar`),
    tmdbFetch<{ genres?: Array<{ id: number }> }>(`/${mediaType}/${tmdbId}`),
  ]);

  const seen = new Set<number>([tmdbId]);
  const out: SimilarTitle[] = [];
  const push = (rows: TmdbRow[] | undefined) => {
    for (const row of rows ?? []) {
      const item = toTitle(row, mediaType);
      if (!item || seen.has(item.tmdbId)) continue;
      seen.add(item.tmdbId);
      out.push(item);
    }
  };

  push(recs?.results);
  push(similar?.results);

  if (out.length < LIMIT) {
    const genreIds = (detail?.genres ?? []).slice(0, 2).map((g) => g.id);
    if (genreIds.length > 0) {
      const discover = await tmdbFetch<TmdbList>(`/discover/${mediaType}`, {
        with_genres: genreIds.join(","),
        sort_by: "popularity.desc",
        include_adult: "false",
        without_keywords: TMDB_ADULT_KEYWORD_IDS,
        without_companies: TMDB_ADULT_COMPANY_IDS,
        "vote_count.gte": "50",
        language: "en-US",
      });
      push(discover?.results);
    }
  }

  return out.slice(0, LIMIT);
}

export interface SeasonEpisode {
  episodeNumber: number;
  name: string;
  overview: string;
  runtime: number | null;
  still: string | null;
  airDate: string | null;
}

export async function fetchSeasonEpisodes(
  tmdbId: number,
  season: number,
): Promise<SeasonEpisode[]> {
  const data = await tmdbFetch<{
    episodes?: Array<{
      episode_number: number;
      name?: string;
      overview?: string;
      runtime?: number | null;
      still_path?: string | null;
      air_date?: string | null;
    }>;
  }>(`/tv/${tmdbId}/season/${season}`);
  return (data?.episodes ?? []).map((e) => ({
    episodeNumber: e.episode_number,
    name: e.name || `Episode ${e.episode_number}`,
    overview: e.overview ?? "",
    runtime: e.runtime ?? null,
    still: e.still_path ? `${IMG}/w300${e.still_path}` : null,
    airDate: e.air_date ?? null,
  }));
}

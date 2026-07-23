/**
 * Server-only OMDb API client.
 * Provides IMDb, Rotten Tomatoes, and Metacritic ratings.
 */

const BASE = "https://www.omdbapi.com";

export async function omdbFetch<T>(
  params: Record<string, string>,
): Promise<T | null> {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) return null;

  const url = new URL(BASE);
  url.searchParams.set("apikey", apiKey);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[OMDb] ${res.status} — skipping`);
      return null;
    }
    const data = (await res.json()) as T & { Response?: string };
    if (data.Response === "False") return null;
    return data as T;
  } catch (e) {
    console.warn(
      `[OMDb] unavailable: ${e instanceof Error ? e.message : "error"}`,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface OmdbRating {
  Source: string;
  Value: string;
}

export interface OmdbTitle {
  Title: string;
  Year: string;
  Rated: string;
  Released: string;
  Runtime: string;
  Genre: string;
  Director: string;
  Writer: string;
  Actors: string;
  Plot: string;
  Language: string;
  Country: string;
  Awards: string;
  Poster: string;
  Ratings: OmdbRating[];
  Metascore: string;
  imdbRating: string;
  imdbVotes: string;
  imdbID: string;
  Type: string;
  DVD: string;
  BoxOffice: string;
  Production: string;
  Website: string;
  Response: string;
}

export interface OmdbSearchResult {
  Title: string;
  Year: string;
  imdbID: string;
  Type: string;
  Poster: string;
}

export interface OmdbSearchResponse {
  Search: OmdbSearchResult[];
  totalResults: string;
  Response: string;
}

/* ------------------------------------------------------------------ */
/*  Fetch helpers                                                       */
/* ------------------------------------------------------------------ */

export async function fetchOmdbByImdbId(
  imdbId: string,
): Promise<OmdbTitle | null> {
  if (!imdbId) return null;
  return omdbFetch<OmdbTitle>({ i: imdbId });
}

export async function fetchOmdbByTitle(
  title: string,
  year?: number,
): Promise<OmdbTitle | null> {
  if (!title.trim()) return null;
  const params: Record<string, string> = { t: title.trim() };
  if (year) params.y = String(year);
  return omdbFetch<OmdbTitle>(params);
}

export async function fetchOmdbSearch(
  query: string,
  page = 1,
): Promise<OmdbSearchResult[]> {
  if (!query.trim()) return [];
  const data = await omdbFetch<OmdbSearchResponse>({
    s: query.trim(),
    page: String(page),
  });
  return data?.Search ?? [];
}

/* ------------------------------------------------------------------ */
/*  Rating extraction                                                  */
/* ------------------------------------------------------------------ */

function parseRatingValue(val: string): number {
  const num = parseFloat(val.replace(/[^0-9.]/g, ""));
  return isNaN(num) ? 0 : num;
}

export interface ExtractedRating {
  source: "imdb" | "rotten_tomatoes" | "metacritic";
  score: number;
  count?: number;
}

export function extractRatings(title: OmdbTitle): ExtractedRating[] {
  const ratings: ExtractedRating[] = [];

  if (title.imdbRating && title.imdbRating !== "N/A") {
    ratings.push({
      source: "imdb",
      score: parseRatingValue(title.imdbRating) * 10,
      count: title.imdbVotes
        ? parseInt(title.imdbVotes.replace(/[^0-9]/g, ""), 10)
        : undefined,
    });
  }

  for (const r of title.Ratings ?? []) {
    if (r.Source === "Rotten Tomatoes") {
      ratings.push({
        source: "rotten_tomatoes",
        score: parseRatingValue(r.Value),
      });
    } else if (r.Source === "Metacritic") {
      ratings.push({
        source: "metacritic",
        score: parseRatingValue(r.Value),
      });
    }
  }

  if (title.Metascore && title.Metascore !== "N/A") {
    const exists = ratings.some((r) => r.source === "metacritic");
    if (!exists) {
      ratings.push({
        source: "metacritic",
        score: parseRatingValue(title.Metascore),
      });
    }
  }

  return ratings;
}

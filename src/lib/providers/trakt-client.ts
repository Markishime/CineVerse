/**
 * Server-only Trakt API v2 client.
 * Public endpoints (trending, search, metadata) require only a Client-ID.
 * Scrobble/list management requires OAuth (not implemented here).
 */

const BASE = "https://api.trakt.tv";
const API_VERSION = "2";

export async function traktFetch<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T | null> {
  const clientId = process.env.TRAKT_CLIENT_ID;
  if (!clientId) return null;

  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "trakt-api-version": API_VERSION,
        "trakt-api-key": clientId,
        // Cloudflare bot heuristics 403 undici's default fingerprint on
        // request bursts — a real UA keeps public API reads unblocked.
        "User-Agent": "CineVerse/1.0 (+https://cineverse-live.web.app)",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      // Never dump response bodies (Cloudflare block pages are full HTML docs)
      console.warn(`[Trakt] ${res.status} on ${path} — skipping`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.warn(
      `[Trakt] unavailable: ${e instanceof Error ? e.message : "error"}`,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/*  Type helpers                                                       */
/* ------------------------------------------------------------------ */

export interface TraktShow {
  title: string;
  year: number | null;
  ids: {
    trakt: number;
    slug: string;
    tvdb?: number;
    imdb?: string;
    tmdb?: number;
  };
  overview?: string;
  rating?: number;
  votes?: number;
  genres?: string[];
  status?: string;
  network?: string;
  aired_episodes?: number;
  images?: { poster?: string; fanart?: string; banner?: string };
}

export interface TraktMovie {
  title: string;
  year: number | null;
  ids: {
    trakt: number;
    slug: string;
    imdb?: string;
    tmdb?: number;
  };
  overview?: string;
  rating?: number;
  votes?: number;
  genres?: string[];
  status?: string;
  images?: { poster?: string; fanart?: string };
}

export interface TraktTrendingItem<T> {
  watchers: number;
  movie?: T extends "show" ? never : TraktMovie;
  show?: T extends "movie" ? never : TraktShow;
}

export interface TraktSearchResult {
  type: "show" | "movie";
  score: number;
  show?: TraktShow;
  movie?: TraktMovie;
}

/* ------------------------------------------------------------------ */
/*  Fetch helpers                                                       */
/* ------------------------------------------------------------------ */

export async function fetchTraktTrendingShows(
  limit = 25,
): Promise<TraktShow[]> {
  const data = await traktFetch<TraktTrendingItem<"show">[]>(
    "/shows/trending",
    { limit: String(limit), extended: "full" },
  );
  return data?.flatMap((item) => (item.show ? [item.show] : [])) ?? [];
}

export async function fetchTraktTrendingMovies(
  limit = 25,
): Promise<TraktMovie[]> {
  const data = await traktFetch<TraktTrendingItem<"movie">[]>(
    "/movies/trending",
    { limit: String(limit), extended: "full" },
  );
  return data?.flatMap((item) => (item.movie ? [item.movie] : [])) ?? [];
}

export async function fetchTraktSearch(
  query: string,
  type: "show" | "movie" | "show,movie" = "show,movie",
  limit = 20,
): Promise<TraktSearchResult[]> {
  if (!query.trim()) return [];
  const data = await traktFetch<TraktSearchResult[]>("/search", {
    query: query.trim(),
    type,
    limit: String(limit),
    extended: "full",
  });
  return data ?? [];
}

export async function fetchTraktShow(traktId: number): Promise<TraktShow | null> {
  return traktFetch<TraktShow>(`/shows/${traktId}`, { extended: "full" });
}

export async function fetchTraktMovie(traktId: number): Promise<TraktMovie | null> {
  return traktFetch<TraktMovie>(`/movies/${traktId}`, { extended: "full" });
}

export async function fetchTraktShowBySlug(slug: string): Promise<TraktShow | null> {
  return traktFetch<TraktShow>(`/shows/${slug}`, { extended: "full" });
}

export async function fetchTraktMovieBySlug(slug: string): Promise<TraktMovie | null> {
  return traktFetch<TraktMovie>(`/movies/${slug}`, { extended: "full" });
}

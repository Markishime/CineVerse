import { isKDrama } from "../lib/classification";

const BASE = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w500";
const BACKDROP = "https://image.tmdb.org/t/p/w1280";

export interface NormalizedContent {
  id: string;
  slug: string;
  contentType: "movie" | "series" | "anime" | "kdrama";
  title: string;
  overview: string;
  poster: { url: string; source: "tmdb" } | null;
  backdrop: { url: string; source: "tmdb" } | null;
  year: number | null;
  popularity: number;
  language: string | null;
  countries: string[];
  genres: Array<{ id: string; name: string }>;
  providerIds: { tmdb: number; tmdbMediaType: "movie" | "tv" };
  approved: boolean;
  status: string;
  scores: Array<{ source: "tmdb"; score: number; count?: number }>;
  lastSyncedAt: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function yearFrom(date?: string): number | null {
  if (!date) return null;
  const y = Number(date.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

export class TmdbAdapter {
  constructor(private token: string) {}

  private async get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${BASE}${path}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`TMDB ${res.status}: ${await res.text()}`);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }

  private mapMovie(raw: Record<string, unknown>): NormalizedContent {
    const id = Number(raw.id);
    const title = String(raw.title ?? "Untitled");
    const release = raw.release_date ? String(raw.release_date) : undefined;
    return {
      id: `tmdb_movie_${id}`,
      slug: slugify(`${title}-${id}`),
      contentType: "movie",
      title,
      overview: String(raw.overview ?? ""),
      poster: raw.poster_path
        ? { url: `${IMG}${raw.poster_path}`, source: "tmdb" }
        : null,
      backdrop: raw.backdrop_path
        ? { url: `${BACKDROP}${raw.backdrop_path}`, source: "tmdb" }
        : null,
      year: yearFrom(release),
      popularity: Number(raw.popularity ?? 0),
      language: raw.original_language ? String(raw.original_language) : null,
      countries: [],
      genres: [],
      providerIds: { tmdb: id, tmdbMediaType: "movie" },
      approved: true,
      status: "released",
      scores: raw.vote_average
        ? [
            {
              source: "tmdb",
              score: Number(raw.vote_average),
              count: raw.vote_count ? Number(raw.vote_count) : undefined,
            },
          ]
        : [],
      lastSyncedAt: new Date().toISOString(),
    };
  }

  private mapTv(raw: Record<string, unknown>): NormalizedContent {
    const id = Number(raw.id);
    const title = String(raw.name ?? raw.title ?? "Untitled");
    const release = raw.first_air_date ? String(raw.first_air_date) : undefined;
    const origin = Array.isArray(raw.origin_country)
      ? (raw.origin_country as string[])
      : [];
    const kdrama = isKDrama({
      isTv: true,
      originalLanguage: raw.original_language
        ? String(raw.original_language)
        : null,
      originCountries: origin,
      genres: [],
    });
    return {
      id: kdrama ? `tmdb_kdrama_${id}` : `tmdb_tv_${id}`,
      slug: slugify(`${title}-${id}`),
      contentType: kdrama ? "kdrama" : "series",
      title,
      overview: String(raw.overview ?? ""),
      poster: raw.poster_path
        ? { url: `${IMG}${raw.poster_path}`, source: "tmdb" }
        : null,
      backdrop: raw.backdrop_path
        ? { url: `${BACKDROP}${raw.backdrop_path}`, source: "tmdb" }
        : null,
      year: yearFrom(release),
      popularity: Number(raw.popularity ?? 0),
      language: raw.original_language ? String(raw.original_language) : null,
      countries: origin,
      genres: [],
      providerIds: { tmdb: id, tmdbMediaType: "tv" },
      approved: true,
      status: "released",
      scores: raw.vote_average
        ? [{ source: "tmdb", score: Number(raw.vote_average) }]
        : [],
      lastSyncedAt: new Date().toISOString(),
    };
  }

  async trendingMovies(): Promise<NormalizedContent[]> {
    const data = await this.get<{ results: Record<string, unknown>[] }>(
      "/trending/movie/day",
    );
    return (data.results ?? []).map((r) => this.mapMovie(r));
  }

  async trendingTv(): Promise<NormalizedContent[]> {
    const data = await this.get<{ results: Record<string, unknown>[] }>(
      "/trending/tv/day",
    );
    return (data.results ?? []).map((r) => this.mapTv(r));
  }

  async popularMovies(): Promise<NormalizedContent[]> {
    const data = await this.get<{ results: Record<string, unknown>[] }>(
      "/movie/popular",
    );
    return (data.results ?? []).map((r) => this.mapMovie(r));
  }

  async upcomingMovies(): Promise<NormalizedContent[]> {
    const data = await this.get<{ results: Record<string, unknown>[] }>(
      "/movie/upcoming",
    );
    return (data.results ?? []).map((r) => this.mapMovie(r));
  }

  async searchMovies(q: string): Promise<NormalizedContent[]> {
    if (!q.trim()) return [];
    const data = await this.get<{ results: Record<string, unknown>[] }>(
      "/search/movie",
      { query: q },
    );
    return (data.results ?? []).map((r) => this.mapMovie(r));
  }

  async searchTv(q: string): Promise<NormalizedContent[]> {
    if (!q.trim()) return [];
    const data = await this.get<{ results: Record<string, unknown>[] }>(
      "/search/tv",
      { query: q },
    );
    return (data.results ?? []).map((r) => this.mapTv(r));
  }
}

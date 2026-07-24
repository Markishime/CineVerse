/**
 * Server-only TMDB client used by catalog service when a TMDB credential is set.
 * Never import from client components.
 *
 * Prefers TMDB_ACCESS_TOKEN (Bearer v4). Falls back to TMDB_API_KEY (query param).
 */

const BASE = "https://api.themoviedb.org/3";

function tmdbCredentials():
  | { mode: "bearer"; token: string }
  | { mode: "api_key"; key: string }
  | null {
  const token = process.env.TMDB_ACCESS_TOKEN?.trim();
  if (token) return { mode: "bearer", token };
  const key = process.env.TMDB_API_KEY?.trim();
  if (key) return { mode: "api_key", key };
  return null;
}

export function isTmdbConfigured(): boolean {
  return tmdbCredentials() != null;
}

export async function tmdbFetch<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T | null> {
  const creds = tmdbCredentials();
  if (!creds) {
    console.warn(
      "[TMDB] No TMDB_ACCESS_TOKEN or TMDB_API_KEY — metadata unavailable (set on Vercel env)",
    );
    return null;
  }

  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  if (creds.mode === "api_key") {
    url.searchParams.set("api_key", creds.key);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (creds.mode === "bearer") {
      headers.Authorization = `Bearer ${creds.token}`;
    }
    const res = await fetch(url, {
      headers,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[TMDB] ${res.status} on ${path} — skipping`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.warn(
      `[TMDB] unavailable: ${e instanceof Error ? e.message : "error"}`,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

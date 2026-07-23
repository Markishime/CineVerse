/**
 * Server-only TMDB client used by catalog service when TMDB_ACCESS_TOKEN is set.
 * Never import from client components.
 */

const BASE = "https://api.themoviedb.org/3";

export async function tmdbFetch<T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T | null> {
  const token = process.env.TMDB_ACCESS_TOKEN;
  if (!token) return null;

  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
      next: { revalidate: 300 },
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

/**
 * Server-only AniList GraphQL client.
 */

const ENDPOINT = "https://graphql.anilist.co";

export async function anilistQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
      next: { revalidate: 1800 },
    });
    if (!res.ok) {
      console.error("AniList error", res.status);
      return null;
    }
    const json = (await res.json()) as { data?: T; errors?: unknown };
    if (json.errors) {
      console.error("AniList GraphQL errors", json.errors);
      return null;
    }
    return json.data ?? null;
  } catch (e) {
    console.error("AniList fetch failed", e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

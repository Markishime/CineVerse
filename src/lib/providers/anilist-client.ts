/**
 * Server-only AniList GraphQL client.
 */

const ENDPOINT = "https://graphql.anilist.co";

export async function anilistQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn(`[AniList] ${res.status} — skipping`);
      return null;
    }
    const json = (await res.json()) as { data?: T; errors?: unknown };
    if (json.errors) {
      console.warn("[AniList] GraphQL errors — skipping");
      return null;
    }
    return json.data ?? null;
  } catch (e) {
    console.warn(
      `[AniList] unavailable: ${e instanceof Error ? e.message : "error"}`,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

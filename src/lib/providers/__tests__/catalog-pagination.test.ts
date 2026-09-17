import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWorldMoviesPage } from "../live-catalog";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("movie catalog windows", () => {
  it("does not skip provider items across 25-item UI pages and excludes future releases", async () => {
    vi.stubEnv("TMDB_ACCESS_TOKEN", "test-token");
    const urls: URL[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const url = new URL(input); urls.push(url);
      const page = Number(url.searchParams.get("page"));
      return new Response(JSON.stringify({ total_pages: 5, total_results: 100,
        results: Array.from({ length: 20 }, (_, i) => ({ id: (page - 1) * 20 + i + 1, title: `Film ${(page - 1) * 20 + i + 1}`, release_date: "2026-01-01", adult: false, genre_ids: [], popularity: 1 })),
      }));
    }));
    const first = await fetchWorldMoviesPage(1, 25, "newest");
    const second = await fetchWorldMoviesPage(2, 25, "newest");
    expect(first.items.map((c) => c.providerIds.tmdb)).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
    expect(second.items.map((c) => c.providerIds.tmdb)).toEqual(Array.from({ length: 25 }, (_, i) => i + 26));
    expect(second.totalPages).toBe(4);
    expect(urls.every((u) => u.searchParams.has("primary_release_date.lte"))).toBe(true);
  });
});

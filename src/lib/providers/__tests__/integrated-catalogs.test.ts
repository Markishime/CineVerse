import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchWorldAnimePage,
  fetchWorldMoviesPage,
  resolveTmdbIdForTitle,
} from "../live-catalog";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("ordinary catalogs include authorized adult titles", () => {
  it("requests Filipino/Vivamax metadata from TMDB without overriding adult access", async () => {
    vi.stubEnv("TMDB_ACCESS_TOKEN", "test-token");
    const urls: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        urls.push(new URL(input));
        return new Response(
          JSON.stringify({
            total_results: 1,
            total_pages: 1,
            results: [
              {
                id: 7,
                title: "VMX Sample",
                original_language: "tl",
                adult: false,
                release_date: "2026-01-01",
                genre_ids: [18],
              },
            ],
          }),
        );
      }),
    );
    const result = await fetchWorldMoviesPage(1, 20, "popularity", true, "PH");
    expect(result.items[0]).toMatchObject({
      contentType: "movie",
      countries: ["PH"],
      providerIds: { tmdb: 7 },
      mature: true,
    });
    expect(urls[0].searchParams.get("region")).toBe("PH");
    expect(urls[0].searchParams.get("with_origin_country")).toBe("PH");
    expect(urls[0].searchParams.get("include_adult")).toBe("true");
    expect(urls[0].searchParams.has("without_companies")).toBe(false);
    expect(urls[0].searchParams.has("without_keywords")).toBe(false);
    await fetchWorldMoviesPage(1, 20, "popularity", false, "PH");
    expect(urls[1].searchParams.get("include_adult")).toBe("false");
    expect(urls[1].searchParams.has("without_companies")).toBe(true);
    expect(urls[1].searchParams.has("without_keywords")).toBe(true);
  });

  it("retains adult OVA/ONA titles on a full Anime Series page", async () => {
    vi.stubEnv("ANIDB_CACHE_DIR", "C:/cineverse-test-no-anidb-snapshot");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string, init?: RequestInit) => {
        const { variables: v } = JSON.parse(init!.body as string);
        const formatIndex = ["TV", "OVA", "ONA", "SPECIAL"].indexOf(v.format);
        return new Response(
          JSON.stringify({
            data: {
              Page: {
                pageInfo: { total: 200, lastPage: 4 },
                media: Array.from({ length: v.perPage }, (_, i) => ({
                  id:
                    (v.isAdult ? 10000 : 1) +
                    formatIndex * 1000 +
                    (v.page - 1) * v.perPage +
                    i,
                  title: {
                    english: `Sample ${v.format} ${v.isAdult} ${v.page} ${i}`,
                  },
                  format: v.format,
                  isAdult: v.isAdult,
                  episodes: 2,
                  startDate: { year: 2024 },
                  popularity: v.isAdult ? 1 : 9999,
                  genres: v.isAdult ? ["Hentai"] : ["Adventure"],
                })),
              },
            },
          }),
        );
      }),
    );
    const result = await fetchWorldAnimePage(
      1,
      60,
      "popularity",
      true,
      "series",
    );
    expect(result.items).toHaveLength(60);
    expect(result.items.some((c) => c.mature && c.animeFormat === "OVA")).toBe(
      true,
    );
    expect(result.items.some((c) => c.mature && c.animeFormat === "ONA")).toBe(
      true,
    );
    expect(result.items.every((c) => c.animeFormat !== "MOVIE")).toBe(true);
    const safe = await fetchWorldAnimePage(
      1,
      60,
      "popularity",
      false,
      "series",
    );
    expect(safe.items.every((c) => !c.mature)).toBe(true);
  });

  it("searches TMDB adult titles so hentai can use the shared servers", async () => {
    vi.stubEnv("TMDB_ACCESS_TOKEN", "test-token");
    const urls: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        urls.push(new URL(input));
        return new Response(
          JSON.stringify({
            results: [
              {
                id: 55,
                name: "Hentai Sample",
                original_name: "Hentai Sample",
                original_language: "ja",
                genre_ids: [16],
                popularity: 5,
                first_air_date: "2024-01-01",
              },
            ],
          }),
        );
      }),
    );

    const hit = await resolveTmdbIdForTitle({
      title: "Hentai Sample",
      year: 2024,
      requireAnimation: true,
      preferMovie: false,
      includeAdult: true,
    });
    expect(hit).toEqual({ tmdb: 55, tmdbMediaType: "tv" });
    expect(urls.length).toBeGreaterThan(0);
    expect(
      urls.every((u) => u.searchParams.get("include_adult") === "true"),
    ).toBe(true);
  });
});

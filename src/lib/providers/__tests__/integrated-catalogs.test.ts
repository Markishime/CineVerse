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
    const queries: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string, init?: RequestInit) => {
        const { variables: v } = JSON.parse(init!.body as string);
        queries.push(v);
        const formats = (v.format_in as string[] | undefined) ?? [
          v.format ?? "TV",
        ];
        return new Response(
          JSON.stringify({
            data: {
              Page: {
                pageInfo: { total: 200, lastPage: 4 },
                media: Array.from({ length: v.perPage }, (_, i) => {
                  const absolute = (v.page - 1) * v.perPage + i;
                  const format = formats[absolute % formats.length];
                  const adult = format === "OVA" || format === "ONA";
                  return {
                    id: absolute + 1,
                    title: {
                      english: `Sample ${format} ${adult} ${v.page} ${i}`,
                    },
                    format,
                    isAdult: adult,
                    episodes: 2,
                    startDate: { year: 2024 },
                    popularity: 10000 - absolute,
                    genres: adult ? ["Hentai"] : ["Adventure"],
                  };
                }),
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
    expect(queries[0]).toMatchObject({
      format_in: ["TV", "OVA", "ONA", "SPECIAL"],
    });
    expect(queries[0].isAdult).toBeUndefined();
    expect(queries[0].genre_not_in).toBeUndefined();

    const safe = await fetchWorldAnimePage(
      1,
      60,
      "popularity",
      false,
      "series",
    );
    expect(safe.items.every((c) => !c.mature)).toBe(true);
    const safeQuery = queries.at(-1)!;
    expect(safeQuery.isAdult).toBe(false);
    expect(safeQuery.genre_not_in).toEqual(["Ecchi", "Erotica", "Hentai"]);
  });

  it("keeps anime that has no English title", async () => {
    vi.stubEnv("ANIDB_CACHE_DIR", "C:/cineverse-test-no-anidb-snapshot");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: {
              Page: {
                pageInfo: { total: 1, lastPage: 1 },
                media: [
                  {
                    id: 9001,
                    title: {
                      romaji: "Romaji Only",
                      english: null,
                      native: null,
                    },
                    format: "TV",
                    isAdult: false,
                    episodes: 12,
                    startDate: { year: 2024 },
                    popularity: 1,
                    genres: ["Adventure"],
                  },
                ],
              },
            },
          }),
        ),
      ),
    );

    const result = await fetchWorldAnimePage(1, 60, "popularity", false);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      title: "Romaji Only",
      romajiTitle: "Romaji Only",
    });
    expect(result.items[0].englishTitle).toBeUndefined();
  });

  it("refills a catalog page when a filtered title shortens the window", async () => {
    vi.stubEnv("ANIDB_CACHE_DIR", "C:/cineverse-test-no-anidb-snapshot");
    const requestedPages: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string, init?: RequestInit) => {
        const { variables: v } = JSON.parse(init!.body as string);
        requestedPages.push(v.page);
        return new Response(
          JSON.stringify({
            data: {
              Page: {
                pageInfo: { total: 5000, lastPage: 100 },
                media: Array.from({ length: v.perPage }, (_, i) => {
                  const absolute = (v.page - 1) * v.perPage + i;
                  const adult = absolute === 3545;
                  return {
                    id: absolute + 1,
                    title: { english: `Anime ${absolute + 1}` },
                    format: "TV",
                    isAdult: adult,
                    episodes: 12,
                    startDate: { year: 2024 },
                    popularity: 5000 - absolute,
                    genres: adult ? ["Hentai"] : ["Action"],
                  };
                }),
              },
            },
          }),
        );
      }),
    );

    const result = await fetchWorldAnimePage(60, 60, "popularity", false);
    expect(result.items).toHaveLength(60);
    expect(result.items.some((c) => c.providerIds.anilist === 3546)).toBe(
      false,
    );
    expect(requestedPages).toContain(73);
  });

  it("returns contiguous 60-item windows across AniList's 50-item pages", async () => {
    vi.stubEnv("ANIDB_CACHE_DIR", "C:/cineverse-test-no-anidb-snapshot");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string, init?: RequestInit) => {
        const { variables: v } = JSON.parse(init!.body as string);
        return new Response(
          JSON.stringify({
            data: {
              Page: {
                pageInfo: { total: 5000, lastPage: 100 },
                media: Array.from({ length: v.perPage }, (_, i) => ({
                  id: (v.page - 1) * v.perPage + i + 1,
                  title: { english: `Anime ${v.page}-${i}` },
                  format: "TV",
                  isAdult: false,
                  episodes: 12,
                  startDate: { year: 2024 },
                  popularity: 100000 - ((v.page - 1) * v.perPage + i),
                  genres: ["Action"],
                })),
              },
            },
          }),
        );
      }),
    );

    const page = async (n: number) =>
      (
        await fetchWorldAnimePage(n, 60, "popularity", false)
      ).items.map((c) => c.providerIds.anilist);

    expect(await page(1)).toEqual(
      Array.from({ length: 60 }, (_, i) => i + 1),
    );
    expect(await page(2)).toEqual(
      Array.from({ length: 60 }, (_, i) => i + 61),
    );
    expect(await page(51)).toEqual(
      Array.from({ length: 60 }, (_, i) => i + 3001),
    );
    const last = await fetchWorldAnimePage(84, 60, "popularity", false);
    expect(last.totalPages).toBe(84);
    expect(last.items).toHaveLength(20);
    expect(last.items[0].providerIds.anilist).toBe(4981);
  });

  it("uses the real AniList tail for movie pagination", async () => {
    vi.stubEnv("ANIDB_CACHE_DIR", "C:/cineverse-test-no-anidb-snapshot");
    const lastPage = 69;
    const lastCount = 18;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string, init?: RequestInit) => {
        const { variables: v } = JSON.parse(init!.body as string);
        const start = (v.page - 1) * v.perPage;
        const count =
          v.page < lastPage
            ? v.perPage
            : v.page === lastPage
              ? lastCount
              : 0;
        return new Response(
          JSON.stringify({
            data: {
              Page: {
                pageInfo: {
                  total: v.page < lastPage ? 5000 : 3418,
                  lastPage: v.page < lastPage ? 100 : v.page,
                },
                media: Array.from({ length: count }, (_, i) => ({
                  id: start + i + 1,
                  title: { english: `Movie ${start + i + 1}` },
                  format: "MOVIE",
                  isAdult: false,
                  episodes: 1,
                  startDate: { year: 2024 },
                  popularity: 10000 - start - i,
                  genres: ["Adventure"],
                })),
              },
            },
          }),
        );
      }),
    );

    const first = await fetchWorldAnimePage(
      1,
      60,
      "popularity",
      false,
      "movie",
      "Adventure",
    );
    expect(first.total).toBe(3418);
    expect(first.totalPages).toBe(57);

    const last = await fetchWorldAnimePage(
      57,
      60,
      "popularity",
      false,
      "movie",
      "Adventure",
    );
    expect(last.items).toHaveLength(58);
    expect(last.items[0].providerIds.anilist).toBe(3361);
    expect(last.items.at(-1)?.providerIds.anilist).toBe(3418);

    const beyond = await fetchWorldAnimePage(
      58,
      60,
      "popularity",
      false,
      "movie",
      "Adventure",
    );
    expect(beyond.items).toHaveLength(0);
    expect(beyond.page).toBe(57);
  });

  it("sorts oldest anime with AniList's valid START_DATE sort", async () => {
    vi.stubEnv("ANIDB_CACHE_DIR", "C:/cineverse-test-no-anidb-snapshot");
    const sorts: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: string, init?: RequestInit) => {
        const { variables: v } = JSON.parse(init!.body as string);
        sorts.push(v.sort);
        return new Response(
          JSON.stringify({
            data: {
              Page: {
                pageInfo: { total: 1, lastPage: 1 },
                media: [],
              },
            },
          }),
        );
      }),
    );

    await fetchWorldAnimePage(1, 60, "oldest", false);
    expect(sorts[0]).toEqual(["START_DATE"]);
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

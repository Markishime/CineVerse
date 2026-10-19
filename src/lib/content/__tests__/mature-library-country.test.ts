import { beforeEach, describe, expect, it, vi } from "vitest";
import { catalog } from "@/lib/content/catalog-service";
import { applyMatureFlag } from "@/lib/content/mature";
import type { Content } from "@/types/content";

function adultMovie(
  id: string,
  countries: string[],
  title: string,
  language = "en",
): Content {
  return applyMatureFlag({
    id,
    slug: id,
    contentType: "movie",
    title,
    overview: "An explicit sex drama about seduction and desire.",
    status: "released",
    countries,
    language,
    genres: [],
    scores: [],
    popularity: 50,
    poster: null,
    backdrop: null,
    releaseDate: "2021-01-01",
    year: 2021,
    trailer: null,
    watchProviders: [],
    providerIds: {},
    studios: [],
    tags: ["filipino", "ph"],
    alternateTitles: [],
    approved: true,
    mature: true,
    lastSyncedAt: new Date().toISOString(),
  } as unknown as Content);
}

describe("matureLibrary country filter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("narrows the adult slice to the requested country", async () => {
    const ph = adultMovie("ph_1", ["PH"], "Init");
    const us = adultMovie("us_1", ["US"], "Bold Nights");

    vi.spyOn(catalog, "loadLive").mockResolvedValue([ph, us]);

    const phOnly = await catalog.matureLibrary(1, 60, "movie", "PH");
    expect(phOnly.items.map((c) => c.id)).toEqual(["ph_1"]);

    const all = await catalog.matureLibrary(1, 60, "movie");
    expect(all.items.map((c) => c.id).sort()).toEqual(["ph_1", "us_1"]);
  });

  it("falls back to language code when country codes are absent", async () => {
    // The filter matches countries OR language === the passed code, so a
    // Tagalog title with no country tags is found by its language code.
    const tl = adultMovie("tl_1", [], "Silip", "tl");
    vi.spyOn(catalog, "loadLive").mockResolvedValue([tl]);

    const byLanguage = await catalog.matureLibrary(1, 60, "all", "tl");
    expect(byLanguage.items.map((c) => c.id)).toEqual(["tl_1"]);

    const byCountry = await catalog.matureLibrary(1, 60, "all", "PH");
    expect(byCountry.items).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { tmdbDiscoverParams } from "../live-catalog";
import {
  TMDB_ADULT_COMPANY_IDS,
  TMDB_ADULT_KEYWORD_IDS,
} from "@/lib/content/adult-filter";
import {
  applyMatureFlag,
  filterAdultLibrary,
  filterHentaiLibrary,
  filterPublicCatalog,
  isHentaiContent,
} from "@/lib/content/mature";
import type { Content } from "@/types/content";

/**
 * The public surface must never see adult titles, and the 18+ library must
 * always be able to ask TMDB for them. These tests pin that split, because a
 * mature-mode discover that silently keeps the public exclusions returns
 * nothing at all — no hentai, no 3D hentai, no adult Filipino titles.
 */
describe("tmdbDiscoverParams — public vs mature access", () => {
  it("public discover excludes adult titles, sexual keywords and Vivamax producers", () => {
    const p = tmdbDiscoverParams("/discover/movie", {
      sort_by: "popularity.desc",
    });
    expect(p.include_adult).toBe("false");
    expect(p.without_keywords).toBe(TMDB_ADULT_KEYWORD_IDS);
    expect(p.without_companies).toBe(TMDB_ADULT_COMPANY_IDS);
  });

  it("mature discover turns adult on and drops both blocklists", () => {
    const p = tmdbDiscoverParams(
      "/discover/movie",
      { sort_by: "popularity.desc" },
      "mature",
    );
    expect(p.include_adult).toBe("true");
    expect(p.without_keywords).toBeUndefined();
    expect(p.without_companies).toBeUndefined();
  });

  it("mature mode wins even when the caller passes include_adult=false", () => {
    const p = tmdbDiscoverParams(
      "/discover/tv",
      { include_adult: "false" },
      "mature",
    );
    expect(p.include_adult).toBe("true");
  });

  it("applies the same rules to /discover/tv", () => {
    const mature = tmdbDiscoverParams(
      "/discover/tv",
      { with_origin_country: "PH" },
      "mature",
    );
    expect(mature).toEqual({
      with_origin_country: "PH",
      include_adult: "true",
    });
    const pub = tmdbDiscoverParams(
      "/discover/tv",
      { with_origin_country: "PH" },
      "public",
    );
    expect(pub.include_adult).toBe("false");
    expect(pub.without_companies).toBe(TMDB_ADULT_COMPANY_IDS);
  });

  it("never rewrites non-discover endpoints", () => {
    const params = { include_adult: "true", query: "hentai" };
    expect(tmdbDiscoverParams("/search/movie", params, "mature")).toEqual(
      params,
    );
    expect(tmdbDiscoverParams("/trending/movie/day", {}, "public")).toEqual({});
  });

  it("does not mutate the caller's params object", () => {
    const input = { sort_by: "popularity.desc" };
    tmdbDiscoverParams("/discover/movie", input, "mature");
    expect(input).toEqual({ sort_by: "popularity.desc" });
  });
});

const base = {
  id: "tmdb_anime_1",
  slug: "tmdb-anime-1",
  contentType: "anime" as const,
  animeFormat: "TV" as const,
  title: "Some Hentai",
  overview: "",
  status: "released" as const,
  countries: ["JP"],
  genres: [{ id: "animation", name: "Animation" }],
  scores: [],
  popularity: 12,
  trailer: null,
  watchProviders: [],
  providerIds: { tmdb: 1, tmdbMediaType: "tv" as const },
  studios: [],
  tags: ["anime", "animation", "hentai", "18+", "mature", "explicit", "nudity"],
  alternateTitles: [],
  approved: true,
  mature: true,
  ageRating: "18+",
  lastSyncedAt: new Date().toISOString(),
} as Content;

/** Shape produced by fetchTmdbMature for the adult-Filipino (Vivamax) group. */
const filipino = {
  ...base,
  id: "tmdb_movie_2",
  slug: "tmdb-movie-2",
  contentType: "movie" as const,
  animeFormat: undefined,
  title: "Bold Filipino Film",
  countries: ["PH"],
  language: "tl",
  tags: [
    "filipino",
    "adult-filipino",
    "sexual-content",
    "18+",
    "mature",
    "explicit",
    "nudity",
  ],
  providerIds: { tmdb: 2, tmdbMediaType: "movie" as const },
} as Content;

describe("TMDB mature rows land in the right restricted library", () => {
  const hentai = applyMatureFlag(base);
  const ph = applyMatureFlag(filipino);

  it("hentai (incl. 3D) counts as true hentai and stays out of public surfaces", () => {
    expect(isHentaiContent(hentai)).toBe(true);
    expect(filterHentaiLibrary([hentai, ph])).toEqual([hentai]);
    expect(filterAdultLibrary([hentai, ph])).toHaveLength(2);
    expect(filterPublicCatalog([hentai, ph])).toHaveLength(0);
  });

  it("adult Filipino titles are adults-only but not hentai", () => {
    expect(isHentaiContent(ph)).toBe(false);
    expect(filterAdultLibrary([ph])).toEqual([ph]);
    expect(filterPublicCatalog([ph])).toHaveLength(0);
  });

  it("keeps the PH identity so the Filipino filter can find them", () => {
    expect(ph.countries).toContain("PH");
    expect(ph.tags).toContain("filipino");
    expect(ph.mature).toBe(true);
    expect(ph.ageRating).toBe("18+");
  });
});

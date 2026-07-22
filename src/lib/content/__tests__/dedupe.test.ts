import { describe, expect, it } from "vitest";
import { deduplicateContent, rankSearchResults } from "../dedupe";
import type { Content } from "@/types/content";

function base(partial: Partial<Content> & Pick<Content, "id" | "title">): Content {
  return {
    slug: partial.slug ?? partial.id,
    contentType: "movie",
    overview: "",
    countries: [],
    genres: [],
    scores: [],
    popularity: 0,
    watchProviders: [],
    providerIds: {},
    studios: [],
    tags: [],
    alternateTitles: [],
    approved: true,
    mature: false,
    playable: false,
    status: "released",
    ...partial,
  };
}

describe("deduplicateContent", () => {
  it("merges same TMDB id", () => {
    const a = base({
      id: "a",
      title: "Inception",
      popularity: 10,
      providerIds: { tmdb: 27205, tmdbMediaType: "movie" },
    });
    const b = base({
      id: "b",
      title: "Inception",
      popularity: 90,
      providerIds: { tmdb: 27205, tmdbMediaType: "movie" },
    });
    const result = deduplicateContent([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0]!.popularity).toBe(90);
  });

  it("does NOT merge different films sharing a title+year (wrong-movie bug)", () => {
    // Two distinct works TMDB returns with the same English title & year —
    // common for Korean/Japanese/Chinese/Thai/Filipino films. Must stay two
    // separate cards, each keeping its OWN tmdb id (or the wrong one plays).
    const korean = base({
      id: "tmdb_movie_111",
      title: "Homecoming",
      year: 2021,
      popularity: 40,
      language: "ko",
      countries: ["KR"],
      providerIds: { tmdb: 111, tmdbMediaType: "movie" },
    });
    const western = base({
      id: "tmdb_movie_222",
      title: "Homecoming",
      year: 2021,
      popularity: 95,
      language: "en",
      countries: ["US"],
      providerIds: { tmdb: 222, tmdbMediaType: "movie" },
    });
    const result = deduplicateContent([korean, western]);
    expect(result).toHaveLength(2);
    const ids = result.map((c) => c.providerIds.tmdb).sort();
    expect(ids).toEqual([111, 222]);
    // Each card must still point at its own movie for playback.
    const kr = result.find((c) => c.id === "tmdb_movie_111");
    expect(kr?.providerIds.tmdb).toBe(111);
  });

  it("does NOT let a same-title series steal a movie's tmdb id", () => {
    const movie = base({
      id: "tmdb_movie_500",
      title: "Parasite",
      year: 2019,
      providerIds: { tmdb: 500, tmdbMediaType: "movie" },
    });
    const series = base({
      id: "tmdb_tv_900",
      title: "Parasite",
      year: 2019,
      contentType: "series",
      providerIds: { tmdb: 900, tmdbMediaType: "tv" },
    });
    const result = deduplicateContent([movie, series]);
    expect(result).toHaveLength(2);
    expect(
      result.find((c) => c.contentType === "movie")?.providerIds.tmdb,
    ).toBe(500);
    expect(
      result.find((c) => c.contentType === "series")?.providerIds.tmdb,
    ).toBe(900);
  });

  it("still merges genuine duplicates that lack ids (title+year)", () => {
    const a = base({ id: "a", title: "Old Boy", year: 2003, popularity: 5 });
    const b = base({ id: "b", title: "Old Boy", year: 2003, popularity: 50 });
    const result = deduplicateContent([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0]!.popularity).toBe(50);
  });
});

describe("rankSearchResults", () => {
  it("ranks exact title matches first", () => {
    const items = [
      base({ id: "1", title: "Dark Matter", popularity: 100 }),
      base({ id: "2", title: "Dark", popularity: 10 }),
      base({ id: "3", title: "Something Dark", popularity: 50 }),
    ];
    const ranked = rankSearchResults(items, "Dark");
    expect(ranked[0]!.title).toBe("Dark");
  });
});

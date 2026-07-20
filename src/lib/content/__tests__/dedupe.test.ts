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

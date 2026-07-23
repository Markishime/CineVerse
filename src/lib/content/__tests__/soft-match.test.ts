import { describe, expect, it } from "vitest";
import { softMatchByIdentity } from "../catalog-service";
import type { Content } from "@/types/content";

function base(
  partial: Partial<Content> & Pick<Content, "id" | "title" | "slug">,
): Content {
  return {
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

const catalog: Content[] = [
  base({
    id: "tmdb_movie_100",
    title: "Parasite",
    slug: "parasite-100",
    providerIds: { tmdb: 100, tmdbMediaType: "movie" },
  }),
  base({
    id: "tmdb_movie_555",
    title: "Old Parasite",
    slug: "old-parasite-555",
    providerIds: { tmdb: 555, tmdbMediaType: "movie" },
  }),
  base({
    id: "anilist_456",
    title: "Some Anime",
    slug: "some-anime-456",
    contentType: "anime",
    providerIds: { anilist: 456 },
  }),
];

describe("softMatchByIdentity (exact identity only)", () => {
  it("resolves a full provider-typed id", () => {
    expect(softMatchByIdentity(catalog, "tmdb_movie_100")?.id).toBe(
      "tmdb_movie_100",
    );
  });

  it("resolves exact slug", () => {
    expect(softMatchByIdentity(catalog, "parasite-100")?.id).toBe(
      "tmdb_movie_100",
    );
  });

  it("resolves a bare numeric id to its provider match", () => {
    expect(softMatchByIdentity(catalog, "456")?.id).toBe("anilist_456");
  });

  it("does NOT treat a release year as a provider id (wrong-video bug)", () => {
    // "parasite-2019" must not resolve to tmdb id 2019 or random year match
    expect(softMatchByIdentity(catalog, "2019")).toBeUndefined();
    expect(softMatchByIdentity(catalog, "parasite-2019")).toBeUndefined();
  });

  it("does NOT resolve bare title stems (prevents wrong film)", () => {
    expect(softMatchByIdentity(catalog, "parasite")).toBeUndefined();
  });

  it("does NOT substring-match ids", () => {
    expect(softMatchByIdentity(catalog, "10")).toBeUndefined();
  });

  it("returns undefined for empty / unmatched queries", () => {
    expect(softMatchByIdentity(catalog, "")).toBeUndefined();
    expect(
      softMatchByIdentity(catalog, "totally-unknown-title"),
    ).toBeUndefined();
  });
});

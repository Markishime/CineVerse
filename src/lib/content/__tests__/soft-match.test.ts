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

describe("softMatchByIdentity (tightened slug fallback)", () => {
  it("resolves a full provider-typed id", () => {
    expect(softMatchByIdentity(catalog, "tmdb_movie_100")?.id).toBe(
      "tmdb_movie_100",
    );
  });

  it("resolves a slug carrying the provider id suffix", () => {
    expect(softMatchByIdentity(catalog, "parasite-100")?.id).toBe(
      "tmdb_movie_100",
    );
  });

  it("resolves a bare numeric id to its provider match", () => {
    expect(softMatchByIdentity(catalog, "456")?.id).toBe("anilist_456");
  });

  it("does NOT resolve a title to a DIFFERENT film sharing a suffix", () => {
    // The old bug: "parasite" matched "old-parasite-555" via endsWith.
    // Now the stem of "parasite" ("parasite") only equals the stem of
    // "parasite-100", never "old-parasite-555".
    const hit = softMatchByIdentity(catalog, "parasite");
    expect(hit?.id).toBe("tmdb_movie_100");
    expect(hit?.id).not.toBe("tmdb_movie_555");
  });

  it("does NOT substring-match ids", () => {
    // "10" must not resolve to tmdb_movie_100 via includes().
    expect(softMatchByIdentity(catalog, "10")).toBeUndefined();
  });

  it("resolves exact slug stem when suffix drifted off", () => {
    // Query lost its -100; exact stem "parasite" matches only parasite-100.
    // (Guarded: only the parasite-100 stem equals "parasite", not old-parasite.)
    expect(softMatchByIdentity(catalog, "parasite-100")?.id).toBe(
      "tmdb_movie_100",
    );
    // A stem that matches nothing exactly returns undefined.
    expect(softMatchByIdentity(catalog, "para")).toBeUndefined();
  });

  it("returns undefined for empty / unmatched queries", () => {
    expect(softMatchByIdentity(catalog, "")).toBeUndefined();
    expect(softMatchByIdentity(catalog, "totally-unknown-title")).toBeUndefined();
  });
});

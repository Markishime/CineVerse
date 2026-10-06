import { describe, expect, it } from "vitest";
import {
  canonicalPathKey,
  getDetailsHref,
  getTrailerHref,
  getWatchHref,
} from "../watch-href";

describe("getDetailsHref", () => {
  it("uses the provider identity for a live TMDB result", () => {
    expect(
      getDetailsHref({ id: "tmdb_tv_4682", slug: "ben-10-4682" }),
    ).toBe("/content/tmdb_tv_4682");
  });

  it("uses the provider identity for a live AniList result", () => {
    expect(
      getDetailsHref({ id: "anilist_16498", slug: "attack-on-titan-16498" }),
    ).toBe("/content/anilist_16498");
  });

  it("uses the provider identity for a live TVMaze result", () => {
    expect(getDetailsHref({ id: "tvmaze_4682", slug: "ben-10" })).toBe(
      "/content/tvmaze_4682",
    );
  });

  it("keeps catalog-native links human-readable", () => {
    expect(getDetailsHref({ id: "seed_1", slug: "a-catalog-title" })).toBe(
      "/content/a-catalog-title",
    );
  });
});

describe("canonicalPathKey", () => {
  it("prefers the resolvable provider id over the display slug", () => {
    expect(canonicalPathKey({ id: "tvmaze_951", slug: "ben-10-951" })).toBe(
      "tvmaze_951",
    );
    expect(
      canonicalPathKey({ id: "tmdb_movie_25642", slug: "ben-10-25642" }),
    ).toBe("tmdb_movie_25642");
  });

  it("falls back to the slug when no provider id exists", () => {
    expect(canonicalPathKey({ id: "seed_1", slug: "a-catalog-title" })).toBe(
      "a-catalog-title",
    );
  });
});

describe("getWatchHref", () => {
  it("keeps TVMaze-only series on an identity path", () => {
    expect(
      getWatchHref({
        id: "tvmaze_951",
        slug: "ben-10-951",
        contentType: "series",
        providerIds: { tvmaze: 951 },
      }),
    ).toBe("/watch/tvmaze_951?play=full");
  });

  it("keeps anime on its AniList identity path", () => {
    expect(
      getWatchHref({
        id: "anilist_16498",
        slug: "attack-on-titan-16498",
        contentType: "anime",
        providerIds: { anilist: 16498 },
      }),
    ).toBe("/watch/anilist_16498?play=full&season=1&episode=1");
  });

  it("still routes trusted TMDB titles to the bare embed path", () => {
    expect(
      getWatchHref({
        id: "tmdb_movie_25642",
        slug: "ben-10-alien-swarm-25642",
        contentType: "movie",
        providerIds: { tmdb: 25642, tmdbMediaType: "movie" },
      }),
    ).toBe("/watch/movie/25642");
  });

  it("keeps catalog-native titles on their slug path", () => {
    expect(
      getWatchHref({
        id: "seed_1",
        slug: "a-catalog-title",
        contentType: "series",
        providerIds: {},
      }),
    ).toBe("/watch/a-catalog-title?play=full");
  });
});

describe("getTrailerHref", () => {
  it("uses the provider identity so the page resolves cold", () => {
    expect(
      getTrailerHref({ id: "tvmaze_951", slug: "ben-10-951", trailer: null }),
    ).toBe("/watch/tvmaze_951?play=trailer");
  });
});

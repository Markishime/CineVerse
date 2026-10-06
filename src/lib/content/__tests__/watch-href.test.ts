import { describe, expect, it } from "vitest";
import { getDetailsHref } from "../watch-href";

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

import { describe, expect, it } from "vitest";
import {
  buildEmbedUrl,
  getProviderName,
  getProvidersForContentType,
} from "../providers";

const additions = ["vidrock", "vidsrcsh", "multiembed"] as const;

describe("additional movie and TV providers", () => {
  it.each([
    ["movie", "movie"],
    ["series", "tv"],
    ["kdrama", "tv"],
    ["cdrama", "tv"],
    ["jdrama", "tv"],
    ["thaidrama", "tv"],
    ["kdrama", "movie"],
  ] as const)(
    "offers additional servers for %s / %s",
    (contentType, mediaType) => {
      const providers = getProvidersForContentType(
        contentType,
        mediaType,
        { tmdb: 123 },
        2,
        3,
      );
      expect(providers.slice(0, 4).map((p) => p.id)).toEqual([
        "vidfast",
        ...additions,
      ]);
      expect(new Set(providers.map((p) => p.id)).size).toBe(providers.length);
      for (const p of providers)
        expect(buildEmbedUrl(p.id, 123, mediaType, 2, 3)).toBeTruthy();
    },
  );

  it.each([
    { originalLanguage: "tl" },
    { originalLanguage: "fil" },
    { originalLanguage: "tgl" },
    { originalLanguage: "en", countries: ["PH"] },
  ])("includes extra servers for Filipino identity %j", (locale) => {
    for (const [contentType, mediaType] of [
      ["movie", "movie"],
      ["series", "tv"],
    ] as const) {
      const ids = getProvidersForContentType(contentType, mediaType, {
        tmdb: 123,
        ...locale,
      }).map((p) => p.id);
      expect(ids).toEqual(expect.arrayContaining([...additions]));
    }
  });

  it.each(["MOVIE", "TV"] as const)(
    "excludes additional servers from anime %s",
    (animeFormat) => {
      const ids = getProvidersForContentType(
        "anime",
        animeFormat === "MOVIE" ? "movie" : "tv",
        {
          tmdb: 123,
          anilist: 1,
          mal: 1,
          animeFormat,
          countries: ["PH"],
          originalLanguage: "tl",
        },
      ).map((p) => p.id);
      for (const id of additions) expect(ids).not.toContain(id);
    },
  );

  it("builds documented movie and episode URLs with TMDB identities", () => {
    expect(buildEmbedUrl("vidrock", 123, "movie")).toBe(
      "https://vidrock.net/movie/123",
    );
    expect(buildEmbedUrl("vidrock", 123, "tv", 2, 3)).toBe(
      "https://vidrock.net/tv/123/2/3",
    );
    expect(buildEmbedUrl("vidsrcsh", 123, "movie")).toBe(
      "https://vidsrc.sh/embed/movie/123",
    );
    expect(buildEmbedUrl("vidsrcsh", 123, "tv", 2, 3)).toBe(
      "https://vidsrc.sh/embed/tv/123/2/3",
    );
    expect(buildEmbedUrl("multiembed", 123, "movie")).toBe(
      "https://multiembed.mov/?video_id=123&tmdb=1",
    );
    expect(buildEmbedUrl("multiembed", 123, "tv", 2, 3)).toBe(
      "https://multiembed.mov/?video_id=123&tmdb=1&s=2&e=3",
    );
    for (const id of additions) {
      expect(buildEmbedUrl(id, 123, "tv")).toBeNull();
      expect(getProviderName(id)).not.toBe(id);
    }
  });
});

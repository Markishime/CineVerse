import { describe, expect, it } from "vitest";
import {
  buildEmbedUrl,
  buildAnimeEmbedUrl,
  EMBED_PROVIDERS,
  getProvidersForContentType,
  getProvidersForMediaType,
} from "@/lib/embed/providers";

describe("embed provider order", () => {
  it("does not ship retired providers", () => {
    const ids = EMBED_PROVIDERS.map((provider) => provider.id) as string[];
    expect(ids).not.toContain(`${"video"}${"easy"}`);
    expect(ids).not.toContain("vixsrc");
    expect(ids).not.toContain("moviesapi");
    expect(ids).not.toContain("screenscape");
    expect(ids).not.toContain("vidlink");
    expect(ids).not.toContain("nontongo");
    expect(ids).not.toContain("superembed");
    expect(ids).not.toContain("kisskh");
  });

  it.each([
    ["movie", "movie"],
    ["series", "tv"],
    ["kdrama", "tv"],
    ["cdrama", "tv"],
    ["jdrama", "tv"],
    ["thaidrama", "tv"],
  ] as const)(
    "orders verified providers first for %s",
    (contentType, mediaType) => {
      const providers = getProvidersForContentType(contentType, mediaType, {
        tmdb: 550,
        anilist: 1,
        mal: 1,
      });
      const expected = ["vidfast", "vidrock", "vidsrcsh", "multiembed"];
      expect(providers.slice(0, 4).map((p) => p.id)).toEqual(expected);
    },
  );

  it.each(["movie", "tv"] as const)(
    "uses VidFast first for direct %s provider lists",
    (mediaType) => {
      expect(getProvidersForMediaType(mediaType)[0].id).toBe("vidfast");
    },
  );

  it.each(["MOVIE", "TV"] as const)(
    "keeps the existing shared providers for anime %s with the correct URL",
    (animeFormat) => {
      const mediaType = animeFormat === "MOVIE" ? "movie" : "tv";
      const movieProviders = getProvidersForMediaType("movie");
      const animeIds = {
        title: "Anime title",
        tmdb: 123,
        anilist: 1,
        mal: 1,
        animeFormat,
        season: 2,
        episode: 3,
      };
      const animeProviders = getProvidersForContentType(
        "anime",
        mediaType,
        animeIds,
        2,
        3,
      );
      expect(animeProviders.map((p) => p.id)).toEqual([
        ...movieProviders.map((p) => p.id),
        "megaplay",
        "cinezo",
      ]);
      for (const provider of movieProviders) {
        expect(buildAnimeEmbedUrl(provider.id, animeIds)).toBe(
          buildEmbedUrl(provider.id, 123, mediaType, 2, 3),
        );
      }
    },
  );

  it("keeps native anime sources when no matching TMDB identity exists", () => {
    const providers = getProvidersForContentType("anime", "tv", {
      anilist: 1,
      mal: 1,
      animeFormat: "TV",
    });
    expect(providers.map((p) => p.id)).toEqual(["megaplay", "cinezo"]);
  });

  it("uses AutoEmbed episode paths even if a movie media type leaks into anime series", () => {
    expect(
      buildAnimeEmbedUrl("autoembed", {
        title: "Anime series",
        tmdb: 85937,
        animeFormat: "TV",
        tmdbMediaType: "movie",
        season: 2,
        episode: 3,
      }),
    ).toBe("https://player.autoembed.co/embed/tv/85937/2-3/");
    expect(buildEmbedUrl("autoembed", 372058, "movie")).toBe(
      "https://player.autoembed.co/embed/movie/372058",
    );
  });

  it("keeps the verified VidFast URL formats", () => {
    expect(buildEmbedUrl("vidfast", 550, "movie")).toBe(
      "https://vidfast.vc/movie/550?autoPlay=true",
    );
    expect(buildEmbedUrl("vidfast", 1399, "tv", 2, 3)).toBe(
      "https://vidfast.vc/tv/1399/2/3?autoPlay=true",
    );
    expect(buildEmbedUrl("vidsrcpm", 550, "movie")).toBe(
      "https://vidsrc.pm/embed/movie/550",
    );
  });

  it("builds the remaining fallback URLs", () => {
    expect(buildEmbedUrl("2embed", 550, "movie")).toBe(
      "https://www.2embed.online/embed/movie/550",
    );
    expect(buildEmbedUrl("2embedskin", 550, "movie")).toBe(
      "https://www.2embed.skin/embed/movie/550",
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  buildEmbedUrl,
  EMBED_PROVIDERS,
  getProvidersForContentType,
} from "@/lib/embed/providers";

describe("embed provider order", () => {
  it("does not ship retired providers", () => {
    const ids = EMBED_PROVIDERS.map((provider) => provider.id) as string[];
    expect(ids).not.toContain(`${"video"}${"easy"}`);
    expect(ids).not.toContain("vixsrc");
    expect(ids).not.toContain("moviesapi");
    expect(ids).not.toContain("screenscape");
  });

  it.each([
    ["movie", "movie"],
    ["series", "tv"],
    ["anime", "tv"],
    ["kdrama", "tv"],
    ["cdrama", "tv"],
  ] as const)("orders AutoEmbed → VidLink first for %s", (
    contentType,
    mediaType,
  ) => {
    const providers = getProvidersForContentType(contentType, mediaType, {
      tmdb: 550,
      anilist: 1,
      mal: 1,
    });
    expect(providers.slice(0, 3).map((p) => p.id)).toEqual([
      "autoembed",
      "vidlink",
      "2embed",
    ]);
  });

  it("builds movie and tv urls for the two lead servers", () => {
    expect(buildEmbedUrl("autoembed", 550, "movie")).toBe(
      "https://autoembed.co/movie/tmdb/550",
    );
    expect(buildEmbedUrl("vidlink", 550, "movie")).toBe(
      "https://vidlink.pro/movie/550?autoplay=true",
    );
    expect(buildEmbedUrl("vidlink", 1399, "tv", 2, 3)).toBe(
      "https://vidlink.pro/tv/1399/2/3?autoplay=true",
    );
    expect(buildEmbedUrl("autoembed", 1399, "tv", 2, 3)).toBe(
      "https://autoembed.co/tv/tmdb/1399-2-3",
    );
  });
});

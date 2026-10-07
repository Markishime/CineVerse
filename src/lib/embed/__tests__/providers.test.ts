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
    expect(ids).not.toContain(`${"vid"}${"link"}`);
  });

  it.each([
    ["movie", "movie"],
    ["series", "tv"],
    ["anime", "tv"],
    ["kdrama", "tv"],
    ["cdrama", "tv"],
  ] as const)(
    "orders VixSrc → MoviesAPI → AutoEmbed first for %s",
    (contentType, mediaType) => {
      const providers = getProvidersForContentType(contentType, mediaType, {
        tmdb: 550,
        anilist: 1,
        mal: 1,
      });
      expect(providers.slice(0, 3).map((p) => p.id)).toEqual([
        "vixsrc",
        "moviesapi",
        "autoembed",
      ]);
    },
  );

  it("probes VixSrc so a blocked host is skipped instead of stalling playback", () => {
    const vixsrc = EMBED_PROVIDERS.find((p) => p.id === "vixsrc");
    expect(vixsrc?.probeUrl).toBe("https://vixsrc.to/favicon.ico");
  });

  it("builds movie and tv urls for the three primary servers", () => {
    expect(buildEmbedUrl("vixsrc", 550, "movie")).toBe(
      "https://vixsrc.to/movie/550",
    );
    expect(buildEmbedUrl("moviesapi", 1399, "tv", 2, 3)).toBe(
      "https://moviesapi.to/tv/1399/2/3",
    );
    expect(buildEmbedUrl("autoembed", 1399, "tv", 2, 3)).toBe(
      "https://autoembed.co/tv/tmdb/1399-2-3",
    );
  });
});

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
    expect(ids).not.toContain("autoembed");
    expect(ids).not.toContain("vidlink");
    expect(ids).not.toContain("nontongo");
    expect(ids).not.toContain("superembed");
    expect(ids).not.toContain("kisskh");
  });

  it.each([
    ["movie", "movie"],
    ["series", "tv"],
    ["anime", "tv"],
    ["kdrama", "tv"],
    ["cdrama", "tv"],
  ] as const)("orders verified providers first for %s", (
    contentType,
    mediaType,
  ) => {
    const providers = getProvidersForContentType(contentType, mediaType, {
      tmdb: 550,
      anilist: 1,
      mal: 1,
    });
    const expected = contentType === "anime"
      ? ["megaplay", "cinezo", "vidfast", "2embed"]
      : ["vidfast", "2embed", "2embedskin", "vidsrcpm"];
    expect(providers.slice(0, 4).map((p) => p.id)).toEqual(expected);
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

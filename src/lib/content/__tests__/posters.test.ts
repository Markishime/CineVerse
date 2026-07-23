import { describe, expect, it } from "vitest";
import {
  ensureContentPoster,
  isLikelyBrokenPosterUrl,
  posterFallbackLabel,
  resolveCardImageUrl,
} from "../posters";

describe("isLikelyBrokenPosterUrl", () => {
  it("rejects fabricated seed hashes", () => {
    expect(
      isLikelyBrokenPosterUrl(
        "https://image.tmdb.org/t/p/w500/1V5L9e1k1k1k1k1k1k1k1k1k1k.jpg",
      ),
    ).toBe(true);
    expect(
      isLikelyBrokenPosterUrl(
        "https://image.tmdb.org/t/p/w500/1Q5L1k1k1k1k1k1k1k1k1k1k1k.jpg",
      ),
    ).toBe(true);
  });

  it("accepts real-looking TMDB hashes", () => {
    expect(
      isLikelyBrokenPosterUrl(
        "https://image.tmdb.org/t/p/w500/Ac8ruycRXzgcsndTZFK6ouGA0FA.jpg",
      ),
    ).toBe(false);
  });
});

describe("ensureContentPoster", () => {
  it("replaces fabricated TMDB posters with local SVG", () => {
    const out = ensureContentPoster({
      id: "x",
      title: "Test Drama",
      contentType: "cdrama",
      poster: {
        url: "https://image.tmdb.org/t/p/w500/1Q5L1k1k1k1k1k1k1k1k1k1k1k.jpg",
        source: "tmdb",
      },
    });
    expect(out.poster?.url).toMatch(/^data:image\/svg\+xml/);
  });
});

describe("resolveCardImageUrl", () => {
  it("never returns empty", () => {
    const url = resolveCardImageUrl({
      id: "y",
      title: "Untitled",
      contentType: "movie",
      poster: null,
    });
    expect(url.length).toBeGreaterThan(10);
  });

  it("keeps real Your Name poster", () => {
    const url =
      "https://image.tmdb.org/t/p/w500/q719jXXEzOoYaps6babgKnONONX.jpg";
    expect(isLikelyBrokenPosterUrl(url)).toBe(false);
    const out = ensureContentPoster({
      id: "tmdb_anime_movie_372058",
      title: "Your Name.",
      contentType: "anime",
      poster: { url, source: "tmdb" },
    });
    expect(out.poster?.url).toBe(url);
  });

  it("prefers real poster over synthetic SVG backdrop when wide", () => {
    const poster =
      "https://image.tmdb.org/t/p/w500/q719jXXEzOoYaps6babgKnONONX.jpg";
    const svg = posterFallbackLabel("Your Name.", "anime", "backdrop");
    const url = resolveCardImageUrl(
      {
        id: "x",
        title: "Your Name.",
        contentType: "anime",
        poster: { url: poster },
        backdrop: { url: svg },
      },
      { preferBackdrop: true },
    );
    expect(url).toBe(poster);
  });
});

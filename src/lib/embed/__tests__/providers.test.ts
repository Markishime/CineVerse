import { describe, expect, it } from "vitest";
import {
  EMBED_PROVIDERS,
  getProvidersForContentType,
} from "@/lib/embed/providers";

describe("embed provider order", () => {
  it("does not ship the retired provider", () => {
    expect(EMBED_PROVIDERS.map((provider) => provider.id)).not.toContain(
      `${"video"}${"easy"}`,
    );
  });

  it.each([
    ["movie", "movie"],
    ["series", "tv"],
    ["anime", "tv"],
    ["kdrama", "tv"],
    ["cdrama", "tv"],
  ] as const)("puts VidFast first for %s", (contentType, mediaType) => {
    const providers = getProvidersForContentType(contentType, mediaType, {
      tmdb: 550,
      anilist: 1,
      mal: 1,
    });
    expect(providers[0]?.id).toBe("vidfast");
  });
});

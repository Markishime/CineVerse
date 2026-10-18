import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogService } from "../catalog-service";
import * as providers from "@/lib/providers/live-catalog";
import { ContentSchema } from "@/types/content";
import { getProvidersForContentType } from "@/lib/embed/providers";

afterEach(() => vi.restoreAllMocks());

describe("anime watch provider identity", () => {
  it.each(["TV", "MOVIE"] as const)(
    "resolves TMDB for AniList %s titles and caches it for all movie servers",
    async (animeFormat) => {
      const content = ContentSchema.parse({
        id: "anilist_1",
        slug: "anime-title-1",
        title: "Anime title",
        contentType: "anime",
        animeFormat,
        providerIds: { anilist: 1, mal: 1 },
      });
      vi.spyOn(providers, "fetchAnilistById").mockResolvedValue({
        content,
        cast: [],
        crew: [],
        trailers: [],
      });
      const mediaType = animeFormat === "MOVIE" ? "movie" : "tv";
      const resolve = vi
        .spyOn(providers, "resolveTmdbIdForTitle")
        .mockResolvedValue({ tmdb: 123, tmdbMediaType: mediaType });
      const catalog = new CatalogService();

      const result = await catalog.bySlug("anilist_1");
      expect(resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Anime title",
          requireAnimation: true,
          preferMovie: animeFormat === "MOVIE",
        }),
      );
      expect(result?.providerIds).toEqual({
        anilist: 1,
        mal: 1,
        tmdb: 123,
        tmdbMediaType: mediaType,
      });
      expect(
        getProvidersForContentType("anime", mediaType, {
          ...result?.providerIds,
          animeFormat,
        })
          .slice(0, 4)
          .map((p) => p.id),
      ).toEqual(["vidfast", "2embed", "2embedskin", "vidsrcpm"]);
      await catalog.bySlug("anilist_1");
      expect(resolve).toHaveBeenCalledTimes(1);
    },
  );

  it("preserves native anime playback when no TMDB title matches", async () => {
    const content = ContentSchema.parse({
      id: "anilist_1",
      slug: "anime-title-1",
      title: "Anime title",
      contentType: "anime",
      animeFormat: "TV",
      providerIds: { anilist: 1 },
    });
    vi.spyOn(providers, "fetchAnilistById").mockResolvedValue({
      content,
      cast: [],
      crew: [],
      trailers: [],
    });
    vi.spyOn(providers, "resolveTmdbIdForTitle").mockResolvedValue(null);
    expect(await new CatalogService().bySlug("anilist_1")).toEqual(content);
  });
});

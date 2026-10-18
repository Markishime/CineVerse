import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAnilistAnime, fetchAnilistById } from "../live-catalog";
import { filterPublicCatalog } from "@/lib/content/mature";

afterEach(() => vi.unstubAllGlobals());

describe("AniList detail access", () => {
  it("resolves an adult identity while retaining the public catalog restriction", async () => {
    const fetchMock = vi.fn<
      (input: string, init?: RequestInit) => Promise<Response>
    >(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              Media: {
                id: 123,
                title: { english: "Restricted title" },
                isAdult: true,
                genres: ["Hentai"],
                format: "OVA",
              },
            },
          }),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { content } = await fetchAnilistById(123);
    expect(content?.id).toBe("anilist_123");
    expect(content?.mature).toBe(true);
    expect(filterPublicCatalog([content!])).toEqual([]);
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(body.query).not.toContain("isAdult: false");
  });

  it("keeps default anime browsing restricted to non-adult titles", async () => {
    const fetchMock = vi.fn<
      (input: string, init?: RequestInit) => Promise<Response>
    >(
      async () =>
        new Response(
          JSON.stringify({
            data: { Page: { media: [] } },
          }),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    await fetchAnilistAnime();
    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(body.variables.isAdult).toBe(false);
  });
});

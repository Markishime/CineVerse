import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveAnidbEmbed } from "../anime-resolve";

type Json = Record<string, unknown>;

/** Route the anidb scraper worker's three calls by URL. */
function mockAnidbApi(routes: {
  search?: Json;
  anime?: Json;
  watch?: Json;
}) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes("/api/search")
        ? routes.search
        : url.includes("/api/anime/")
          ? routes.anime
          : url.includes("/api/watch/")
            ? routes.watch
            : undefined;
      if (!body) return new Response("not found", { status: 404 });
      return Response.json(body);
    });
}

afterEach(() => vi.restoreAllMocks());

describe("resolveAnidbEmbed", () => {
  it("resolves the requested absolute episode to its embed URL", async () => {
    const fetchMock = mockAnidbApi({
      search: {
        success: true,
        data: [
          { id: "other-show-1", title: "Other Show" },
          { id: "solo-leveling-4883", title: "Solo Leveling" },
        ],
      },
      anime: {
        success: true,
        data: {
          id: "solo-leveling-4883",
          episodes: [
            { id: 72834, number: 1, title: "Episode 1" },
            { id: 72835, number: 2, title: "Episode 2" },
          ],
        },
      },
      watch: {
        success: true,
        data: {
          embeds: [
            {
              language: "English",
              embedUrl: "https://anidb.app/embed/token-ep2",
            },
          ],
        },
      },
    });

    const resolved = await resolveAnidbEmbed({
      title: "Solo Leveling",
      episode: 2,
    });

    expect(resolved).toEqual({
      provider: "anidb",
      url: "https://anidb.app/embed/token-ep2",
      label: "Episode 2",
    });
    expect(
      fetchMock.mock.calls.map((call) => String(call[0])),
    ).toEqual([
      expect.stringContaining("/api/search?q=Solo%20Leveling"),
      expect.stringContaining("/api/anime/solo-leveling-4883"),
      expect.stringContaining("/api/watch/72835"),
    ]);
  });

  it("prefers a dubbed track when dub audio is requested", async () => {
    mockAnidbApi({
      search: { data: [{ id: "show-1", title: "Show" }] },
      anime: { data: { episodes: [{ id: "ep-1", number: 1 }] } },
      watch: {
        data: {
          embeds: [
            { language: "Japanese", embedUrl: "https://anidb.app/embed/sub" },
            { language: "English", embedUrl: "https://anidb.app/embed/dub" },
          ],
        },
      },
    });

    const resolved = await resolveAnidbEmbed({
      title: "Show",
      episode: 1,
      dub: true,
    });
    expect(resolved?.url).toBe("https://anidb.app/embed/dub");
  });

  it("returns null when the backend carries no embed for the episode", async () => {
    mockAnidbApi({
      search: { data: [{ id: "show-1", title: "Show" }] },
      anime: { data: { episodes: [{ id: "ep-1", number: 1 }] } },
      watch: { success: true, data: { embeds: [], sources: [] } },
    });

    expect(await resolveAnidbEmbed({ title: "Show", episode: 1 })).toBeNull();
  });

  it("returns null when no catalog hit matches the title", async () => {
    mockAnidbApi({
      search: { data: [{ id: "unrelated-9", title: "Completely Different" }] },
    });

    expect(
      await resolveAnidbEmbed({ title: "Solo Leveling", episode: 1 }),
    ).toBeNull();
  });
});

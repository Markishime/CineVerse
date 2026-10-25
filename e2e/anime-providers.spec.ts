import { test, expect } from "@playwright/test";
import { ContentSchema } from "../src/types/content";

for (const animeFormat of ["TV", "MOVIE"] as const) {
  test(`all movie servers are selectable for anime ${animeFormat}`, async ({
    page,
  }) => {
    const content = ContentSchema.parse({
      id: "anilist_1",
      slug: "anime-title-1",
      title: "Anime title",
      contentType: "anime",
      animeFormat,
      providerIds: { tmdb: 123, anilist: 1, mal: 1 },
    });
    const anidbEmbedUrl = "https://anidb.app/embed/token-ep3";
    await page.route("**/api/v1/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      const body = path.endsWith("/slug/anilist_1")
        ? content
        : path.endsWith("/playback/anime-embed")
          ? { ok: true, provider: "anidb", url: anidbEmbedUrl }
          : {
              items: [],
              seasons: [],
              trailers: [],
              providers: [],
              eligible: false,
            };
      await route.fulfill({ json: body });
    });
    // Check our server selection and URL routing without contacting stream hosts.
    await page.route(
      /^https:\/\/(player\.autoembed\.co|vidfast\.vc|www\.2embed\.(online|skin)|vidsrc\.pm|megaplay\.buzz|player\.cinezo\.live|anidb\.app)\//,
      (route) =>
        route.fulfill({
          contentType: "text/html",
          body: "<html><body>Player</body></html>",
        }),
    );
    await page.goto("/watch/anilist_1?season=2&episode=3");
    const player = page.locator("[data-cineverse-player]");
    const iframe = player.locator("iframe");
    const suffix = animeFormat === "MOVIE" ? "movie/123" : "tv/123/2/3";
    const urls = [
      `https://vidfast.vc/${suffix}?autoPlay=true`,
      `https://www.2embed.online/embed/${suffix}`,
      `https://www.2embed.skin/embed/${suffix}`,
      `https://vidsrc.pm/embed/${suffix}`,
      animeFormat === "MOVIE"
        ? "https://player.autoembed.co/embed/movie/123"
        : "https://player.autoembed.co/embed/tv/123/2-3/",
      `https://player.cinezo.live/embed/anime/1/${animeFormat === "MOVIE" ? 1 : 3}?dub=false&autoplay=true&poster=true`,
      anidbEmbedUrl,
    ];
    await expect(iframe).toHaveAttribute("src", urls[0]!);
    for (const i of [1, 2, 3, 4, 5, 6, 0]) {
      await player
        .getByRole("button", { name: "Servers", exact: true })
        .click();
      await expect(
        player.getByRole("button", { name: /^Server \d/ }),
      ).toHaveCount(7);
      await player
        .getByRole("button", { name: new RegExp(`^Server ${i + 1}(?:\\s|$)`) })
        .click();
      await expect(iframe).toHaveAttribute("src", urls[i]!);
    }
  });
}

for (const signal of ["silent", "content not found", "playing"] as const) {
  test(`VidFast ${signal} handles anime fallback correctly`, async ({
    page,
  }) => {
    await page.clock.install();
    await page.route("**/api/v1/**", (route) =>
      route.fulfill({
        json: new URL(route.request().url()).pathname.endsWith(
          "/slug/anilist_1",
        )
          ? ContentSchema.parse({
              id: "anilist_1",
              slug: "anime-title-1",
              title: "Anime title",
              contentType: "anime",
              animeFormat: "TV",
              providerIds: { tmdb: 123, anilist: 1, mal: 1 },
            })
          : {
              items: [],
              seasons: [],
              trailers: [],
              providers: [],
              eligible: false,
            },
      }),
    );
    await page.route(
      /^https:\/\/(vidfast\.vc|www\.2embed\.online)\//,
      (route) =>
        route.fulfill({
          contentType: "text/html",
          body: "<body>Player</body>",
        }),
    );
    await page.goto("/watch/anilist_1?season=2&episode=3");
    const iframe = page.locator("[data-cineverse-player] iframe");
    const defaultUrl = "https://vidfast.vc/tv/123/2/3?autoPlay=true";
    await expect(iframe).toHaveAttribute("src", defaultUrl);
    await expect(
      page.frameLocator("[data-cineverse-player] iframe").locator("body"),
    ).toHaveText("Player");
    if (signal !== "silent") {
      await page
        .frame({ url: defaultUrl })!
        .evaluate(
          (message) => window.parent.postMessage({ type: message }, "*"),
          signal,
        );
    }
    // An explicit error switches immediately. Advancing the clock during the
    // replacement frame's network load would also fire its load timeout.
    if (signal !== "content not found") await page.clock.fastForward(16_000);
    await expect(iframe).toHaveAttribute(
      "src",
      signal === "content not found"
        ? "https://www.2embed.online/embed/tv/123/2/3"
        : defaultUrl,
    );
  });
}

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
    await page.route("**/api/v1/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      const body = path.endsWith("/slug/anilist_1")
        ? content
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
      /^https:\/\/(vidfast\.vc|www\.2embed\.(online|skin)|vidsrc\.pm)\//,
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
    ];
    await expect(iframe).toHaveAttribute("src", urls[0]!);
    for (const i of [1, 2, 3, 0]) {
      await player
        .getByRole("button", { name: "Servers", exact: true })
        .click();
      await expect(
        player.getByRole("button", { name: /^Server \d/ }),
      ).toHaveCount(6);
      await player
        .getByRole("button", { name: new RegExp(`^Server ${i + 1}(?:\\s|$)`) })
        .click();
      await expect(iframe).toHaveAttribute("src", urls[i]!);
    }
  });
}

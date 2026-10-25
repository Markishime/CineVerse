import { test, expect } from "@playwright/test";
import { ContentSchema } from "../src/types/content";

for (const contentType of [
  "movie",
  "series",
  "kdrama",
  "cdrama",
  "jdrama",
  "thaidrama",
] as const) {
  test(`additional servers are selectable for ${contentType}`, async ({
    page,
  }) => {
    const movie = contentType === "movie";
    const content = ContentSchema.parse({
      id: "tmdb_123",
      slug: "test-title",
      title: "Test title",
      contentType,
      countries: ["PH"],
      language: "tl",
      providerIds: { tmdb: 123 },
    });
    await page.route("**/api/v1/**", (route) =>
      route.fulfill({
        json: new URL(route.request().url()).pathname.endsWith("/slug/tmdb_123")
          ? content
          : {
              items: [],
              seasons: [],
              trailers: [],
              providers: [],
              eligible: false,
            },
      }),
    );
    // Exercise routing and fallback without depending on external media hosts.
    await page.route(
      /^https:\/\/(vidfast\.vc|vidrock\.net|vidsrc\.sh|multiembed\.mov|www\.2embed\.cc|vidlink\.pro|vidsrc\.to|www\.2embed\.online|www\.2embed\.skin|vidsrc\.pm|player\.autoembed\.co)\//,
      (route) =>
        route.fulfill({
          contentType: "text/html",
          body: "<body>Player</body>",
        }),
    );
    // Stay on the mocked content route. Normal playback redirects to a server-
    // rendered TMDB page, whose metadata request bypasses browser API mocks.
    await page.goto("/watch/tmdb_123?play=trailer&season=2&episode=3");
    const player = page.locator("[data-cineverse-player]");
    const iframe = player.locator("iframe");
    const suffix = movie ? "movie/123" : "tv/123/2/3";
    const urls = [
      `https://vidrock.net/${suffix}`,
      movie
        ? "https://www.2embed.cc/embed/123"
        : "https://www.2embed.cc/embedtv/123&s=2&e=3",
      `https://vidsrc.sh/embed/${suffix}`,
      `https://multiembed.mov/?video_id=123&tmdb=1${movie ? "" : "&s=2&e=3"}`,
      `https://vidlink.pro/${suffix}`,
      `https://vidsrc.to/embed/${suffix}`,
      `https://vidfast.vc/${suffix}?autoPlay=true`,
      `https://www.2embed.online/embed/${suffix}`,
      `https://www.2embed.skin/embed/${suffix}`,
      `https://vidsrc.pm/embed/${suffix}`,
      movie
        ? "https://player.autoembed.co/embed/movie/123"
        : "https://player.autoembed.co/embed/tv/123/2-3/",
    ];
    await expect(iframe).toHaveAttribute("src", urls[0]!);
    await expect(
      page.frameLocator("[data-cineverse-player] iframe").locator("body"),
    ).toHaveText("Player");
    // A real provider error advances from the default to the first new fallback.
    await page
      .frame({ url: urls[0]! })!
      .evaluate(() =>
        window.parent.postMessage({ type: "content not found" }, "*"),
      );
    await expect(iframe).toHaveAttribute("src", urls[1]!);
    for (const i of [2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 0]) {
      await player
        .getByRole("button", { name: "Servers", exact: true })
        .click();
      await expect(
        player.getByRole("button", { name: /^Server \d/ }),
      ).toHaveCount(11);
      await player
        .getByRole("button", { name: new RegExp(`^Server ${i + 1}(?:\\s|$)`) })
        .click();
      await expect(iframe).toHaveAttribute("src", urls[i]!);
    }
  });
}

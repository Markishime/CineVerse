import { test, expect } from "@playwright/test";

// Explicitly opt in: these checks contact live providers and decode real media.
test.skip(
  !process.env.CHECK_EXTERNAL_PLAYBACK,
  "Set CHECK_EXTERNAL_PLAYBACK=1 to verify external playback",
);

for (const [id, title, provider] of [
  [359105, "Heneral Luna", "vidrock"],
  [593961, "Hello, Love, Goodbye", "vidrock"],
  [205015, "Four Sisters and a Wedding", "vidrock"],
  [593961, "Hello, Love, Goodbye", "2embedcc"],
] as const) {
  test(`${provider} actually plays ${title}`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    page.context().on("page", (popup) => {
      if (popup !== page) void popup.close().catch(() => {});
    });
    await page.goto(`/watch/movie/${id}`);
    const iframe = page.locator("[data-cineverse-player] iframe");
    await expect(iframe).toHaveAttribute(
      "src",
      `https://vidrock.net/movie/${id}`,
      { timeout: 25_000 },
    );
    if (provider === "2embedcc") {
      const player = page.locator("[data-cineverse-player]");
      await player
        .getByRole("button", { name: "Servers", exact: true })
        .click();
      await player.getByRole("button", { name: /2Embed CC/ }).click();
    }
    const url =
      provider === "vidrock"
        ? `https://vidrock.net/movie/${id}`
        : `https://www.2embed.cc/embed/${id}`;
    await expect(iframe).toHaveAttribute("src", url, { timeout: 25_000 });
    // Sound autoplay depends on the browser; a viewer can start with a click.
    if (provider === "2embedcc") {
      // This host loads its nested video only after its visible poster Play.
      await page
        .frameLocator("[data-cineverse-player] iframe")
        .getByRole("img", { name: "play icon", exact: true })
        .click();
    } else {
      await iframe.click();
    }
    let playback: {
      time: number;
      duration: number;
      readyState: number;
      error: string | null;
    } | null = null;
    let posterAttempts = 1;
    await expect
      .poll(
        async () => {
          if (provider === "2embedcc" && posterAttempts < 3) {
            const poster = page
              .frameLocator("[data-cineverse-player] iframe")
              .getByRole("img", { name: "play icon", exact: true });
            if (await poster.isVisible()) {
              posterAttempts += 1;
              await poster.click({ timeout: 1500 }).catch(() => {});
            }
          }
          for (const frame of page.frames().slice(1)) {
            playback = await frame
              .evaluate(() => {
                const video = document.querySelector("video");
                if (!video) return null;
                video.muted = true;
                void video.play().catch(() => {});
                return {
                  time: video.currentTime,
                  duration: video.duration,
                  readyState: video.readyState,
                  error: video.error?.message ?? null,
                };
              })
              .catch(() => null);
            if (
              playback &&
              playback.time > 2 &&
              playback.duration > 600 &&
              playback.readyState >= 2 &&
              !playback.error
            )
              return true;
          }
          return false;
        },
        { timeout: 60_000, intervals: [1000, 2000] },
      )
      .toBe(true);
    await testInfo.attach("decoded-playback", {
      body: JSON.stringify({ id, title, provider, playback }),
      contentType: "application/json",
    });
  });
}

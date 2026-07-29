import { test, expect } from "@playwright/test";

/**
 * Regression for the "Korean movie shows a black, stuck player" bug.
 *
 * Root cause was that the iframe `onLoad` (HTML shell loaded) was treated as
 * playback success, so a provider that loads a shell but has no stream for the
 * title left the player on a permanent blank "loaded" state. The fix adds a
 * post-load verification window that auto-advances providers and ends on a
 * clear "No playable source found" panel when nothing confirms a stream.
 *
 * Contract asserted here (kept lightweight so it is reliable in CI):
 *  - the player mounts and shows a provider,
 *  - it does NOT remain stuck on the transient "· verifying" badge — within the
 *    verification budget it either confirms a provider or reaches the no-source
 *    terminal panel.
 */

test("player never hangs on an unverified provider (KR movie)", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto(`/watch/movie/496243`, { waitUntil: "domcontentloaded" });
  const player = page.locator("[data-cineverse-player]");
  await expect(player).toBeVisible({ timeout: 30_000 });

  // A provider iframe must appear (the chain produced a playable URL).
  await expect(player.locator("iframe")).toHaveCount(1, { timeout: 20_000 });

  // Within the verification budget the player must settle: either the no-source
  // panel appears, OR the transient "verifying" badge is gone (a provider
  // confirmed / the chain moved on). It must not sit on "verifying" forever.
  await expect(async () => {
    const noSource = await page
      .getByText(/no playable source/i)
      .isVisible()
      .catch(() => false);
    const verifying = await player
      .getByText(/verifying/i)
      .isVisible()
      .catch(() => false);
    expect(noSource || !verifying).toBe(true);
  }).toPass({ timeout: 60_000, intervals: [3_000] });
});

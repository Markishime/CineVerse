import { test, expect } from "@playwright/test";

test.describe("CineVerse smoke", () => {
  test("homepage loads catalog sections", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("CineVerse", { exact: false }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Trending today/i })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("movies catalog theme page", async ({ page }) => {
    await page.goto("/movies");
    await expect(page.getByRole("heading", { name: "Movies" })).toBeVisible();
  });

  test("search page accepts query", async ({ page }) => {
    await page.goto("/search?q=Inception");
    await expect(page.getByRole("heading", { name: "Search" })).toBeVisible();
  });

  test("content detail works without WebGL", async ({ page }) => {
    await page.goto("/content/inception-2010");
    await expect(page.getByRole("heading", { name: "Inception" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Where to watch")).toBeVisible();
  });

  test("legal playback gate message present", async ({ page }) => {
    await page.goto("/content/inception-2010");
    await expect(
      page.getByText(/Full playback requires verified|Verified rights allow/i),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("offline page exists", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: /offline/i })).toBeVisible();
  });
});

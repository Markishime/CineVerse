import { test, expect } from "@playwright/test";

test.describe("CineVerse smoke", () => {
  test("homepage loads catalog sections", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByText("CineVerse", { exact: false }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Top 10 today" }),
    ).toBeVisible({
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
    await expect(
      page.getByRole("heading", { name: "Other legal providers" }),
    ).toBeVisible();
  });

  test("content is free with no sign-in wall", async ({ page }) => {
    await page.goto("/content/inception-2010");
    await expect(page.getByRole("link", { name: /Watch Now/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/sign in/i)).toHaveCount(0);
  });

  test("movie navigation survives refresh and browser back", async ({ page }) => {
    await page.goto("/movies");
    await expect(page.getByRole("heading", { name: "Movies" })).toBeVisible();

    const detailsLink = page.locator('article a[href^="/content/"]').last().first();
    await expect(detailsLink).toBeVisible({ timeout: 20_000 });
    await detailsLink.click();
    await expect(page).toHaveURL(/\/content\//);
    await expect(page.locator("h1")).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.locator("h1")).toBeVisible({ timeout: 20_000 });

    await page.goBack();
    await expect(page).toHaveURL(/\/movies$/);
    await expect(page.getByRole("heading", { name: "Movies" })).toBeVisible({
      timeout: 20_000,
    });
  });

  test("offline page exists", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: /offline/i })).toBeVisible();
  });
});

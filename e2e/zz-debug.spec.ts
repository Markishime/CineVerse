import { test, expect } from "@playwright/test";
import { seedHomePayload } from "../src/lib/api/home-fallback";

test("homepage has no uncaught runtime errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/v1/home**", (route) =>
    route.fulfill({ json: seedHomePayload() }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Top 10 today" }),
  ).toBeVisible();
  await page
    .getByRole("region", { name: "Featured titles" })
    .getByRole("button", { name: "Next featured title" })
    .click();
  await expect(
    page.getByRole("region", { name: "Featured titles" }).getByRole("heading"),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

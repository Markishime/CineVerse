import { test, expect, type Page } from "@playwright/test";
import { ContentSchema } from "../src/types/content";
import { seedHomePayload } from "../src/lib/api/home-fallback";

declare global {
  interface Window {
    __heroPlayers: Array<{
      frame: HTMLIFrameElement;
      muted: boolean;
      fail: () => void;
    }>;
  }
}

const keys = ["abcdefghijk", "lmnopqrstuv", "wxyzABCDEF0"];
const titles = ["Featured film", "Featured series", "Featured anime"];
const trailer = (key: string) => ({
  id: key,
  key,
  site: "youtube" as const,
  name: "Official Trailer",
  official: true,
  type: "Trailer",
});

async function prepareHero(page: Page) {
  const items = titles.map((title, i) =>
    ContentSchema.parse({
      id: `hero_${i}`,
      slug: `hero-${i}`,
      title,
      contentType: i === 0 ? "movie" : i === 1 ? "series" : "anime",
      overview:
        "Find your next watch, with a trailer for every featured title.",
      backdrop: { url: "https://image.tmdb.org/t/p/w1280/test.jpg" },
      trailer: i === 0 ? trailer(keys[i]!) : null,
    }),
  );
  await page.route("**/api/v1/home**", (route) =>
    route.fulfill({
      json: {
        ...seedHomePayload(),
        featured: items[0],
        featuredCarousel: items,
        catalogStatus: "live",
      },
    }),
  );
  await page.route("**/api/v1/content/hero_*/trailers", (route) => {
    const i = Number(
      new URL(route.request().url()).pathname.match(/hero_(\d)/)?.[1],
    );
    return route.fulfill({
      json: {
        trailers: [
          trailer(keys[i]!),
          ...(i === 0 ? [trailer("ABCDEFGHIJK")] : []),
        ],
      },
    });
  });
  await page.route("https://www.youtube-nocookie.com/embed/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html><body>Official trailer</body></html>",
    }),
  );
  await page.addInitScript(() => {
    // Force the lightweight graphics mode. Trailers must still work without WebGL.
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value: () => null,
    });
    window.__heroPlayers = [];
    class Player {
      frame: HTMLIFrameElement;
      target: HTMLElement;
      muted = true;
      events: Record<
        string,
        (event: { target: Player; data?: number }) => void
      >;
      constructor(
        target: HTMLElement,
        opts: {
          videoId: string;
          events: Player["events"];
        },
      ) {
        this.events = opts.events;
        this.target = target;
        this.frame = document.createElement("iframe");
        this.frame.src = `https://www.youtube-nocookie.com/embed/${opts.videoId}`;
        target.replaceWith(this.frame);
        window.__heroPlayers.push(this);
        setTimeout(() => this.events.onReady?.({ target: this }), 50);
      }
      getIframe() {
        return this.frame;
      }
      playVideo() {
        this.events.onStateChange?.({ target: this, data: 1 });
      }
      pauseVideo() {}
      stopVideo() {}
      mute() {
        this.muted = true;
      }
      unMute() {
        this.muted = false;
      }
      setVolume() {}
      destroy() {
        this.frame.replaceWith(this.target);
      }
      fail() {
        this.events.onError?.({ target: this, data: 150 });
      }
    }
    Object.assign(window, { YT: { Player } });
  });
}

test("each featured title plays its trailer without WebGL and releases inactive players", async ({
  page,
}) => {
  await prepareHero(page);
  await page.goto("/");
  const hero = page.getByRole("region", { name: "Featured titles" });
  const iframe = hero.locator("iframe");
  await expect(iframe).toHaveCount(1);
  await expect(iframe).toHaveAttribute("src", new RegExp(keys[0]!));
  await expect(hero.locator('[data-trailer-state="playing"]')).toHaveCount(1);
  expect(
    await page.evaluate(
      () => window.__heroPlayers.find((p) => p.frame.isConnected)?.muted,
    ),
  ).toBe(true);

  await hero
    .getByRole("button", { name: "Show Featured series", exact: true })
    .click();
  await expect(iframe).toHaveCount(1);
  await expect(iframe).toHaveAttribute("src", new RegExp(keys[1]!));
  await hero
    .getByRole("button", { name: "Unmute trailer", exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__heroPlayers.find((p) => p.frame.isConnected)?.muted,
      ),
    )
    .toBe(false);
  await hero
    .getByRole("button", { name: "Show Featured anime", exact: true })
    .click();
  await expect(iframe).toHaveAttribute("src", new RegExp(keys[2]!));
  await expect(iframe).toHaveCount(1);
  await hero
    .getByRole("button", { name: "Pause preview", exact: true })
    .click();
  await expect(iframe).toHaveCount(0);
  await hero.getByRole("button", { name: "Play preview", exact: true }).click();
  await expect(iframe).toHaveCount(1);
  await hero
    .getByRole("button", { name: "Scroll to catalog", exact: true })
    .click();
  await expect(iframe).toHaveCount(0);
});

test("reduced motion keeps previews still until Watch trailer is selected", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepareHero(page);
  await page.goto("/");
  const hero = page.getByRole("region", { name: "Featured titles" });
  await expect(
    hero.getByRole("button", { name: "Show Featured film", exact: true }),
  ).toBeVisible();
  await expect(hero.locator("iframe")).toHaveCount(0);
  await hero
    .getByRole("button", { name: "Watch trailer", exact: true })
    .click();
  await expect(hero.locator("iframe")).toHaveCount(1);
  await expect(hero.locator('[data-trailer-state="playing"]')).toHaveCount(1);
  await hero
    .getByRole("button", { name: "Pause preview", exact: true })
    .click();
  await expect(hero.locator("iframe")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("blocked trailers try an alternative and fall back to artwork", async ({
  page,
}) => {
  await prepareHero(page);
  await page.goto("/");
  const hero = page.getByRole("region", { name: "Featured titles" });
  await expect(hero.locator('[data-trailer-state="playing"]')).toHaveCount(1);
  await page.evaluate(() =>
    window.__heroPlayers.find((p) => p.frame.isConnected)?.fail(),
  );
  await expect(hero.locator("iframe")).toHaveAttribute("src", /ABCDEFGHIJK/);
  await expect(hero.locator('[data-trailer-state="playing"]')).toHaveCount(1);
  await page.evaluate(() =>
    window.__heroPlayers.find((p) => p.frame.isConnected)?.fail(),
  );
  await expect(hero.locator("iframe")).toHaveCount(0);
  await expect(
    hero.getByRole("heading", { name: "Featured film", exact: true }),
  ).toBeVisible();
  await expect(
    hero
      .locator('[aria-roledescription="slide"]:not([aria-hidden="true"]) img')
      .first(),
  ).toBeVisible();
});

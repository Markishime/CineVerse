import { test, expect, type Page } from "@playwright/test";
import { ContentSchema } from "../src/types/content";
import { seedHomePayload } from "../src/lib/api/home-fallback";

declare global {
  interface Window {
    __heroPlayers: Array<{
      frame: HTMLIFrameElement;
      muted: boolean;
      requestedMute: number;
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

async function prepareHero(page: Page, blockAutoplay = false) {
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
  await page.addInitScript((blockAutoplay) => {
    let interacted = false;
    window.addEventListener(
      "click",
      () => {
        interacted = true;
      },
      true,
    );
    window.addEventListener(
      "keydown",
      () => {
        interacted = true;
      },
      true,
    );
    // Force the lightweight graphics mode. Trailers must still work without WebGL.
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value: () => null,
    });
    window.__heroPlayers = [];
    class Player {
      frame: HTMLIFrameElement;
      target: HTMLElement;
      muted = true;
      requestedMute: number;
      events: Record<
        string,
        (event: { target: Player; data?: number }) => void
      >;
      constructor(
        target: HTMLElement,
        opts: {
          videoId: string;
          events: Player["events"];
          playerVars: { mute: number };
        },
      ) {
        this.events = opts.events;
        this.requestedMute = opts.playerVars.mute;
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
        if (blockAutoplay && !interacted) return;
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
  }, blockAutoplay);
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
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__heroPlayers.find((p) => p.frame.isConnected)?.muted,
      ),
    )
    .toBe(false);
  await expect(
    hero.getByRole("button", { name: /mute trailer|sound on|sound off/i }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        window.__heroPlayers.find((p) => p.frame.isConnected)?.requestedMute,
    ),
  ).toBe(0);

  await hero
    .getByRole("button", { name: "Show Featured series", exact: true })
    .click();
  await expect(iframe).toHaveCount(1);
  await expect(iframe).toHaveAttribute("src", new RegExp(keys[1]!));
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
  await page.locator("#home-catalog").scrollIntoViewIfNeeded();
  await expect(iframe).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      window.__heroPlayers.every((p) => !p.frame.isConnected || p.muted),
    ),
  ).toBe(true);
});

test("reduced motion keeps previews still until Play preview is selected", async ({
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
  await hero.getByRole("button", { name: "Play preview", exact: true }).click();
  await expect(hero.locator("iframe")).toHaveCount(1);
  await expect(hero.locator('[data-trailer-state="playing"]')).toHaveCount(1);
  await hero
    .getByRole("button", { name: "Pause preview", exact: true })
    .click();
  await expect(hero.locator("iframe")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("blocked unmuted autoplay keeps artwork visible and retries on interaction", async ({
  page,
}) => {
  await prepareHero(page, true);
  await page.goto("/");
  const hero = page.getByRole("region", { name: "Featured titles" });
  await expect(hero.locator("iframe")).toHaveCount(1);
  await expect(hero.locator('[data-trailer-state="playing"]')).toHaveCount(0);
  await expect(
    hero.locator(
      '[aria-roledescription="slide"]:not([aria-hidden="true"]) img',
    ),
  ).toBeVisible();
  await hero.getByText("Featured today", { exact: true }).first().click();
  await expect(hero.locator('[data-trailer-state="playing"]')).toHaveCount(1);
  expect(
    await page.evaluate(
      () => window.__heroPlayers.find((p) => p.frame.isConnected)?.muted,
    ),
  ).toBe(false);
});

test("hero fills the viewport and keeps its main actions above mobile navigation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepareHero(page);
  await page.goto("/");
  const hero = page.getByRole("region", { name: "Featured titles" });
  const viewport = page.viewportSize()!;
  const box = await hero.boundingBox();
  expect(box?.y).toBe(0);
  expect(box?.height).toBeCloseTo(viewport.height, 0);
  expect(box?.width).toBe(viewport.width);
  const active = hero.locator(
    '[aria-roledescription="slide"]:not([aria-hidden="true"])',
  );
  await expect(
    active.getByRole("link", { name: "Play", exact: true }),
  ).toBeVisible();
  await expect(
    active.getByRole("link", { name: "More info about Featured film" }),
  ).toBeVisible();
  const controls = await hero
    .getByRole("button", { name: "Play preview", exact: true })
    .boundingBox();
  const mobileNav = page.getByRole("navigation", {
    name: "Primary",
    exact: true,
  });
  const bottom = (await mobileNav.isVisible())
    ? (await mobileNav.boundingBox())!.y
    : viewport.height;
  expect(controls!.y + controls!.height).toBeLessThanOrEqual(bottom);
  expect(
    (await page.locator("#home-catalog").boundingBox())!.y,
  ).toBeGreaterThanOrEqual(viewport.height);
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

test("short landscape screens keep actions clear of preview controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 667, height: 375 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await prepareHero(page);
  await page.goto("/");
  const hero = page.getByRole("region", { name: "Featured titles" });
  const actions = await hero
    .locator(
      '[aria-roledescription="slide"]:not([aria-hidden="true"]) .hero-feature-actions',
    )
    .boundingBox();
  const controls = await hero.locator(".hero-feature-controls").boundingBox();
  expect(actions!.y + actions!.height).toBeLessThan(controls!.y);
  expect((await hero.boundingBox())!.height).toBe(375);
});

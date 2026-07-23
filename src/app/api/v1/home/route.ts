import { catalog } from "@/lib/content/catalog-service";
import { seedHomePayload } from "@/lib/api/home-fallback";
import type { HomePayload } from "@/lib/api/content";
import { json } from "@/lib/server/http";
import { NextRequest } from "next/server";

/** Live providers may hang on Cloud Functions — never wait longer than this. */
const LIVE_BUDGET_MS = 2_500;

export async function GET(request: NextRequest) {
  const region = "US";
  const includeMature =
    request.nextUrl.searchParams.get("mature") === "1" ||
    request.nextUrl.searchParams.get("mature") === "true";

  // Always have a ready payload so the SPA never spins on a hung provider fan-out.
  const seed = seedHomePayload();

  try {
    const livePromise = catalog
      .home(region, includeMature)
      .then((p) => p as HomePayload)
      .catch((err) => {
        console.warn(
          "[api/v1/home] catalog.home error",
          err instanceof Error ? err.message : err,
        );
        return null;
      });

    const live = await Promise.race([
      livePromise,
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), LIVE_BUDGET_MS),
      ),
    ]);

    // Warm cache in the background if we fell back to seed (best-effort).
    if (!live) {
      void livePromise.then((p) => {
        if (p) {
          /* catalog caches internally on success */
        }
      });
    }

    return json(live ?? seed);
  } catch (err) {
    console.warn(
      "[api/v1/home] unexpected failure; seed fallback",
      err instanceof Error ? err.message : err,
    );
    return json(seed);
  }
}

import { catalog, type CatalogSort } from "@/lib/content/catalog-service";
import { json } from "@/lib/server/http";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const pageSize = Number(request.nextUrl.searchParams.get("pageSize") ?? "60");
  const sort = (request.nextUrl.searchParams.get("sort") ??
    "popularity") as CatalogSort;
  const includeMature =
    request.nextUrl.searchParams.get("mature") === "1" ||
    request.nextUrl.searchParams.get("mature") === "true";
  const playableOnly =
    request.nextUrl.searchParams.get("playable") === "1" ||
    request.nextUrl.searchParams.get("playable") === "true" ||
    request.nextUrl.searchParams.get("watchNow") === "1";
  const regionRaw = request.nextUrl.searchParams.get("region");
  const region =
    !regionRaw || regionRaw === "*" || regionRaw.toUpperCase() === "AUTO"
      ? "*"
      : regionRaw.toUpperCase();
  const formatParam = (
    request.nextUrl.searchParams.get("format") ?? ""
  ).toLowerCase();
  const animeFormat: "movie" | "series" | undefined =
    formatParam === "movie"
      ? "movie"
      : formatParam === "series" || formatParam === "tv"
        ? "series"
        : undefined;
  try {
    const result = await catalog.byType(
      "anime",
      page,
      Math.min(pageSize, 100),
      sort,
      includeMature,
      playableOnly,
      region,
      undefined,
      animeFormat,
    );
    return json(result);
  } catch (err) {
    console.warn(
      "[api/v1/anime] byType failed",
      err instanceof Error ? err.message : err,
    );
    return json({ items: [], page: 1, totalPages: 1, total: 0 });
  }
}

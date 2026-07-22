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
  const region = (
    request.nextUrl.searchParams.get("region") ?? "US"
  ).toUpperCase();
  const country = request.nextUrl.searchParams.get("country") ?? undefined;
  return json(
    await catalog.byType(
      "movie",
      page,
      Math.min(pageSize, 100),
      sort,
      includeMature,
      playableOnly,
      region,
      country,
    ),
  );
}

import { catalog, type CatalogSort } from "@/lib/content/catalog-service";
import { json } from "@/lib/server/http";
import { canIncludeMature } from "@/lib/server/mature-access";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const pageSize = Number(request.nextUrl.searchParams.get("pageSize") ?? "60");
  const sort = (request.nextUrl.searchParams.get("sort") ??
    "popularity") as CatalogSort;
  const includeMature = await canIncludeMature(request);
  const playableOnly =
    request.nextUrl.searchParams.get("playable") === "1" ||
    request.nextUrl.searchParams.get("playable") === "true" ||
    request.nextUrl.searchParams.get("watchNow") === "1";
  const region = (
    request.nextUrl.searchParams.get("region") ?? "US"
  ).toUpperCase();
  const genre = request.nextUrl.searchParams.get("genre") ?? undefined;
  return json(
    await catalog.byType(
      "jdrama",
      page,
      Math.min(pageSize, 100),
      sort,
      includeMature,
      playableOnly,
      region,
      undefined,
      undefined,
      genre,
    ),
  );
}

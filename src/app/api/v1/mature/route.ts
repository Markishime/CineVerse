import { catalog } from "@/lib/content/catalog-service";
import { json } from "@/lib/server/http";
import type { ContentType } from "@/types/content";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const pageSize = Number(request.nextUrl.searchParams.get("pageSize") ?? "60");
  const typeParam = request.nextUrl.searchParams.get("type") ?? "all";
  const type =
    typeParam === "movie" ||
    typeParam === "series" ||
    typeParam === "anime" ||
    typeParam === "kdrama"
      ? (typeParam as ContentType)
      : "all";

  return json(
    await catalog.matureLibrary(page, Math.min(pageSize, 100), type),
  );
}

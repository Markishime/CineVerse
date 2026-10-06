import { NextRequest } from "next/server";
import { fetchSimilarTitles } from "@/lib/embed/similar";
import { errorJson, json } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tmdbId = Number(params.get("tmdbId"));
  const type = params.get("type");
  if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) {
    return errorJson("Invalid tmdbId", 400);
  }
  if (type !== "movie" && type !== "tv") {
    return errorJson("type must be movie or tv", 400);
  }
  return json({ items: await fetchSimilarTitles(tmdbId, type) });
}

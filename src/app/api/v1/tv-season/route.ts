import { NextRequest } from "next/server";
import { fetchSeasonEpisodes } from "@/lib/embed/similar";
import { errorJson, json } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tmdbId = Number(params.get("tmdbId"));
  const season = Number(params.get("season"));
  if (!Number.isSafeInteger(tmdbId) || tmdbId <= 0) {
    return errorJson("Invalid tmdbId", 400);
  }
  if (!Number.isSafeInteger(season) || season < 0) {
    return errorJson("Invalid season", 400);
  }
  return json({ episodes: await fetchSeasonEpisodes(tmdbId, season) });
}

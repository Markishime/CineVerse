import { NextRequest } from "next/server";
import { json, errorJson } from "@/lib/server/http";
import { resolveAnimePaheEmbed } from "@/lib/embed/anime-resolve";

/**
 * Resolve anime streaming embed URLs from AniList/MAL metadata.
 * Providers that need session/scrape IDs (AnimePahe) are resolved server-side.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const provider = (sp.get("provider") ?? "animepahe").toLowerCase();
  const title = sp.get("title")?.trim() ?? "";
  const episode = Number(sp.get("episode") ?? "1") || 1;
  const year = sp.get("year") ? Number(sp.get("year")) : null;
  const anilist = sp.get("anilist") ? Number(sp.get("anilist")) : undefined;

  if (!title && !anilist) {
    return errorJson("title or anilist is required", 400);
  }

  if (provider === "animepahe") {
    const resolved = await resolveAnimePaheEmbed({
      title: title || `anilist-${anilist}`,
      episode,
      year,
      anilist,
    });
    if (!resolved) {
      return errorJson("Could not resolve AnimePahe embed", 404);
    }
    return json({ ok: true, ...resolved });
  }

  return errorJson(`Unsupported anime provider: ${provider}`, 400);
}

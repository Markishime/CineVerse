import { NextRequest } from "next/server";
import { errorJson, json, resolveAuth } from "@/lib/server/auth";
import { resolvePlayback } from "@/lib/playback/resolve-playback";
import { z } from "zod";

/**
 * GET /api/v1/playback/source?titleId=&episodeId=
 *
 * Resolve full-playback mapping from our DB — never TMDB /videos.
 * Returns provider + video ids for Cloudflare Stream / YouTube / Archive / Vimeo.
 */
const QuerySchema = z.object({
  titleId: z.string().min(1),
  episodeId: z.string().optional(),
  seasonNumber: z.coerce.number().int().nonnegative().optional(),
  episodeNumber: z.coerce.number().int().positive().optional(),
  region: z.string().min(2).max(8).default("US"),
});

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const parsed = QuerySchema.safeParse({
    titleId: sp.get("titleId") ?? "",
    episodeId: sp.get("episodeId") ?? undefined,
    seasonNumber: sp.get("seasonNumber") ?? undefined,
    episodeNumber: sp.get("episodeNumber") ?? undefined,
    region: sp.get("region") ?? "US",
  });

  if (!parsed.success) {
    return errorJson("titleId required", 400, parsed.error.flatten());
  }

  const result = resolvePlayback({
    titleId: parsed.data.titleId,
    episodeId: parsed.data.episodeId,
    seasonNumber: parsed.data.seasonNumber,
    episodeNumber: parsed.data.episodeNumber,
    region: parsed.data.region,
    preferFull: true,
  });

  if (!result.playable) {
    return json({
      available: false,
      message:
        result.reason ??
        "The full video is not currently available on CineVerse.",
      watchLabel: result.watchLabel ?? "Not Available on CineVerse",
      tmdbIsMetadataOnly: true,
    });
  }

  // Guests: free public sources only
  const auth = await resolveAuth(request);
  const freeOk =
    result.sourceType === "public_domain" ||
    result.sourceType === "creative_commons" ||
    result.sourceType === "youtube_embed";
  if (!auth.uid && !freeOk) {
    return errorJson("Sign in free to play this licensed title", 401);
  }

  let provider:
    | "cloudflare_stream"
    | "youtube"
    | "vimeo"
    | "archive"
    | "hls"
    | "mp4" = "mp4";

  if (result.mode === "cloudflare_iframe" || result.sourceType === "cloudflare_stream") {
    provider = "cloudflare_stream";
  } else if (result.mode === "youtube_iframe") provider = "youtube";
  else if (result.mode === "vimeo_embed") provider = "vimeo";
  else if (result.signedUrl?.includes("archive.org")) provider = "archive";
  else if (result.mode === "cineverse_hls") provider = "hls";

  return json({
    available: true,
    provider,
    contentKind: result.contentKind,
    videoUid: result.cloudflareVideoUid,
    cloudflareVideoUid: result.cloudflareVideoUid,
    cloudflareCustomerCode: result.cloudflareCustomerCode,
    cloudflareToken: result.cloudflareToken,
    videoId: result.youtubeVideoId,
    youtubeVideoId: result.youtubeVideoId,
    vimeoVideoId: result.vimeoVideoId,
    playbackUrl: result.signedUrl,
    expiresAt: result.expiresAt,
    rightsHolder: result.rightsHolder,
    providerName: result.providerName,
    watchLabel: "Watch Now",
    episodeId: result.episodeId,
    seasonNumber: result.seasonNumber,
    episodeNumber: result.episodeNumber,
    tmdbIsMetadataOnly: true,
  });
}

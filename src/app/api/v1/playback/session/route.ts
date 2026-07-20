import { NextRequest } from "next/server";
import { z } from "zod";
import { errorJson, json, resolveAuth } from "@/lib/server/auth";
import { resolvePlayback } from "@/lib/playback/resolve-playback";
import { PlaybackSessionRequestSchema } from "@/types/playback";

/**
 * POST /api/v1/playback/session
 *
 * Authenticated session for in-app legal playback.
 * - Verifies user
 * - Resolves approved source for title (and episode when series)
 * - Returns short-lived payload for YouTube / Archive / HLS / Vimeo
 * Never returns permanent signed URLs stored in the DB.
 * Never uses TMDB as a stream.
 */
export async function POST(request: NextRequest) {
  const auth = await resolveAuth(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson("Invalid JSON body", 400);
  }

  const parsed = PlaybackSessionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorJson("Invalid playback session request", 400, parsed.error.flatten());
  }

  const {
    titleId,
    episodeId,
    seasonNumber,
    episodeNumber,
    region,
    contentIdAliases,
  } = parsed.data;

  // Episode safety: resolve per-episode only — never a shared generic URL.
  const resolved = resolvePlayback({
    titleId,
    episodeId,
    seasonNumber,
    episodeNumber,
    region: region ?? "US",
    contentIdAliases,
    preferFull: true,
  });

  // Free public-domain / CC / free YouTube embeds: guests may watch without sign-in
  const freeGuestOk =
    resolved.playable &&
    (resolved.sourceType === "public_domain" ||
      resolved.sourceType === "creative_commons" ||
      resolved.sourceType === "youtube_embed");

  if (!auth.uid && !freeGuestOk) {
    return errorJson(
      "Sign in free to start a playback session for this title",
      401,
    );
  }

  if (!resolved.playable) {
    return json(
      {
        allowed: false,
        playable: false,
        provider: null,
        reason: resolved.reason,
        watchLabel: resolved.watchLabel ?? "Not Available on CineVerse",
        tmdbIsMetadataOnly: true,
        region: resolved.region,
      },
      200,
    );
  }

  // Map mode → client player provider
  let provider:
    | "youtube"
    | "archive"
    | "hls"
    | "mp4"
    | "vimeo"
    | "cloudflare_stream" = "mp4";
  if (resolved.mode === "youtube_iframe") provider = "youtube";
  else if (resolved.mode === "vimeo_embed") provider = "vimeo";
  else if (
    resolved.mode === "cloudflare_iframe" ||
    resolved.sourceType === "cloudflare_stream" ||
    Boolean(resolved.cloudflareVideoUid)
  ) {
    provider = "cloudflare_stream";
  } else if (resolved.mode === "cineverse_hls") {
    provider = "hls";
  } else if (resolved.signedUrl?.includes("archive.org")) {
    provider = "archive";
  }

  const expiresAt =
    resolved.expiresAt ??
    new Date(Date.now() + 55 * 60 * 1000).toISOString();

  return json({
    allowed: true,
    playable: true,
    provider,
    mode: resolved.mode,
    sourceType: resolved.sourceType,
    contentKind: resolved.contentKind,
    youtubeVideoId: resolved.youtubeVideoId,
    vimeoVideoId: resolved.vimeoVideoId,
    videoUid: resolved.cloudflareVideoUid,
    cloudflareVideoUid: resolved.cloudflareVideoUid,
    cloudflareCustomerCode: resolved.cloudflareCustomerCode,
    cloudflareToken: resolved.cloudflareToken,
    playbackUrl: resolved.signedUrl,
    expiresAt,
    rightsHolder: resolved.rightsHolder,
    providerName: resolved.providerName,
    attributionText: resolved.attributionText,
    watchLabel: "Watch Now" as const,
    episodeId: resolved.episodeId,
    seasonNumber: resolved.seasonNumber,
    episodeNumber: resolved.episodeNumber,
    region: resolved.region,
    tmdbIsMetadataOnly: true,
    message: "Verified legal source — play inside CineVerse",
  });
}

export async function GET(request: NextRequest) {
  // Convenience GET for simple clients (guest OK for free PD)
  const sp = request.nextUrl.searchParams;
  const titleId = sp.get("titleId") ?? "";
  if (!titleId) return errorJson("titleId required", 400);

  const seasonRaw = sp.get("seasonNumber");
  const episodeRaw = sp.get("episodeNumber");
  const body = {
    titleId,
    episodeId: sp.get("episodeId") ?? undefined,
    seasonNumber: seasonRaw != null ? Number(seasonRaw) : undefined,
    episodeNumber: episodeRaw != null ? Number(episodeRaw) : undefined,
    region: sp.get("region") ?? "US",
  };

  const parsed = PlaybackSessionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorJson("Invalid query", 400, parsed.error.flatten());
  }

  const fakeReq = new NextRequest(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(parsed.data),
  });
  return POST(fakeReq);
}

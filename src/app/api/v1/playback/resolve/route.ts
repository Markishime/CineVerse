import { NextRequest } from "next/server";
import { errorJson, json, resolveAuth } from "@/lib/server/auth";
import { resolvePlayback } from "@/lib/playback/resolve-playback";
import { z } from "zod";

const QuerySchema = z.object({
  titleId: z.string().min(1),
  episodeId: z.string().optional(),
  seasonNumber: z.coerce.number().int().nonnegative().optional(),
  episodeNumber: z.coerce.number().int().positive().optional(),
  region: z.string().min(2).max(8).default("US"),
  preferFull: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
});

const BodySchema = z.object({
  titleId: z.string().min(1),
  episodeId: z.string().optional(),
  seasonNumber: z.number().int().nonnegative().optional(),
  episodeNumber: z.number().int().positive().optional(),
  region: z.string().min(2).max(8).optional(),
  contentIdAliases: z.array(z.string()).optional(),
  preferFull: z.boolean().optional(),
});

/**
 * Resolve in-app legal playback for a title/episode.
 * Requires authentication. Never returns scraped or TMDB stream URLs.
 * Each episode is resolved individually — never a shared generic URL.
 */
function guestAllowed(result: {
  playable: boolean;
  sourceType?: string;
}): boolean {
  if (!result.playable) return true; // allow reading "not playable" without auth
  return (
    result.sourceType === "public_domain" ||
    result.sourceType === "creative_commons" ||
    result.sourceType === "youtube_embed"
  );
}

export async function GET(request: NextRequest) {
  const auth = await resolveAuth(request);

  const sp = request.nextUrl.searchParams;
  const parsed = QuerySchema.safeParse({
    titleId: sp.get("titleId") ?? "",
    episodeId: sp.get("episodeId") ?? undefined,
    seasonNumber: sp.get("seasonNumber") ?? undefined,
    episodeNumber: sp.get("episodeNumber") ?? undefined,
    region: sp.get("region") ?? "US",
    preferFull: sp.get("preferFull") ?? "true",
  });

  if (!parsed.success) {
    return errorJson("Invalid playback request", 400, parsed.error.flatten());
  }

  const result = resolvePlayback({
    titleId: parsed.data.titleId,
    episodeId: parsed.data.episodeId,
    seasonNumber: parsed.data.seasonNumber,
    episodeNumber: parsed.data.episodeNumber,
    region: parsed.data.region,
    preferFull: parsed.data.preferFull,
  });

  if (!auth.uid && result.playable && !guestAllowed(result)) {
    return errorJson("Sign in free to play this title", 401);
  }

  return json({
    ...result,
    tmdbIsMetadataOnly: true,
    message: result.playable
      ? "Verified legal source — play inside CineVerse"
      : result.reason,
  });
}

/** POST variant for episode resolve (preferred for series). */
export async function POST(request: NextRequest) {
  const auth = await resolveAuth(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson("Invalid JSON body", 400);
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return errorJson("Invalid playback request", 400, parsed.error.flatten());
  }

  const result = resolvePlayback({
    titleId: parsed.data.titleId,
    episodeId: parsed.data.episodeId,
    seasonNumber: parsed.data.seasonNumber,
    episodeNumber: parsed.data.episodeNumber,
    region: parsed.data.region ?? "US",
    contentIdAliases: parsed.data.contentIdAliases,
    preferFull: parsed.data.preferFull !== false,
  });

  if (!auth.uid && result.playable && !guestAllowed(result)) {
    return errorJson("Sign in free to play this title", 401);
  }

  return json({
    ...result,
    tmdbIsMetadataOnly: true,
    message: result.playable
      ? "Verified legal source — play inside CineVerse"
      : result.reason,
  });
}

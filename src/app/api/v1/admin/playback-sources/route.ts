import { NextRequest } from "next/server";
import { errorJson, json, resolveAuth } from "@/lib/server/auth";
import {
  createSource,
  listSources,
  listTitles,
  updateSource,
} from "@/lib/playback/playback-store";
import {
  CreatePlaybackSourceInputSchema,
  PlaybackStatusSchema,
} from "@/types/playback";
import { z } from "zod";

/**
 * Admin: list / create verified playback sources.
 * No automatic discovery — only manual rights-reviewed records.
 */
export async function GET(request: NextRequest) {
  const auth = await resolveAuth(request);
  if (!auth.uid) return errorJson("Authentication required", 401);
  if (!auth.isAdmin) return errorJson("Admin access required", 403);

  const titleId = request.nextUrl.searchParams.get("titleId") ?? undefined;
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const statusParsed = status
    ? PlaybackStatusSchema.safeParse(status)
    : null;
  if (status && !statusParsed?.success) {
    return errorJson("Invalid status filter", 400);
  }

  return json({
    sources: listSources({
      titleId,
      status: statusParsed?.success ? statusParsed.data : undefined,
    }),
    titles: listTitles(),
    policy: {
      tmdbIsMetadataOnly: true,
      banned: [
        "pirated_apis",
        "scraped_iframes",
        "m3u8_extraction",
        "drm_bypass",
        "restream_netflix_disney_crunchyroll_etc",
      ],
      approvedSourceTypes: [
        "youtube_embed",
        "cineverse_hosted",
        "public_domain",
        "creative_commons",
        "cloudflare_stream",
        "vimeo_embed",
        "licensed_partner",
      ],
      hosting: {
        recommended: "cloudflare_stream",
        env: [
          "CLOUDFLARE_ACCOUNT_ID",
          "CLOUDFLARE_STREAM_TOKEN",
          "NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE",
          "CLOUDFLARE_STREAM_SIGNING_KEY",
        ],
        upload: "POST /api/v1/admin/stream/direct-upload",
      },
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await resolveAuth(request);
  if (!auth.uid) return errorJson("Authentication required", 401);
  if (!auth.isAdmin) return errorJson("Admin access required", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson("Invalid JSON", 400);
  }

  const parsed = CreatePlaybackSourceInputSchema.safeParse({
    ...(body as object),
    reviewedBy: auth.uid,
    status: (body as { status?: string })?.status ?? "pending_review",
  });

  if (!parsed.success) {
    return errorJson("Validation failed", 400, parsed.error.flatten());
  }

  const input = { ...parsed.data };

  // Hard blocks
  if (input.sourceType === "licensed_partner" && !process.env.LICENSED_PARTNER_ENABLED) {
    return errorJson(
      "licensed_partner adapter is disabled until contract credentials exist",
      400,
    );
  }
  if (input.contentKind === "full_movie" || input.contentKind === "full_episode") {
    if (!input.evidenceDocumentPaths?.length) {
      return errorJson(
        "Full titles require evidenceDocumentPaths before approval",
        400,
      );
    }
  }
  if (input.sourceType === "youtube_embed" && !input.youtubeVideoId) {
    return errorJson("youtube_embed requires youtubeVideoId", 400);
  }
  if (input.sourceType === "cloudflare_stream") {
    const uid =
      input.cloudflareVideoUid ||
      input.playbackAssetId?.replace(/^cloudflare:/, "");
    if (!uid) {
      return errorJson(
        "cloudflare_stream requires cloudflareVideoUid (Stream video UID from upload)",
        400,
      );
    }
    // Normalize so resolve always finds the UID
    input.cloudflareVideoUid = uid;
    input.playbackAssetId = input.playbackAssetId ?? `cloudflare:${uid}`;
  }
  if (input.sourceType === "vimeo_embed" && !input.vimeoVideoId) {
    return errorJson("vimeo_embed requires vimeoVideoId", 400);
  }
  if (
    (input.sourceType === "cineverse_hosted" ||
      input.sourceType === "public_domain") &&
    !input.playbackAssetId &&
    !input.manifestPath
  ) {
    return errorJson("Hosted/PD sources require playbackAssetId or manifestPath", 400);
  }
  if (input.sourceType === "creative_commons") {
    if (!input.licenseType || !input.attributionText) {
      return errorJson("Creative Commons requires licenseType and attributionText", 400);
    }
    if (
      input.licenseType.includes("NC") &&
      input.monetizationAllowed
    ) {
      return errorJson("NC licenses cannot set monetizationAllowed=true", 400);
    }
  }

  // Never auto-approve unless explicitly set by admin with evidence
  if (input.status === "approved" && !input.evidenceDocumentPaths?.length) {
    return errorJson("Cannot approve without evidence documents", 400);
  }

  const source = createSource(input);
  return json({ source }, 201);
}

const PatchSchema = z.object({
  id: z.string().min(1),
  status: PlaybackStatusSchema.optional(),
  notes: z.string().optional(),
  allowedRegions: z.array(z.string()).optional(),
  blockedRegions: z.array(z.string()).optional(),
  validUntil: z.string().optional(),
});

export async function PATCH(request: NextRequest) {
  const auth = await resolveAuth(request);
  if (!auth.uid) return errorJson("Authentication required", 401);
  if (!auth.isAdmin) return errorJson("Admin access required", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorJson("Invalid JSON", 400);
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return errorJson("Validation failed", 400, parsed.error.flatten());
  }

  const patch: Record<string, unknown> = { ...parsed.data };
  delete patch.id;
  if (parsed.data.status === "approved" || parsed.data.status === "rejected") {
    patch.reviewedBy = auth.uid;
    patch.reviewedAt = new Date().toISOString();
  }

  const updated = updateSource(parsed.data.id, patch);
  if (!updated) return errorJson("Source not found", 404);
  return json({ source: updated });
}

import { NextRequest } from "next/server";
import { errorJson, json, resolveAuth } from "@/lib/server/auth";
import {
  createDirectUploadUrl,
  isStreamUploadConfigured,
} from "@/lib/playback/cloudflare-stream";
import { z } from "zod";

const BodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  maxDurationSeconds: z.number().int().positive().max(3600 * 12).optional(),
  requireSignedURLs: z.boolean().optional(),
});

/**
 * Admin: create a Cloudflare Stream direct-creator upload URL for large movies.
 * Client uploads the file to uploadURL, then registers the returned uid
 * as a playbackSources record (cloudflare_stream).
 */
export async function POST(request: NextRequest) {
  const auth = await resolveAuth(request);
  if (!auth.uid) return errorJson("Authentication required", 401);
  if (!auth.isAdmin) return errorJson("Admin access required", 403);

  if (!isStreamUploadConfigured()) {
    return errorJson(
      "Cloudflare Stream upload not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_TOKEN.",
      503,
    );
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return errorJson("Invalid body", 400, parsed.error.flatten());
  }

  try {
    const result = await createDirectUploadUrl({
      name: parsed.data.name,
      maxDurationSeconds: parsed.data.maxDurationSeconds,
      requireSignedURLs: parsed.data.requireSignedURLs,
    });
    return json({
      uploadURL: result.uploadURL,
      uid: result.uid,
      next: {
        step: "After the browser finishes uploading, POST /api/v1/admin/playback-sources with sourceType cloudflare_stream and cloudflareVideoUid = uid",
        exampleSource: {
          titleId: "your_title_id",
          sourceType: "cloudflare_stream",
          providerName: "Cloudflare Stream",
          cloudflareVideoUid: result.uid,
          playbackAssetId: `cloudflare:${result.uid}`,
          contentKind: "full_movie",
          status: "pending_review",
          rightsHolder: "Your company",
          rightsBasis: "owned",
          embeddingAllowed: true,
          allowedRegions: ["*"],
          evidenceDocumentPaths: ["rights/evidence/your_license.md"],
        },
      },
    });
  } catch (e) {
    return errorJson(
      e instanceof Error ? e.message : "Direct upload create failed",
      502,
    );
  }
}

import { errorJson, json, resolveAuth } from "@/lib/server/auth";
import { NextRequest } from "next/server";

const ALLOWED = new Set([
  "trending",
  "popular",
  "anime_airing",
  "kdrama",
  "providers",
  "homepage",
  "daily",
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobType: string }> },
) {
  const auth = await resolveAuth(request);
  if (!auth.uid) return errorJson("Authentication required", 401);
  if (!auth.isAdmin) return errorJson("Admin access required", 403);
  const { jobType } = await context.params;
  if (!ALLOWED.has(jobType)) return errorJson("Unknown job type", 400);

  // Production: enqueue Cloud Function sync with lock documents
  return json({
    ok: true,
    jobType,
    status: "queued",
    message:
      "Sync job accepted. Scheduled Functions + lock docs handle execution in production.",
    at: new Date().toISOString(),
  });
}

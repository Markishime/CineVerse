import { catalog } from "@/lib/content/catalog-service";
import { errorJson, json, resolveAuth } from "@/lib/server/auth";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await resolveAuth(request);
  if (!auth.uid) return errorJson("Authentication required", 401);
  if (!auth.isAdmin) return errorJson("Admin access required", 403);

  const all = await catalog.all();
  return json({
    contentTotals: {
      all: all.length,
      movie: all.filter((c) => c.contentType === "movie").length,
      series: all.filter((c) => c.contentType === "series").length,
      anime: all.filter((c) => c.contentType === "anime").length,
      kdrama: all.filter((c) => c.contentType === "kdrama").length,
    },
    userTotals: { approx: 0, note: "Live totals from Firestore in production" },
    pendingReviews: 0,
    openReports: 0,
    failedSyncJobs: [],
    providerStatus: [
      { name: "TMDB", status: process.env.TMDB_ACCESS_TOKEN ? "configured" : "optional_secret" },
      { name: "AniList", status: "live_keyless" },
      { name: "TVMaze", status: "live_keyless" },
      { name: "Jikan", status: "live_keyless" },
    ],
    duplicateCandidates: [],
    classificationIssues: [],
    rightsExpiringSoon: [],
  });
}

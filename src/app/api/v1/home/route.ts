import { catalog } from "@/lib/content/catalog-service";
import { errorJson, json } from "@/lib/server/http";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  // US-only market for featured + catalog personalization
  const region = "US";
  const includeMature =
    request.nextUrl.searchParams.get("mature") === "1" ||
    request.nextUrl.searchParams.get("mature") === "true";
  try {
    const payload = await catalog.home(region, includeMature);
    return json(payload);
  } catch (err) {
    // Never let a provider outage (TVMaze connect timeout, etc.) 500 the home shell.
    console.warn(
      "[api/v1/home] catalog.home failed",
      err instanceof Error ? err.message : err,
    );
    return errorJson("Home catalog temporarily unavailable", 503, {
      retryable: true,
    });
  }
}

import { catalog } from "@/lib/content/catalog-service";
import { json } from "@/lib/server/http";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  // US-only market for featured + catalog personalization
  const region = "US";
  const includeMature =
    request.nextUrl.searchParams.get("mature") === "1" ||
    request.nextUrl.searchParams.get("mature") === "true";
  const payload = await catalog.home(region, includeMature);
  return json(payload);
}

import { catalog } from "@/lib/content/catalog-service";
import { json } from "@/lib/server/http";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const region = request.nextUrl.searchParams.get("region") ?? "US";
  const episodes = await catalog.episodesWithPlayback(
    decodeURIComponent(id),
    region,
  );
  return json({ episodes });
}

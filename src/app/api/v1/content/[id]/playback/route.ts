import { catalog } from "@/lib/content/catalog-service";
import { canIncludeMature } from "@/lib/server/mature-access";
import { json } from "@/lib/server/http";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const region = request.nextUrl.searchParams.get("region") ?? "US";
  const allowMature = await canIncludeMature(request);
  return json(await catalog.playback(decodeURIComponent(id), region, allowMature));
}

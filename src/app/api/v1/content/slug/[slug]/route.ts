import { catalog } from "@/lib/content/catalog-service";
import { isAdultRestricted } from "@/lib/content/mature";
import { canIncludeMature } from "@/lib/server/mature-access";
import { errorJson, json } from "@/lib/server/http";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const allowMature = await canIncludeMature(request);
  const content = await catalog.bySlug(decodeURIComponent(slug), allowMature);
  if (!content) return errorJson("Content not found", 404);
  if (isAdultRestricted(content) && !allowMature) {
    return errorJson("Content not found", 404);
  }
  return json(content);
}

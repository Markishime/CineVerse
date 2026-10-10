import { catalog } from "@/lib/content/catalog-service";
import { isAdultRestricted } from "@/lib/content/mature";
import { errorJson, json } from "@/lib/server/http";
import { canIncludeMature } from "@/lib/server/mature-access";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const allowMature = await canIncludeMature(request);
  const content = await catalog.byId(decodeURIComponent(id), allowMature);
  if (!content) return errorJson("Content not found", 404);
  if (isAdultRestricted(content) && !allowMature) {
    return errorJson("Content not found", 404);
  }
  return json(content);
}

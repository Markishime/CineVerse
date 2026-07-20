import { catalog } from "@/lib/content/catalog-service";
import { errorJson, json } from "@/lib/server/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const content = await catalog.byId(decodeURIComponent(id));
  if (!content) return errorJson("Content not found", 404);
  return json(content);
}

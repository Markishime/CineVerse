import { catalog } from "@/lib/content/catalog-service";
import { errorJson, json } from "@/lib/server/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const content = await catalog.bySlug(decodeURIComponent(slug));
  if (!content) return errorJson("Content not found", 404);
  return json(content);
}

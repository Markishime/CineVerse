import { catalog } from "@/lib/content/catalog-service";
import { json } from "@/lib/server/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return json({
    items: await catalog.recommendations(decodeURIComponent(id)),
  });
}

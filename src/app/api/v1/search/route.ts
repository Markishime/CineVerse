import { catalog } from "@/lib/content/catalog-service";
import { json } from "@/lib/server/http";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const includeMature =
    sp.get("mature") === "1" || sp.get("mature") === "true";
  return json(
    await catalog.search({
      q: sp.get("q") ?? "",
      type: sp.get("type") ?? undefined,
      page: Number(sp.get("page") ?? "1"),
      genre: sp.get("genre") ?? undefined,
      year: sp.get("year") ? Number(sp.get("year")) : undefined,
      language: sp.get("language") ?? undefined,
      country: sp.get("country") ?? undefined,
      status: sp.get("status") ?? undefined,
      format: sp.get("format") ?? undefined,
      includeMature,
    }),
  );
}

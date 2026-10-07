import { catalog } from "@/lib/content/catalog-service";
import { json } from "@/lib/server/http";
import { canIncludeMature } from "@/lib/server/mature-access";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const includeMature = await canIncludeMature(request);
  return json(await catalog.discover(params, includeMature));
}

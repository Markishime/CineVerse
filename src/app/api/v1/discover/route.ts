import { catalog } from "@/lib/content/catalog-service";
import { json } from "@/lib/server/http";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  return json(await catalog.discover(params));
}

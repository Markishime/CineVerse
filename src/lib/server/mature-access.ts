import type { NextRequest } from "next/server";
import { isRestrictedContentUser } from "@/lib/content/mature";
import { resolveAuth } from "@/lib/server/auth";

/**
 * A query flag is never authorization. Verify the Firebase identity before any
 * catalog path is allowed to request adult metadata.
 */
export async function canIncludeMature(request: NextRequest): Promise<boolean> {
  const value = request.nextUrl.searchParams.get("mature");
  if (value !== "1" && value !== "true") return false;

  const auth = await resolveAuth(request);
  return Boolean(auth.uid && isRestrictedContentUser(auth.email));
}

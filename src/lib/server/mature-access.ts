import type { NextRequest } from "next/server";
import { isRestrictedContentUser } from "@/lib/content/mature";
import { resolveAuth } from "@/lib/server/auth";

/** Only the explicitly allowlisted, authenticated account may include adults-only metadata. */
export async function canIncludeMature(request: NextRequest): Promise<boolean> {
  const auth = await resolveAuth(request);
  return isRestrictedContentUser(auth.email);
}

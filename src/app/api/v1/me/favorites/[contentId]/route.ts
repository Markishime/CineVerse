import { errorJson, json, resolveAuth } from "@/lib/server/auth";
import * as userStore from "@/lib/server/user-store";
import { NextRequest } from "next/server";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ contentId: string }> },
) {
  const auth = await resolveAuth(request);
  if (!auth.uid) return errorJson("Authentication required", 401);
  const { contentId } = await context.params;
  const item = userStore.putFavorite(
    auth.uid,
    decodeURIComponent(contentId),
  );
  return json({ item });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ contentId: string }> },
) {
  const auth = await resolveAuth(request);
  if (!auth.uid) return errorJson("Authentication required", 401);
  const { contentId } = await context.params;
  userStore.deleteFavorite(auth.uid, decodeURIComponent(contentId));
  return new Response(null, { status: 204 });
}

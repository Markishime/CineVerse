import { errorJson, json, resolveAuth } from "@/lib/server/auth";
import * as userStore from "@/lib/server/user-store";
import { NextRequest } from "next/server";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await resolveAuth(request);
  if (!auth.uid) return errorJson("Authentication required", 401);
  const { id } = await context.params;
  const body = await request.json();
  const collection = userStore.updateCollection(
    decodeURIComponent(id),
    auth.uid,
    body,
  );
  if (!collection) return errorJson("Not found", 404);
  return json({ collection });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await resolveAuth(request);
  if (!auth.uid) return errorJson("Authentication required", 401);
  const { id } = await context.params;
  const ok = userStore.deleteCollection(decodeURIComponent(id), auth.uid);
  if (!ok) return errorJson("Not found", 404);
  return new Response(null, { status: 204 });
}

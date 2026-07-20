import { errorJson, json, resolveAuth } from "@/lib/server/auth";
import * as userStore from "@/lib/server/user-store";
import type { LibraryStatus } from "@/types/content";
import { NextRequest } from "next/server";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ contentId: string }> },
) {
  const auth = await resolveAuth(request);
  if (!auth.uid) return errorJson("Authentication required", 401);
  const { contentId } = await context.params;
  const body = await request.json();
  if (!body.status) return errorJson("status is required", 400);
  const item = userStore.putLibrary(auth.uid, decodeURIComponent(contentId), {
    status: body.status as LibraryStatus,
    rating: body.rating,
    progress: body.progress,
    notes: body.notes,
  });
  return json({ item });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ contentId: string }> },
) {
  return PUT(request, context);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ contentId: string }> },
) {
  const auth = await resolveAuth(request);
  if (!auth.uid) return errorJson("Authentication required", 401);
  const { contentId } = await context.params;
  userStore.deleteLibrary(auth.uid, decodeURIComponent(contentId));
  return new Response(null, { status: 204 });
}

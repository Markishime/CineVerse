import { catalog } from "@/lib/content/catalog-service";
import { errorJson, json, resolveAuth } from "@/lib/server/auth";
import * as userStore from "@/lib/server/user-store";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return json({
    reviews: userStore.listReviewsForContent(decodeURIComponent(id)),
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await resolveAuth(request);
  if (!auth.uid) return errorJson("Authentication required", 401);
  const { id } = await context.params;
  const contentId = decodeURIComponent(id);
  if (!(await catalog.byId(contentId))) return errorJson("Content not found", 404);
  const body = await request.json();
  if (!body.body || typeof body.rating !== "number") {
    return errorJson("rating and body are required", 400);
  }
  if (body.rating < 0 || body.rating > 10) {
    return errorJson("rating must be 0-10", 400);
  }
  const profile = userStore.ensureProfile(auth.uid, auth.email);
  const review = userStore.createReview(
    auth.uid,
    contentId,
    profile.username,
    {
      rating: body.rating,
      title: body.title,
      body: body.body,
      hasSpoilers: body.hasSpoilers,
    },
  );
  return json({ review }, 201);
}

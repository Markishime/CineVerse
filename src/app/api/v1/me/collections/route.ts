import { errorJson, json, resolveAuth } from "@/lib/server/auth";
import * as userStore from "@/lib/server/user-store";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await resolveAuth(request);
  if (!auth.uid) return errorJson("Authentication required", 401);
  return json({ items: userStore.listCollections(auth.uid) });
}

export async function POST(request: NextRequest) {
  const auth = await resolveAuth(request);
  if (!auth.uid) return errorJson("Authentication required", 401);
  const body = await request.json();
  if (!body.name?.trim()) return errorJson("name is required", 400);
  const collection = userStore.createCollection(auth.uid, {
    name: body.name.trim(),
    description: body.description,
    isPublic: body.isPublic,
  });
  return json({ collection }, 201);
}

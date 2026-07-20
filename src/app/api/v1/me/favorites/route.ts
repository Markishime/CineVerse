import { errorJson, json, resolveAuth } from "@/lib/server/auth";
import * as userStore from "@/lib/server/user-store";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await resolveAuth(request);
  if (!auth.uid) return errorJson("Authentication required", 401);
  return json({ items: userStore.listFavorites(auth.uid) });
}

import { errorJson, json, resolveAuth } from "@/lib/server/auth";
import * as userStore from "@/lib/server/user-store";
import { NextRequest } from "next/server";

export async function PATCH(request: NextRequest) {
  const auth = await resolveAuth(request);
  if (!auth.uid) return errorJson("Authentication required", 401);
  userStore.ensureProfile(auth.uid, auth.email);
  const body = await request.json();
  const settings = userStore.updateSettings(auth.uid, body);
  return json({ settings });
}

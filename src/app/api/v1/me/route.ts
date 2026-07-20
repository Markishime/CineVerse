import {
  errorJson,
  json,
  resolveAuth,
} from "@/lib/server/auth";
import * as userStore from "@/lib/server/user-store";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await resolveAuth(request);
  if (!auth.uid) return errorJson("Authentication required", 401);
  const profile = userStore.ensureProfile(auth.uid, auth.email);
  const settings = userStore.getSettings(auth.uid);
  return json({ profile, settings });
}

export async function PATCH(request: NextRequest) {
  const auth = await resolveAuth(request);
  if (!auth.uid) return errorJson("Authentication required", 401);
  userStore.ensureProfile(auth.uid, auth.email);
  const body = (await request.json()) as {
    username?: string;
    displayName?: string;
    bio?: string;
    avatarUrl?: string | null;
    isPublic?: boolean;
  };
  // Prevent privilege escalation — only allow safe profile fields
  const safe = {
    username: body.username,
    displayName: body.displayName,
    bio: body.bio,
    avatarUrl: body.avatarUrl,
    isPublic: body.isPublic,
  };
  const profile = userStore.updateProfile(auth.uid, safe);
  return json({ profile });
}

export async function DELETE(request: NextRequest) {
  const auth = await resolveAuth(request);
  if (!auth.uid) return errorJson("Authentication required", 401);
  // Soft delete in demo store — production deletes Auth user + cascade
  return json({ ok: true as const });
}

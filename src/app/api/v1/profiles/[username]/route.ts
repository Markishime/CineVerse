import { errorJson, json } from "@/lib/server/auth";
import * as userStore from "@/lib/server/user-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ username: string }> },
) {
  const { username } = await context.params;
  const profile = userStore.getProfileByUsername(
    decodeURIComponent(username),
  );
  if (!profile || !profile.isPublic) {
    return errorJson("Profile not found", 404);
  }
  const publicLibrary = userStore
    .listLibrary(profile.uid)
    .filter((i) => i.status === "completed" || i.status === "watching");
  const publicCollections = userStore
    .listCollections(profile.uid)
    .filter((c) => c.isPublic);
  return json({ profile, publicLibrary, publicCollections });
}

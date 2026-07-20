import { NextRequest } from "next/server";
export { json, errorJson } from "@/lib/server/http";

export interface AuthContext {
  uid: string | null;
  email: string | null;
  isAdmin: boolean;
  token: string | null;
}

/**
 * Extract bearer token and resolve the signed-in user.
 * Order: Firebase Admin verify → Identity Toolkit API key lookup → demo tokens.
 */
export async function resolveAuth(
  request: NextRequest,
): Promise<AuthContext> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ")
    ? header.slice(7).trim()
    : null;

  if (!token) {
    return { uid: null, email: null, isAdmin: false, token: null };
  }

  // Demo / emulator style tokens
  if (token.startsWith("demo:")) {
    const uid = token.slice(5);
    return {
      uid,
      email: `${uid}@demo.cineverse.app`,
      isAdmin: uid === "admin",
      token,
    };
  }

  // 1) Admin SDK (service account or ADC on Cloud Functions)
  try {
    const { getAdminAuth } = await import("@/lib/server/firebase-admin");
    const authFactory = getAdminAuth();
    if (authFactory) {
      try {
        const auth = authFactory();
        const decoded = await auth.verifyIdToken(token);
        return {
          uid: decoded.uid,
          email: decoded.email ?? null,
          isAdmin: Boolean(decoded.admin),
          token,
        };
      } catch (err) {
        console.warn(
          "[CineVerse] Admin verifyIdToken failed, trying API key fallback",
          err instanceof Error ? err.message : err,
        );
      }
    }
  } catch (err) {
    console.warn(
      "[CineVerse] Admin auth unavailable",
      err instanceof Error ? err.message : err,
    );
  }

  // 2) Identity Toolkit accounts:lookup (works with Web API key, no SA JSON)
  try {
    const { verifyIdTokenViaApiKey } = await import(
      "@/lib/server/firebase-admin"
    );
    const viaKey = await verifyIdTokenViaApiKey(token);
    if (viaKey?.uid) {
      return {
        uid: viaKey.uid,
        email: viaKey.email ?? null,
        isAdmin: Boolean(viaKey.admin),
        token,
      };
    }
  } catch (err) {
    console.warn(
      "[CineVerse] API key token verify failed",
      err instanceof Error ? err.message : err,
    );
  }

  return { uid: null, email: null, isAdmin: false, token };
}

export function requireUser(auth: AuthContext): asserts auth is AuthContext & {
  uid: string;
} {
  if (!auth.uid) {
    throw new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export function requireAdmin(auth: AuthContext): void {
  requireUser(auth);
  if (!auth.isAdmin) {
    throw new Response(JSON.stringify({ error: "Admin access required" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
}

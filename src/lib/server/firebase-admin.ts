/**
 * Firebase Admin — server-only.
 * Never import this module from client components.
 *
 * Init order:
 * 1. Explicit service-account env (FIREBASE_CLIENT_EMAIL + PRIVATE_KEY)
 * 2. Application Default Credentials on Cloud Functions / Cloud Run
 * 3. Project-id-only init (ADC still required for verifyIdToken)
 */

type VerifyResult = {
  uid: string;
  email?: string;
  admin?: boolean;
};

let authInstance: {
  verifyIdToken: (token: string) => Promise<VerifyResult>;
} | null = null;
let initAttempted = false;

function projectId(): string {
  return (
    process.env.CV_ADMIN_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "original-mesh-469112-t3"
  );
}

function hasServiceAccount(): boolean {
  // Avoid FIREBASE_* env names — reserved on Cloud Functions frameworks deploy
  return Boolean(
    process.env.CV_ADMIN_CLIENT_EMAIL && process.env.CV_ADMIN_PRIVATE_KEY,
  );
}

function ensureAuth(): typeof authInstance {
  if (initAttempted) return authInstance;
  initAttempted = true;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getApps, initializeApp, cert, applicationDefault } =
      require("firebase-admin/app") as {
        getApps: () => unknown[];
        initializeApp: (cfg?: unknown) => unknown;
        cert: (s: unknown) => unknown;
        applicationDefault: () => unknown;
      };
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAuth } = require("firebase-admin/auth") as {
      getAuth: () => {
        verifyIdToken: (
          token: string,
          checkRevoked?: boolean,
        ) => Promise<{
          uid: string;
          email?: string;
          admin?: boolean;
        }>;
      };
    };

    if (!getApps().length) {
      const pid = projectId();
      if (hasServiceAccount()) {
        initializeApp({
          credential: cert({
            projectId: pid,
            clientEmail: process.env.CV_ADMIN_CLIENT_EMAIL,
            privateKey: process.env.CV_ADMIN_PRIVATE_KEY!.replace(
              /\\n/g,
              "\n",
            ),
          }),
          projectId: pid,
          storageBucket:
            process.env.CV_ADMIN_STORAGE_BUCKET ||
            process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        });
      } else {
        // Cloud Functions / Cloud Run: use ADC. Locally may still work if gcloud ADC set.
        try {
          initializeApp({
            credential: applicationDefault(),
            projectId: pid,
          });
        } catch {
          initializeApp({ projectId: pid });
        }
      }
    }

    const auth = getAuth();
    authInstance = {
      verifyIdToken: async (token: string) => {
        const decoded = await auth.verifyIdToken(token);
        return {
          uid: decoded.uid,
          email: decoded.email,
          admin: Boolean(
            (decoded as { admin?: boolean }).admin,
          ),
        };
      },
    };
    return authInstance;
  } catch (e) {
    console.warn("[CineVerse] Firebase Admin init failed:", e);
    authInstance = null;
    return null;
  }
}

export function getAdminAuth(): (() => {
  verifyIdToken: (token: string) => Promise<VerifyResult>;
}) | null {
  const auth = ensureAuth();
  if (!auth) return null;
  return () => auth;
}

/**
 * Verify a Firebase ID token via Identity Toolkit (Web API key).
 * Works without service-account JSON — used when Admin ADC is unavailable.
 */
export async function verifyIdTokenViaApiKey(
  idToken: string,
): Promise<VerifyResult | null> {
  const apiKey =
    process.env.CV_WEB_API_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey || !idToken) return null;

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[CineVerse] ID token lookup failed", res.status, text.slice(0, 200));
      return null;
    }
    const data = (await res.json()) as {
      users?: Array<{
        localId?: string;
        email?: string;
        customAttributes?: string;
      }>;
    };
    const user = data.users?.[0];
    if (!user?.localId) return null;
    let admin = false;
    if (user.customAttributes) {
      try {
        const claims = JSON.parse(user.customAttributes) as {
          admin?: boolean;
        };
        admin = Boolean(claims.admin);
      } catch {
        /* ignore */
      }
    }
    return { uid: user.localId, email: user.email, admin };
  } catch (e) {
    console.warn("[CineVerse] verifyIdTokenViaApiKey error", e);
    return null;
  }
}

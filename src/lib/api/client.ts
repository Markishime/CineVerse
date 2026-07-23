import { getClientAuth } from "@/lib/firebase/client";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") || "/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function authHeader(): Promise<Record<string, string>> {
  try {
    const auth = getClientAuth();
    let user = auth.currentUser;

    // authStateReady can hang in Cloud Function environments, blocking every
    // API call and keeping the UI on the loading skeleton forever.  Resolve
    // the race with a short timeout so requests always proceed.
    if (!user && typeof auth.authStateReady === "function") {
      await Promise.race([
        auth.authStateReady(),
        new Promise<void>((r) => setTimeout(r, 3000)),
      ]);
      user = auth.currentUser;
    }

    if (!user) return {};
    const token = await user.getIdToken(/* forceRefresh */ false);
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { auth?: boolean },
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  if (init?.auth !== false) {
    const auth = await authHeader();
    Object.entries(auth).forEach(([k, v]) => headers.set(k, v));
  }

  const url = path.startsWith("http")
    ? path
    : `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...init,
    headers,
  });

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => undefined);
    }
    const message =
      typeof body === "object" &&
      body &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function buildQuery(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    sp.set(k, String(v));
  });
  const q = sp.toString();
  return q ? `?${q}` : "";
}

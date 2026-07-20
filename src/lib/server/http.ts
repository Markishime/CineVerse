/** Lightweight HTTP helpers — no Firebase Admin dependency. */

export function json<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
    },
  });
}

export function errorJson(
  message: string,
  status: number,
  details?: unknown,
): Response {
  return json(
    details !== undefined ? { error: message, details } : { error: message },
    status,
  );
}

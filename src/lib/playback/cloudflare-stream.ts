/**
 * Cloudflare Stream helpers (server-only).
 * Host licensed / owned full movies & episodes — never TMDB streams.
 *
 * Env:
 * - CLOUDFLARE_ACCOUNT_ID
 * - CLOUDFLARE_STREAM_TOKEN          (API token with Stream:Edit)
 * - CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN or NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE
 * - CLOUDFLARE_STREAM_SIGNING_KEY    (optional PEM/JWK for signed playback)
 * - CLOUDFLARE_STREAM_SIGNING_KEY_ID (optional kid for signed tokens)
 * - CLOUDFLARE_STREAM_REQUIRE_SIGNED=1  (force signed URLs when key present)
 */

import { createSign, createPrivateKey, randomUUID } from "node:crypto";

const CF_API = "https://api.cloudflare.com/client/v4";

export function getStreamCustomerCode(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE?.trim() ||
    process.env.CLOUDFLARE_STREAM_CUSTOMER_SUBDOMAIN?.trim() ||
    undefined
  );
}

export function isStreamConfigured(): boolean {
  return Boolean(getStreamCustomerCode());
}

export function isStreamUploadConfigured(): boolean {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() &&
      process.env.CLOUDFLARE_STREAM_TOKEN?.trim(),
  );
}

/** Public iframe player URL (optional signed token query). */
export function streamIframeUrl(
  videoUid: string,
  opts?: { token?: string; autoplay?: boolean },
): string | undefined {
  const customer = getStreamCustomerCode();
  const uid = sanitizeUid(videoUid);
  if (!customer || !uid) return undefined;
  const base = `https://customer-${customer}.cloudflarestream.com/${uid}/iframe`;
  const params = new URLSearchParams();
  if (opts?.token) params.set("token", opts.token);
  if (opts?.autoplay) params.set("autoplay", "true");
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

/** HLS manifest URL for HlsPlayer (optional signed token path). */
export function streamManifestUrl(
  videoUid: string,
  opts?: { token?: string },
): string | undefined {
  const customer = getStreamCustomerCode();
  const uid = sanitizeUid(videoUid);
  if (!customer || !uid) return undefined;
  if (opts?.token) {
    return `https://customer-${customer}.cloudflarestream.com/${uid}/manifest/video.m3u8?token=${encodeURIComponent(opts.token)}`;
  }
  return `https://customer-${customer}.cloudflarestream.com/${uid}/manifest/video.m3u8`;
}

function sanitizeUid(uid: string): string {
  return uid.replace(/[^a-zA-Z0-9_-]/g, "");
}

/**
 * Create a short-lived signed JWT for protected Stream playback.
 * Requires CLOUDFLARE_STREAM_SIGNING_KEY (PEM) + optional KEY_ID.
 * Returns undefined if signing is not configured (use public iframe instead).
 */
export function createStreamSignedToken(
  videoUid: string,
  expiresInSeconds = 3600,
): string | undefined {
  const pem = process.env.CLOUDFLARE_STREAM_SIGNING_KEY?.trim();
  if (!pem) return undefined;
  const uid = sanitizeUid(videoUid);
  if (!uid) return undefined;

  try {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const header: Record<string, string> = { alg: "RS256", typ: "JWT" };
    const kid = process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID?.trim();
    if (kid) header.kid = kid;

    const payload = {
      sub: uid,
      kid: kid || undefined,
      exp,
      accessRules: [{ type: "any", action: "allow" }],
    };

    const enc = (obj: object) =>
      Buffer.from(JSON.stringify(obj)).toString("base64url");
    const data = `${enc(header)}.${enc(payload)}`;
    const key = createPrivateKey(
      pem.includes("BEGIN")
        ? pem
        : `-----BEGIN PRIVATE KEY-----\n${pem}\n-----END PRIVATE KEY-----`,
    );
    const sign = createSign("RSA-SHA256");
    sign.update(data);
    sign.end();
    const sig = sign.sign(key).toString("base64url");
    return `${data}.${sig}`;
  } catch (e) {
    console.error("[CineVerse] Stream signed token failed", e);
    return undefined;
  }
}

export type StreamPlaybackPayload = {
  provider: "cloudflare_stream";
  videoUid: string;
  mode: "cloudflare_iframe" | "cineverse_hls";
  iframeUrl?: string;
  manifestUrl?: string;
  signedToken?: string;
  expiresAt: string;
  customerCode?: string;
};

/** Build client-safe playback payload for an approved Stream UID. */
export function buildStreamPlayback(
  videoUid: string,
  opts?: { preferHls?: boolean; expiresInSeconds?: number },
): StreamPlaybackPayload | null {
  const uid = sanitizeUid(videoUid);
  if (!uid || !isStreamConfigured()) return null;

  const expiresIn = opts?.expiresInSeconds ?? 55 * 60;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const requireSigned =
    process.env.CLOUDFLARE_STREAM_REQUIRE_SIGNED === "1" ||
    process.env.CLOUDFLARE_STREAM_REQUIRE_SIGNED === "true";

  const token = createStreamSignedToken(uid, expiresIn);
  if (requireSigned && !token) {
    console.warn(
      "[CineVerse] Stream requires signed playback but signing key is missing",
    );
    return null;
  }

  const iframeUrl = streamIframeUrl(uid, { token, autoplay: true });
  const manifestUrl = streamManifestUrl(uid, { token });

  if (opts?.preferHls && manifestUrl) {
    return {
      provider: "cloudflare_stream",
      videoUid: uid,
      mode: "cineverse_hls",
      iframeUrl,
      manifestUrl,
      signedToken: token,
      expiresAt,
      customerCode: getStreamCustomerCode(),
    };
  }

  return {
    provider: "cloudflare_stream",
    videoUid: uid,
    mode: "cloudflare_iframe",
    iframeUrl,
    manifestUrl,
    signedToken: token,
    expiresAt,
    customerCode: getStreamCustomerCode(),
  };
}

/**
 * Direct upload of a small/medium file to Cloudflare Stream.
 * For large files use createResumableUpload() instead.
 */
export async function uploadMovieBuffer(
  file: Buffer | Uint8Array | ArrayBuffer,
  opts?: { name?: string; contentType?: string },
): Promise<{ uid: string; preview?: string; status?: string }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_STREAM_TOKEN?.trim();
  if (!accountId || !apiToken) {
    throw new Error(
      "Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_TOKEN to upload",
    );
  }

  // Normalize to a plain ArrayBuffer for Blob (Node Buffer typing differs)
  const ab: ArrayBuffer =
    file instanceof ArrayBuffer
      ? file
      : file.buffer.slice(
          file.byteOffset,
          file.byteOffset + file.byteLength,
        ) as ArrayBuffer;
  const body: BodyInit = new Blob([ab], {
    type: opts?.contentType ?? "video/mp4",
  });

  const response = await fetch(
    `${CF_API}/accounts/${accountId}/stream`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        ...(opts?.name ? { "Upload-Name": opts.name } : {}),
      },
      body,
    },
  );

  if (!response.ok) {
    throw new Error(`Stream upload failed: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    result?: { uid?: string; preview?: string; status?: { state?: string } };
  };
  const uid = data.result?.uid;
  if (!uid) throw new Error("Stream upload returned no uid");
  return {
    uid,
    preview: data.result?.preview,
    status: data.result?.status?.state,
  };
}

/**
 * Create a one-time direct creator upload URL for large files (tus / browser upload).
 * https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/
 */
export async function createDirectUploadUrl(opts?: {
  maxDurationSeconds?: number;
  name?: string;
  requireSignedURLs?: boolean;
}): Promise<{ uploadURL: string; uid: string }> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_STREAM_TOKEN?.trim();
  if (!accountId || !apiToken) {
    throw new Error(
      "Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_TOKEN for direct upload",
    );
  }

  const response = await fetch(
    `${CF_API}/accounts/${accountId}/stream/direct_upload`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        maxDurationSeconds: opts?.maxDurationSeconds ?? 3600 * 4,
        requireSignedURLs: opts?.requireSignedURLs ?? false,
        meta: {
          name: opts?.name ?? `cineverse-${randomUUID()}`,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Direct upload create failed: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    result?: { uploadURL?: string; uid?: string };
  };
  if (!data.result?.uploadURL || !data.result?.uid) {
    throw new Error("Direct upload missing uploadURL/uid");
  }
  return {
    uploadURL: data.result.uploadURL,
    uid: data.result.uid,
  };
}

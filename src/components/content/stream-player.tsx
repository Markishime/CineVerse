"use client";

/**
 * Cloudflare Stream iframe player for licensed / owned full movies & episodes.
 * Never use TMDB video keys here — only Stream UIDs from playbackSources.
 */
export type StreamPlayerProps = {
  videoUid: string;
  title: string;
  /** Customer subdomain code (customer-XXXX). Prefer env public var. */
  customerCode?: string;
  /** Optional short-lived signed token for protected videos */
  token?: string;
  autoplay?: boolean;
  className?: string;
};

export function StreamPlayer({
  videoUid,
  title,
  customerCode,
  token,
  autoplay = true,
  className,
}: StreamPlayerProps) {
  const code =
    customerCode?.trim() ||
    process.env.NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE?.trim();

  if (!code) {
    return (
      <div className="flex h-full items-center justify-center bg-black p-6 text-center text-sm text-[var(--text-secondary)]">
        Cloudflare Stream player is not configured. Set{" "}
        <code className="text-[var(--primary-light)]">
          NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE
        </code>
        .
      </div>
    );
  }

  const uid = videoUid.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!uid) {
    return (
      <div className="flex h-full items-center justify-center bg-black p-6 text-sm text-[var(--danger)]">
        Missing Stream video UID.
      </div>
    );
  }

  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (autoplay) params.set("autoplay", "true");
  const q = params.toString();
  const src = `https://customer-${code}.cloudflarestream.com/${uid}/iframe${q ? `?${q}` : ""}`;

  return (
    <iframe
      src={src}
      title={title}
      className={className ?? "absolute inset-0 h-full w-full border-0"}
      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

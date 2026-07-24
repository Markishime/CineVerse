/**
 * Lightweight player shell helpers.
 *
 * IMPORTANT: Do NOT put `sandbox` on embed iframes. Free hosts (VidLink, VidSrc,
 * AutoEmbed, Cinezo, DramaPlay, …) need full iframe capabilities; sandbox breaks
 * video init, DRM-less players, and postMessage bridges.
 *
 * Ad mitigation that still works without sandbox:
 * - parent `window.open` blocker (useEmbedAdShield)
 * - optional query flags some hosts honor
 * - tap-to-play so accidental mobile taps don’t fire popunders first
 */

/** Permissions string for the iframe allow attribute. */
export const EMBED_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share";

/**
 * Append anti-ad query flags some hosts honor (ignored if unknown).
 */
export function withAdSuppressionParams(url: string): string {
  try {
    const u = new URL(url);
    const flags: Record<string, string> = {
      ads: "0",
      ad: "0",
      noads: "1",
    };
    for (const [k, v] of Object.entries(flags)) {
      if (!u.searchParams.has(k)) u.searchParams.set(k, v);
    }
    return u.toString();
  } catch {
    return url;
  }
}

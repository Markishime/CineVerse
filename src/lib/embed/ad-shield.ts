/**
 * Client-side ad mitigation for third-party embed players.
 *
 * Free embed hosts fund themselves with popups, popunders, and redirects.
 * We cannot strip ads painted *inside* a cross-origin iframe, but we can:
 * - sandbox the iframe so it cannot open new tabs/windows
 * - block window.open from the parent page
 * - block top-level navigation / focus-stealing popunders
 * - require an intentional tap before pointer events hit the player (mobile)
 */

/** Iframe sandbox: scripts + same-origin for the player, no popups or top nav. */
export const EMBED_SANDBOX = [
  "allow-scripts",
  "allow-same-origin",
  "allow-forms",
  "allow-presentation",
  // Fullscreen API used by many players
  "allow-pointer-lock",
  // Explicitly OMIT:
  // allow-popups, allow-popups-to-escape-sandbox,
  // allow-top-navigation, allow-top-navigation-by-user-activation,
  // allow-modals, allow-downloads
].join(" ");

/** Permissions string for the iframe allow attribute (no payment/ad APIs). */
export const EMBED_ALLOW =
  "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen";

/**
 * Append conservative anti-ad query flags some hosts honor.
 * Harmless if ignored; never remove required path segments.
 */
export function withAdSuppressionParams(url: string): string {
  try {
    const u = new URL(url);
    // Common flags used by various free embed hosts (ignored if unknown)
    const flags: Record<string, string> = {
      ads: "0",
      ad: "0",
      noads: "1",
      adblock: "1",
      // Reduce auto-start ad chains that fire before user intent
      mute: "0",
    };
    for (const [k, v] of Object.entries(flags)) {
      if (!u.searchParams.has(k)) u.searchParams.set(k, v);
    }
    return u.toString();
  } catch {
    return url;
  }
}

/** True when the event target is inside an element matching `selector`. */
export function isInside(el: EventTarget | null, selector: string): boolean {
  if (!(el instanceof Element)) return false;
  return Boolean(el.closest(selector));
}

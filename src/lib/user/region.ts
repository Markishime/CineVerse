/**
 * Region helpers for catalog personalization and playback eligibility.
 * No longer forced to US — users worldwide should stream without region blocks.
 */

const REGION_FLAG = "cineverse_region";

/** Prefer device locale; fall back to unrestricted wildcard. */
export function getDeviceRegion(fallback = "*"): string {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(REGION_FLAG);
    if (stored && stored.trim()) return stored.trim().toUpperCase();
  } catch {
    /* ignore */
  }
  try {
    const lang = navigator.language || (navigator as { userLanguage?: string }).userLanguage;
    const parts = (lang ?? "").split(/[-_]/);
    const country = parts[1] || parts[0];
    if (country && /^[a-zA-Z]{2}$/.test(country)) {
      return country.toUpperCase();
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

export function setDeviceRegion(region?: string) {
  if (typeof window === "undefined") return;
  try {
    if (!region || region === "*" || region === "auto") {
      window.localStorage.removeItem(REGION_FLAG);
      return;
    }
    window.localStorage.setItem(REGION_FLAG, region.toUpperCase());
  } catch {
    /* ignore */
  }
}

/**
 * Resolve playback/catalog region.
 * - Explicit settings region wins
 * - Otherwise device locale
 * - Never hard-lock to US
 */
export function resolveRegion(
  settingsRegion?: string | null,
  fallback = "*",
): string {
  if (
    settingsRegion &&
    settingsRegion !== "auto" &&
    settingsRegion !== "*" &&
    settingsRegion.trim()
  ) {
    return settingsRegion.trim().toUpperCase();
  }
  return getDeviceRegion(fallback);
}

/** @deprecated use resolveRegion / getDeviceRegion — kept for call-site compatibility */
export const APP_REGION = "*" as const;

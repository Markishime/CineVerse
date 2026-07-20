/**
 * CineVerse ships as a US-market product for catalog + legal playback.
 * Region is locked to the United States.
 */

export const APP_REGION = "US" as const;

const REGION_FLAG = "cineverse_region";

export function getDeviceRegion(_fallback = "US"): string {
  return APP_REGION;
}

export function setDeviceRegion(_region?: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REGION_FLAG, APP_REGION);
  } catch {
    /* ignore */
  }
}

/** Always US — settings region field is ignored for catalog/playback */
export function resolveRegion(
  _settingsRegion?: string | null,
  _fallback = "US",
): string {
  return APP_REGION;
}

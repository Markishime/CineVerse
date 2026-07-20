"use client";

/**
 * Removed: Legal free AVOD destinations (Tubi, Pluto TV, Amazon Freevee).
 * This component now renders nothing. All streaming is handled by the
 * embedded player on the /watch routes.
 */
export function LegalStreamingLinks() {
  return null;
}

/** Removed: no longer needed. */
export function WatchFreeOnTubiButton() {
  return null;
}

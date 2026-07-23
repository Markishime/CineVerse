/**
 * Reliable poster URLs for every catalog item.
 * Prefer provider art; fall back to deterministic cinematic placeholders.
 */

const TYPE_HUE: Record<string, string> = {
  movie: "1a1430",
  series: "0d1f2d",
  anime: "1f0d24",
  kdrama: "1a1210",
};

export function cinematicPosterUrl(
  id: string,
  title: string,
  contentType?: string,
): string {
  // placehold.co is more reliable than picsum redirects in some regions / CF.
  return posterFallbackLabel(title, contentType ?? "movie");
}

export function cinematicBackdropUrl(id: string, title: string): string {
  const hue = TYPE_HUE["movie"] ?? "111827";
  const t = encodeURIComponent((title || id || "CineVerse").slice(0, 32));
  return `https://placehold.co/1280x720/${hue}/F8FAFF/png?text=${t}&font=montserrat`;
}

/** Text-only gradient poster when remote images fail */
export function posterFallbackLabel(
  title: string,
  contentType = "movie",
): string {
  const hue = TYPE_HUE[contentType] ?? "111827";
  const t = encodeURIComponent(title.slice(0, 28) || "CineVerse");
  return `https://placehold.co/500x750/${hue}/F8FAFF/png?text=${t}&font=montserrat`;
}

/** Normalize relative TMDB paths and reject garbage. */
export function normalizeImageUrl(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const u = url.trim();
  if (!u || u === "null" || u === "undefined") return null;
  // Relative TMDB path → absolute
  if (u.startsWith("/")) {
    return `https://image.tmdb.org/t/p/w500${u}`;
  }
  if (u.startsWith("http://")) {
    return `https://${u.slice("http://".length)}`;
  }
  if (u.startsWith("https://")) return u;
  return null;
}

export function isValidImageUrl(url?: string | null): boolean {
  return Boolean(normalizeImageUrl(url));
}

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
  const seed = encodeURIComponent(id || title.slice(0, 24));
  // Real photo placeholders (stable per seed) — works without API keys
  return `https://picsum.photos/seed/cv-${seed}/500/750`;
}

export function cinematicBackdropUrl(id: string, title: string): string {
  const seed = encodeURIComponent(id || title.slice(0, 24));
  return `https://picsum.photos/seed/cvbg-${seed}/1280/720`;
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

export function isValidImageUrl(url?: string | null): boolean {
  if (!url) return false;
  return (
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.startsWith("/")
  );
}

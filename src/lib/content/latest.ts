import { isDramaType, type Content } from "@/types/content";

/** Unknown dates are not evidence of a new release. Never promote future titles. */
export function latestReleased(items: Content[], now = new Date(), limit = 20): Content[] {
  const today = now.toISOString().slice(0, 10);
  const unreleased = new Set(["upcoming", "planned", "rumored", "in_production", "post_production"]);
  return items.filter((item) => {
    const date = item.releaseDate;
    return !unreleased.has(item.status) && Boolean(
      date && /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      Number.isFinite(Date.parse(date)) && date <= today,
    );
  }).sort((a, b) => b.releaseDate!.localeCompare(a.releaseDate!) || b.popularity - a.popularity)
    .filter((item, index, all) => all.findIndex((other) => other.id === item.id) === index)
    .slice(0, limit);
}

export function latestRows(items: Content[], now = new Date()) {
  return {
    latestMovies: latestReleased(items.filter((c) => c.contentType === "movie"), now),
    latestSeries: latestReleased(items.filter((c) => c.contentType === "series"), now),
    latestAnime: latestReleased(items.filter((c) => c.contentType === "anime"), now),
    latestDramas: latestReleased(items.filter((c) => isDramaType(c.contentType) ||
      (c.contentType === "series" && c.countries.includes("PH"))), now),
  };
}

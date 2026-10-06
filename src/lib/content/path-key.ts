import type { Content } from "@/types/content";

export function contentPathKey(c: Pick<Content, "slug" | "id">): string {
  const raw = c.slug && c.slug !== "title" ? c.slug : c.id;
  return encodeURIComponent(raw || c.id);
}

/**
 * Canonical keys the /content and /watch resolvers can fetch from the provider
 * itself. A display slug only resolves while the search result that produced it
 * is still cached — once that transient expires, `/watch/ben-10-951` 404s into
 * "Title not found" while `/watch/tvmaze_951` keeps working.
 */
export function canonicalPathKey(c: Pick<Content, "slug" | "id">): string {
  if (/^tmdb_[a-z]+_\d+$/.test(c.id)) return encodeURIComponent(c.id);
  if (/^(anilist|tvmaze)_\d+$/.test(c.id)) return encodeURIComponent(c.id);
  return contentPathKey(c);
}

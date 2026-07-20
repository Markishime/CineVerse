/**
 * Helpers for My List / Watchlist across signed-in + guest modes.
 */
import type { Content, LibraryStatus } from "@/types/content";

export type ContentSnapshot = {
  id: string;
  slug: string;
  title: string;
  contentType: Content["contentType"];
  posterUrl?: string | null;
  year?: number | null;
  mature?: boolean;
  playable?: boolean;
};

export function snapshotFromContent(c: Content): ContentSnapshot {
  return {
    id: c.id,
    slug: c.slug || c.id,
    title: c.englishTitle || c.title,
    contentType: c.contentType,
    posterUrl: c.poster?.url ?? null,
    year: c.year ?? null,
    mature: Boolean(c.mature),
    playable: Boolean(c.playable),
  };
}

export function contentFromSnapshot(s: ContentSnapshot): Content {
  return {
    id: s.id,
    slug: s.slug,
    contentType: s.contentType,
    title: s.title,
    alternateTitles: [],
    overview: "",
    status: "released",
    year: s.year ?? undefined,
    countries: [],
    genres: [],
    scores: [],
    popularity: 0,
    trailer: null,
    watchProviders: [],
    providerIds: {},
    studios: [],
    tags: [],
    approved: true,
    mature: Boolean(s.mature),
    playable: s.playable,
    lastSyncedAt: new Date().toISOString(),
    poster: s.posterUrl
      ? { url: s.posterUrl, width: 500, height: 750 }
      : undefined,
  } as Content;
}

export const LIST_TABS: Array<{ id: LibraryStatus | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "plan_to_watch", label: "My List" },
  { id: "watching", label: "Watching" },
  { id: "completed", label: "Completed" },
  { id: "on_hold", label: "On hold" },
  { id: "dropped", label: "Dropped" },
];

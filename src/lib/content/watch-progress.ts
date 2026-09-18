/**
 * Watch progress + Continue Watching.
 *
 * Guests stay device-local. Signed-in accounts use the same local-first cache
 * and mirror it to Firestore so progress follows the account across devices.
 */

import type { Content } from "@/types/content";

const PROGRESS_PREFIX = "cineverse_watch_";
const CONTINUE_KEY = "cineverse_continue_watching";
const CONTINUE_KEY_USER = (uid: string) => `cineverse_continue_watching_${uid}`;
const PROGRESS_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const MAX_CONTINUE = 24;

interface WatchProgress {
  season: number;
  episode: number;
  updatedAt: number;
}

export interface ContinueWatchingItem {
  contentId: string;
  slug: string;
  title: string;
  contentType: Content["contentType"];
  posterUrl?: string | null;
  backdropUrl?: string | null;
  tmdbId?: number | null;
  year?: number | null;
  mature?: boolean;
  /** Resume deep-link */
  href: string;
  season?: number;
  episode?: number;
  /** 0–100 optional progress bar */
  percent?: number;
  updatedAt: number;
}

function continueStorageKey(uid?: string | null): string {
  if (uid) return CONTINUE_KEY_USER(uid);
  return CONTINUE_KEY;
}

/**
 * Save the current watch position for a TV show.
 * Call this when an episode starts playing.
 */
export function saveTvProgress(
  tmdbId: number,
  season: number,
  episode: number,
): void {
  try {
    const key = `${PROGRESS_PREFIX}tv_${tmdbId}`;
    const data: WatchProgress = {
      season,
      episode,
      updatedAt: Date.now(),
    };
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/**
 * Get the last-watched episode for a TV show.
 * Returns null if no progress is saved or if it's expired.
 */
export function getLastWatchedEpisode(
  tmdbId: number,
): { season: number; episode: number } | null {
  try {
    const key = `${PROGRESS_PREFIX}tv_${tmdbId}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const data: WatchProgress = JSON.parse(raw);
    if (Date.now() - data.updatedAt > PROGRESS_EXPIRY_MS) {
      window.localStorage.removeItem(key);
      return null;
    }

    return { season: data.season, episode: data.episode };
  } catch {
    return null;
  }
}

/**
 * Clear watch progress for a TV show (e.g. when completed).
 */
export function clearTvProgress(tmdbId: number): void {
  try {
    window.localStorage.removeItem(`${PROGRESS_PREFIX}tv_${tmdbId}`);
  } catch {
    // ignore
  }
}

/**
 * Build the resume URL for a TV show.
 */
export function getResumeHref(
  tmdbId: number,
  fallbackSeason = 1,
  fallbackEpisode = 1,
): string {
  const last = getLastWatchedEpisode(tmdbId);
  const season = last?.season ?? fallbackSeason;
  const episode = last?.episode ?? fallbackEpisode;
  return `/watch/tv/${tmdbId}/${season}/${episode}`;
}

export function listContinueWatching(
  uid?: string | null,
): ContinueWatchingItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(continueStorageKey(uid));
    if (!raw) return [];
    const items = JSON.parse(raw) as ContinueWatchingItem[];
    const now = Date.now();
    return (Array.isArray(items) ? items : [])
      .filter(
        (i) => i?.contentId && now - (i.updatedAt ?? 0) < PROGRESS_EXPIRY_MS,
      )
      .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
      .slice(0, MAX_CONTINUE);
  } catch {
    return [];
  }
}

function writeContinueList(items: ContinueWatchingItem[], uid?: string | null) {
  try {
    window.localStorage.setItem(
      continueStorageKey(uid),
      JSON.stringify(items.slice(0, MAX_CONTINUE)),
    );
  } catch {
    /* ignore */
  }
}

function notifyContinueWatchingChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("cineverse:continue-watching"));
}

function writeTvProgressFromContinue(item: ContinueWatchingItem): void {
  if (
    !item.tmdbId ||
    item.contentType === "movie" ||
    item.season == null ||
    item.episode == null
  ) {
    return;
  }
  try {
    window.localStorage.setItem(
      `${PROGRESS_PREFIX}tv_${item.tmdbId}`,
      JSON.stringify({
        season: item.season,
        episode: item.episode,
        updatedAt: item.updatedAt,
      } satisfies WatchProgress),
    );
  } catch {
    /* local cache is best-effort */
  }
}

function cleanForFirestore(item: ContinueWatchingItem): ContinueWatchingItem {
  return JSON.parse(JSON.stringify(item)) as ContinueWatchingItem;
}

async function syncContinueItemToAccount(
  item: ContinueWatchingItem,
  uid: string,
): Promise<void> {
  try {
    const [{ doc, setDoc }, { getClientDb }, { COLLECTIONS, libraryDocId }] =
      await Promise.all([
        import("firebase/firestore"),
        import("@/lib/firebase/client"),
        import("@/lib/firebase/collections"),
      ]);
    const clean = cleanForFirestore(item);
    const iso = new Date(clean.updatedAt).toISOString();
    await setDoc(
      doc(
        getClientDb(),
        COLLECTIONS.userLibrary,
        libraryDocId(uid, clean.contentId),
      ),
      {
        id: libraryDocId(uid, clean.contentId),
        uid,
        contentId: clean.contentId,
        status: "watching",
        progress: {
          season: clean.season ?? 0,
          episode: clean.episode ?? 0,
          percent: clean.percent ?? 0,
        },
        continueWatching: clean,
        createdAt: iso,
        updatedAt: iso,
      },
      { merge: true },
    );
  } catch {
    // Firestore offline/network failures never block playback; its SDK and the
    // next local save/subscription will retry the account mirror.
  }
}

async function removeContinueItemFromAccount(
  contentId: string,
  uid: string,
): Promise<void> {
  try {
    const [
      { deleteField, doc, updateDoc },
      { getClientDb },
      { COLLECTIONS, libraryDocId },
    ] = await Promise.all([
      import("firebase/firestore"),
      import("@/lib/firebase/client"),
      import("@/lib/firebase/collections"),
    ]);
    await updateDoc(
      doc(getClientDb(), COLLECTIONS.userLibrary, libraryDocId(uid, contentId)),
      { continueWatching: deleteField() },
    );
  } catch {
    /* local removal still succeeds */
  }
}

function isContinueWatchingItem(value: unknown): value is ContinueWatchingItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ContinueWatchingItem>;
  return Boolean(
    item.contentId &&
    item.title &&
    item.href &&
    typeof item.updatedAt === "number",
  );
}

/**
 * Realtime account subscription used by the home/history rows. Newer local
 * entries are uploaded; newer remote entries hydrate this device immediately.
 */
export async function subscribeAccountContinueWatching(
  uid: string,
  onChange: (items: ContinueWatchingItem[]) => void,
): Promise<() => void> {
  if (typeof window === "undefined" || !uid) return () => {};

  const [
    { collection, onSnapshot, query, where },
    { getClientDb },
    { COLLECTIONS },
  ] = await Promise.all([
    import("firebase/firestore"),
    import("@/lib/firebase/client"),
    import("@/lib/firebase/collections"),
  ]);

  const ref = query(
    collection(getClientDb(), COLLECTIONS.userLibrary),
    where("uid", "==", uid),
  );

  return onSnapshot(
    ref,
    (snapshot) => {
      const now = Date.now();
      const remote = snapshot.docs
        .map((entry) => entry.data().continueWatching as unknown)
        .filter(isContinueWatchingItem)
        .filter((item) => now - item.updatedAt < PROGRESS_EXPIRY_MS);
      const local = listContinueWatching(uid);
      const remoteById = new Map(remote.map((item) => [item.contentId, item]));
      const mergedById = new Map<string, ContinueWatchingItem>();

      for (const item of [...remote, ...local]) {
        const current = mergedById.get(item.contentId);
        if (!current || item.updatedAt > current.updatedAt) {
          mergedById.set(item.contentId, item);
        }
      }

      const merged = Array.from(mergedById.values())
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_CONTINUE);
      writeContinueList(merged, uid);
      for (const item of merged) writeTvProgressFromContinue(item);
      onChange(merged);

      // Upload anything watched offline or before this account was signed in.
      for (const item of local) {
        const accountItem = remoteById.get(item.contentId);
        if (!accountItem || item.updatedAt > accountItem.updatedAt) {
          void syncContinueItemToAccount(item, uid);
        }
      }
    },
    () => onChange(listContinueWatching(uid)),
  );
}

/** Move guest-device history into the signed-in account without losing either list. */
export function migrateGuestContinueWatching(uid: string): void {
  if (!uid || typeof window === "undefined") return;
  const guest = listContinueWatching(null);
  const account = listContinueWatching(uid);
  const byId = new Map<string, ContinueWatchingItem>();
  for (const item of [...account, ...guest]) {
    const current = byId.get(item.contentId);
    if (!current || item.updatedAt > current.updatedAt)
      byId.set(item.contentId, item);
  }
  const merged = Array.from(byId.values())
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_CONTINUE);
  writeContinueList(merged, uid);
  for (const item of merged) void syncContinueItemToAccount(item, uid);
  try {
    window.localStorage.removeItem(CONTINUE_KEY);
  } catch {
    /* ignore */
  }
  notifyContinueWatchingChanged();
}

/**
 * Upsert a title into Continue Watching (moves to front).
 */
export function saveContinueWatching(
  entry: Omit<ContinueWatchingItem, "updatedAt"> & { updatedAt?: number },
  uid?: string | null,
): void {
  if (typeof window === "undefined") return;
  const next: ContinueWatchingItem = {
    ...entry,
    updatedAt: entry.updatedAt ?? Date.now(),
  };
  const prev = listContinueWatching(uid).filter(
    (i) => i.contentId !== next.contentId,
  );
  writeContinueList([next, ...prev], uid);
  writeTvProgressFromContinue(next);
  notifyContinueWatchingChanged();
  if (uid) void syncContinueItemToAccount(next, uid);
}

export function removeContinueWatching(
  contentId: string,
  uid?: string | null,
): void {
  writeContinueList(
    listContinueWatching(uid).filter((i) => i.contentId !== contentId),
    uid,
  );
  notifyContinueWatchingChanged();
  if (uid) void removeContinueItemFromAccount(contentId, uid);
}

/** Build continue entry from catalog Content + optional episode position */
export function continueFromContent(
  content: Pick<
    Content,
    | "id"
    | "slug"
    | "title"
    | "contentType"
    | "poster"
    | "backdrop"
    | "providerIds"
    | "year"
    | "mature"
    | "englishTitle"
  >,
  opts?: {
    season?: number;
    episode?: number;
    percent?: number;
    href?: string;
  },
): Omit<ContinueWatchingItem, "updatedAt"> {
  const tmdbId = content.providerIds?.tmdb;
  let href = opts?.href;
  if (!href) {
    if (content.contentType === "movie" && tmdbId) {
      href = `/watch/movie/${tmdbId}`;
    } else if (tmdbId && content.contentType !== "movie") {
      const s = opts?.season ?? 1;
      const e = opts?.episode ?? 1;
      href = `/watch/tv/${tmdbId}/${s}/${e}`;
    } else {
      const key = encodeURIComponent(content.slug || content.id);
      const params = new URLSearchParams({ play: "full" });
      if (opts?.season != null) params.set("season", String(opts.season));
      if (opts?.episode != null) params.set("episode", String(opts.episode));
      href = `/watch/${key}?${params.toString()}`;
    }
  }

  return {
    contentId: content.id,
    slug: content.slug || content.id,
    title: content.englishTitle || content.title,
    contentType: content.contentType,
    posterUrl: content.poster?.url ?? null,
    backdropUrl: content.backdrop?.url ?? null,
    tmdbId: tmdbId ?? null,
    year: content.year ?? null,
    mature: Boolean(content.mature),
    href,
    season: opts?.season,
    episode: opts?.episode,
    percent: opts?.percent,
  };
}

/** Map continue items into lightweight Content-shaped cards for ContentRow */
export function continueToContentStub(item: ContinueWatchingItem): Content {
  return {
    id: item.contentId,
    slug: item.slug,
    contentType: item.contentType,
    title: item.title,
    alternateTitles: [],
    overview: "",
    status: "released",
    year: item.year ?? undefined,
    language: undefined,
    countries: [],
    genres: [],
    scores: [],
    popularity: item.updatedAt / 1e10,
    trailer: null,
    watchProviders: [],
    providerIds: item.tmdbId
      ? {
          tmdb: item.tmdbId,
          tmdbMediaType: item.contentType === "movie" ? "movie" : "tv",
        }
      : {},
    studios: [],
    tags: ["continue-watching"],
    approved: true,
    mature: Boolean(item.mature),
    playable: true,
    lastSyncedAt: new Date(item.updatedAt).toISOString(),
    poster: item.posterUrl
      ? { url: item.posterUrl, width: 500, height: 750 }
      : undefined,
    backdrop: item.backdropUrl
      ? { url: item.backdropUrl, width: 1280, height: 720 }
      : undefined,
  } as Content;
}

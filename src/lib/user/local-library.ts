/**
 * Local-first My List / library.
 * Server user-store is in-memory per instance — localStorage is the reliable source of truth
 * (same pattern as settings/profile).
 */
import type { LibraryStatus, UserLibraryEntry } from "@/types/content";
import type { ContentSnapshot } from "@/lib/user/my-list";

export type LocalLibraryEntry = {
  contentId: string;
  status: LibraryStatus;
  rating?: number | null;
  notes?: string;
  progress?: {
    season: number;
    episode: number;
    percent: number;
  };
  snapshot?: ContentSnapshot;
  updatedAt: string;
  createdAt: string;
};

const GUEST_KEY = "cineverse_library_guest";
const LEGACY_GUEST_ZUSTAND = "cineverse-guest-library";

export function libraryStorageKey(uid?: string | null): string {
  if (uid) return `cineverse_library_${uid}`;
  return GUEST_KEY;
}

function nowIso() {
  return new Date().toISOString();
}

export function readLocalLibrary(uid?: string | null): LocalLibraryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const key = libraryStorageKey(uid);
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as LocalLibraryEntry[];
      if (Array.isArray(parsed)) return parsed.filter((e) => e?.contentId);
    }

    // Migrate legacy guest zustand persist into local library once
    if (!uid) {
      const legacy = migrateLegacyGuestLibrary();
      if (legacy.length) {
        writeLocalLibrary(null, legacy);
        return legacy;
      }
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function writeLocalLibrary(
  uid: string | null | undefined,
  items: LocalLibraryEntry[],
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      libraryStorageKey(uid),
      JSON.stringify(items),
    );
  } catch {
    /* ignore */
  }
}

export function upsertLocalLibrary(
  uid: string | null | undefined,
  data: {
    contentId: string;
    status: LibraryStatus;
    snapshot?: ContentSnapshot;
    rating?: number | null;
    notes?: string;
    progress?: LocalLibraryEntry["progress"];
  },
): LocalLibraryEntry {
  const items = readLocalLibrary(uid);
  const prev = items.find((i) => i.contentId === data.contentId);
  const next: LocalLibraryEntry = {
    contentId: data.contentId,
    status: data.status,
    rating: data.rating ?? prev?.rating ?? null,
    notes: data.notes ?? prev?.notes,
    progress: data.progress ?? prev?.progress,
    snapshot: data.snapshot ?? prev?.snapshot,
    createdAt: prev?.createdAt ?? nowIso(),
    updatedAt: nowIso(),
  };
  const filtered = items.filter((i) => i.contentId !== data.contentId);
  writeLocalLibrary(uid, [next, ...filtered]);
  return next;
}

export function removeLocalLibrary(
  uid: string | null | undefined,
  contentId: string,
): void {
  writeLocalLibrary(
    uid,
    readLocalLibrary(uid).filter((i) => i.contentId !== contentId),
  );
}

export function getLocalLibraryStatus(
  uid: string | null | undefined,
  contentId: string,
): LibraryStatus | null {
  return (
    readLocalLibrary(uid).find((i) => i.contentId === contentId)?.status ?? null
  );
}

export function isInMyList(
  uid: string | null | undefined,
  contentId: string,
): boolean {
  const status = getLocalLibraryStatus(uid, contentId);
  return status === "plan_to_watch" || status === "watching";
}

export function getLocalSnapshot(
  uid: string | null | undefined,
  contentId: string,
): ContentSnapshot | null {
  return (
    readLocalLibrary(uid).find((i) => i.contentId === contentId)?.snapshot ??
    null
  );
}

/** Merge server items into local without losing local snapshots / newer local updates */
export function mergeServerLibrary(
  uid: string,
  serverItems: UserLibraryEntry[],
): LocalLibraryEntry[] {
  const local = readLocalLibrary(uid);
  const byId = new Map<string, LocalLibraryEntry>();

  for (const l of local) {
    byId.set(l.contentId, l);
  }

  for (const s of serverItems) {
    const existing = byId.get(s.contentId);
    const serverTs = Date.parse(s.updatedAt ?? "") || 0;
    const localTs = Date.parse(existing?.updatedAt ?? "") || 0;
    if (!existing || serverTs > localTs) {
      byId.set(s.contentId, {
        contentId: s.contentId,
        status: s.status,
        rating: s.rating ?? null,
        notes: s.notes,
        progress: s.progress
          ? {
              season: s.progress.season ?? 0,
              episode: s.progress.episode ?? 0,
              percent: s.progress.percent ?? 0,
            }
          : existing?.progress,
        snapshot: existing?.snapshot,
        createdAt: s.createdAt ?? existing?.createdAt ?? nowIso(),
        updatedAt: s.updatedAt ?? existing?.updatedAt ?? nowIso(),
      });
    }
  }

  const merged = Array.from(byId.values()).sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
  writeLocalLibrary(uid, merged);
  return merged;
}

export function localEntriesAsApiItems(
  items: LocalLibraryEntry[],
  uid = "local",
): UserLibraryEntry[] {
  return items.map((e) => ({
    id: `${uid}_${e.contentId}`,
    uid,
    contentId: e.contentId,
    status: e.status,
    rating: e.rating ?? null,
    progress: e.progress,
    notes: e.notes,
    updatedAt: e.updatedAt,
    createdAt: e.createdAt,
  }));
}

function migrateLegacyGuestLibrary(): LocalLibraryEntry[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_GUEST_ZUSTAND);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      state?: {
        library?: Array<{
          contentId: string;
          status: LibraryStatus;
          addedAt?: string;
          snapshot?: ContentSnapshot;
        }>;
      };
    };
    const lib = parsed?.state?.library;
    if (!Array.isArray(lib)) return [];
    return lib
      .filter((i) => i?.contentId)
      .map((i) => ({
        contentId: i.contentId,
        status: i.status ?? "plan_to_watch",
        snapshot: i.snapshot,
        createdAt: i.addedAt ?? nowIso(),
        updatedAt: i.addedAt ?? nowIso(),
      }));
  } catch {
    return [];
  }
}

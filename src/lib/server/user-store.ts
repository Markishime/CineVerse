/**
 * In-memory user data store for local/demo mode.
 * Production Cloud Functions use Firestore with the same shapes.
 */
import {
  favoriteDocId,
  libraryDocId,
} from "@/lib/firebase/collections";
import type {
  Collection,
  Favorite,
  LibraryStatus,
  Review,
  UserLibraryEntry,
  UserProfile,
  UserSettings,
} from "@/types/content";

const profiles = new Map<string, UserProfile>();
const settings = new Map<string, UserSettings>();
const library = new Map<string, UserLibraryEntry>();
const favorites = new Map<string, Favorite>();
const reviews = new Map<string, Review>();
const collections = new Map<string, Collection>();
const collectionItems = new Map<string, string[]>();
const notifications = new Map<
  string,
  Array<{
    id: string;
    title: string;
    body: string;
    read: boolean;
    href?: string;
    createdAt: string;
  }>
>();

function now() {
  return new Date().toISOString();
}

export function ensureProfile(
  uid: string,
  email?: string | null,
): UserProfile {
  const existing = profiles.get(uid);
  if (existing) return existing;
  const username =
    email?.split("@")[0]?.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) ||
    `user_${uid.slice(0, 6)}`;
  const profile: UserProfile = {
    uid,
    username,
    displayName: username,
    bio: "",
    avatarUrl: null,
    isPublic: true,
    stats: {
      watched: 0,
      watching: 0,
      planToWatch: 0,
      favorites: 0,
      reviews: 0,
    },
    createdAt: now(),
    updatedAt: now(),
  };
  profiles.set(uid, profile);
  if (!settings.has(uid)) {
    settings.set(uid, {
      uid,
      region: "US",
      language: "en",
      preferredProviders: [],
      preferredContentTypes: [],
      animeTitlePreference: "english",
      animeAudioLanguage: "ja",
      kdramaAudioLanguage: "ko",
      generalAudioLanguage: "en",
      matureContent: false,
      performanceMode: "cinematic",
      notificationPrefs: {
        airing: true,
        recommendations: true,
        social: true,
        product: false,
      },
      updatedAt: now(),
    });
  }
  return profile;
}

export function getProfile(uid: string): UserProfile | null {
  return profiles.get(uid) ?? null;
}

export function getProfileByUsername(
  username: string,
): UserProfile | null {
  for (const p of profiles.values()) {
    if (p.username.toLowerCase() === username.toLowerCase()) return p;
  }
  return null;
}

export function updateProfile(
  uid: string,
  data: Partial<UserProfile>,
): UserProfile {
  const current = ensureProfile(uid);
  const next = {
    ...current,
    ...data,
    uid,
    updatedAt: now(),
  };
  profiles.set(uid, next);
  return next;
}

export function getSettings(uid: string): UserSettings {
  ensureProfile(uid);
  return settings.get(uid)!;
}

export function updateSettings(
  uid: string,
  data: Partial<UserSettings>,
): UserSettings {
  const current = getSettings(uid);
  const next = { ...current, ...data, uid, updatedAt: now() };
  settings.set(uid, next);
  return next;
}

export function listLibrary(uid: string): UserLibraryEntry[] {
  return Array.from(library.values()).filter((i) => i.uid === uid);
}

export function putLibrary(
  uid: string,
  contentId: string,
  data: {
    status: LibraryStatus;
    rating?: number | null;
    progress?: UserLibraryEntry["progress"];
    notes?: string;
  },
): UserLibraryEntry {
  const id = libraryDocId(uid, contentId);
  const existing = library.get(id);
  const entry: UserLibraryEntry = {
    id,
    uid,
    contentId,
    status: data.status,
    rating: data.rating ?? existing?.rating ?? null,
    progress: data.progress ?? existing?.progress,
    notes: data.notes ?? existing?.notes,
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
  };
  library.set(id, entry);
  recomputeStats(uid);
  return entry;
}

export function deleteLibrary(uid: string, contentId: string): void {
  library.delete(libraryDocId(uid, contentId));
  recomputeStats(uid);
}

export function listFavorites(uid: string): Favorite[] {
  return Array.from(favorites.values()).filter((f) => f.uid === uid);
}

export function putFavorite(uid: string, contentId: string): Favorite {
  const id = favoriteDocId(uid, contentId);
  const fav: Favorite = {
    id,
    uid,
    contentId,
    createdAt: favorites.get(id)?.createdAt ?? now(),
  };
  favorites.set(id, fav);
  recomputeStats(uid);
  return fav;
}

export function deleteFavorite(uid: string, contentId: string): void {
  favorites.delete(favoriteDocId(uid, contentId));
  recomputeStats(uid);
}

export function createReview(
  uid: string,
  contentId: string,
  username: string,
  data: {
    rating: number;
    title?: string;
    body: string;
    hasSpoilers?: boolean;
  },
): Review {
  const id = `rev_${uid}_${contentId}`;
  const review: Review = {
    id,
    contentId,
    uid,
    username,
    rating: data.rating,
    title: data.title,
    body: data.body,
    hasSpoilers: data.hasSpoilers ?? false,
    approved: true,
    upvotes: 0,
    downvotes: 0,
    createdAt: now(),
    updatedAt: now(),
  };
  reviews.set(id, review);
  recomputeStats(uid);
  return review;
}

export function getReview(id: string): Review | null {
  return reviews.get(id) ?? null;
}

export function updateReview(
  id: string,
  uid: string,
  data: Partial<Review>,
): Review | null {
  const r = reviews.get(id);
  if (!r || r.uid !== uid) return null;
  const next = { ...r, ...data, id, uid, updatedAt: now() };
  reviews.set(id, next);
  return next;
}

export function deleteReview(id: string, uid: string): boolean {
  const r = reviews.get(id);
  if (!r || r.uid !== uid) return false;
  reviews.delete(id);
  recomputeStats(uid);
  return true;
}

export function listReviewsForContent(contentId: string): Review[] {
  return Array.from(reviews.values()).filter(
    (r) => r.contentId === contentId && r.approved,
  );
}

export function listCollections(uid: string): Collection[] {
  return Array.from(collections.values()).filter((c) => c.uid === uid);
}

export function createCollection(
  uid: string,
  data: { name: string; description?: string; isPublic?: boolean },
): Collection {
  const id = `col_${uid}_${Date.now()}`;
  const col: Collection = {
    id,
    uid,
    name: data.name,
    description: data.description ?? "",
    coverUrl: null,
    isPublic: data.isPublic ?? true,
    itemCount: 0,
    createdAt: now(),
    updatedAt: now(),
  };
  collections.set(id, col);
  collectionItems.set(id, []);
  return col;
}

export function updateCollection(
  id: string,
  uid: string,
  data: Partial<Collection>,
): Collection | null {
  const c = collections.get(id);
  if (!c || c.uid !== uid) return null;
  const next = { ...c, ...data, id, uid, updatedAt: now() };
  collections.set(id, next);
  return next;
}

export function deleteCollection(id: string, uid: string): boolean {
  const c = collections.get(id);
  if (!c || c.uid !== uid) return false;
  collections.delete(id);
  collectionItems.delete(id);
  return true;
}

export function getCollection(id: string): Collection | null {
  return collections.get(id) ?? null;
}

export function addCollectionItem(
  collectionId: string,
  uid: string,
  contentId: string,
): boolean {
  const c = collections.get(collectionId);
  if (!c || c.uid !== uid) return false;
  const items = collectionItems.get(collectionId) ?? [];
  if (!items.includes(contentId)) {
    items.push(contentId);
    collectionItems.set(collectionId, items);
    collections.set(collectionId, {
      ...c,
      itemCount: items.length,
      updatedAt: now(),
    });
  }
  return true;
}

export function removeCollectionItem(
  collectionId: string,
  uid: string,
  contentId: string,
): boolean {
  const c = collections.get(collectionId);
  if (!c || c.uid !== uid) return false;
  const items = (collectionItems.get(collectionId) ?? []).filter(
    (id) => id !== contentId,
  );
  collectionItems.set(collectionId, items);
  collections.set(collectionId, {
    ...c,
    itemCount: items.length,
    updatedAt: now(),
  });
  return true;
}

export function listNotifications(uid: string) {
  return notifications.get(uid) ?? [];
}

export function markNotificationRead(uid: string, id: string): void {
  const items = notifications.get(uid) ?? [];
  notifications.set(
    uid,
    items.map((n) => (n.id === id ? { ...n, read: true } : n)),
  );
}

function recomputeStats(uid: string): void {
  const p = profiles.get(uid);
  if (!p) return;
  const lib = listLibrary(uid);
  profiles.set(uid, {
    ...p,
    stats: {
      watched: lib.filter((i) => i.status === "completed").length,
      watching: lib.filter((i) => i.status === "watching").length,
      planToWatch: lib.filter((i) => i.status === "plan_to_watch").length,
      favorites: listFavorites(uid).length,
      reviews: Array.from(reviews.values()).filter((r) => r.uid === uid)
        .length,
    },
    updatedAt: now(),
  });
}

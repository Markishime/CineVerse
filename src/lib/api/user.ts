import type {
  Collection,
  Favorite,
  Review,
  UserLibraryEntry,
  UserProfile,
  UserSettings,
  LibraryStatus,
} from "@/types/content";
import { apiFetch } from "./client";

export function fetchMe() {
  return apiFetch<{ profile: UserProfile; settings: UserSettings }>("/me");
}

export function updateMe(data: Partial<UserProfile>) {
  return apiFetch<{ profile: UserProfile }>("/me", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function updateSettings(data: Partial<UserSettings>) {
  return apiFetch<{ settings: UserSettings }>("/me/settings", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function fetchLibrary() {
  return apiFetch<{ items: UserLibraryEntry[] }>("/me/library");
}

export function putLibrary(
  contentId: string,
  data: {
    status: LibraryStatus;
    rating?: number | null;
    progress?: UserLibraryEntry["progress"];
    notes?: string;
  },
) {
  return apiFetch<{ item: UserLibraryEntry }>(
    `/me/library/${encodeURIComponent(contentId)}`,
    { method: "PUT", body: JSON.stringify(data) },
  );
}

export function patchLibrary(
  contentId: string,
  data: Partial<{
    status: LibraryStatus;
    rating: number | null;
    progress: UserLibraryEntry["progress"];
    notes: string;
  }>,
) {
  return apiFetch<{ item: UserLibraryEntry }>(
    `/me/library/${encodeURIComponent(contentId)}`,
    { method: "PATCH", body: JSON.stringify(data) },
  );
}

export function deleteLibrary(contentId: string) {
  return apiFetch<void>(`/me/library/${encodeURIComponent(contentId)}`, {
    method: "DELETE",
  });
}

export function putFavorite(contentId: string) {
  return apiFetch<{ item: Favorite }>(
    `/me/favorites/${encodeURIComponent(contentId)}`,
    { method: "PUT" },
  );
}

export function deleteFavorite(contentId: string) {
  return apiFetch<void>(`/me/favorites/${encodeURIComponent(contentId)}`, {
    method: "DELETE",
  });
}

export function fetchFavorites() {
  return apiFetch<{ items: Favorite[] }>("/me/favorites");
}

export function createReview(
  contentId: string,
  data: {
    rating: number;
    title?: string;
    body: string;
    hasSpoilers?: boolean;
  },
) {
  return apiFetch<{ review: Review }>(
    `/content/${encodeURIComponent(contentId)}/reviews`,
    { method: "POST", body: JSON.stringify(data) },
  );
}

export function updateReview(
  reviewId: string,
  data: Partial<{
    rating: number;
    title: string;
    body: string;
    hasSpoilers: boolean;
  }>,
) {
  return apiFetch<{ review: Review }>(
    `/reviews/${encodeURIComponent(reviewId)}`,
    { method: "PATCH", body: JSON.stringify(data) },
  );
}

export function deleteReview(reviewId: string) {
  return apiFetch<void>(`/reviews/${encodeURIComponent(reviewId)}`, {
    method: "DELETE",
  });
}

export function fetchCollections() {
  return apiFetch<{ items: Collection[] }>("/me/collections");
}

export function createCollection(data: {
  name: string;
  description?: string;
  isPublic?: boolean;
}) {
  return apiFetch<{ collection: Collection }>("/me/collections", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateCollection(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    isPublic: boolean;
    coverUrl: string | null;
  }>,
) {
  return apiFetch<{ collection: Collection }>(
    `/me/collections/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(data) },
  );
}

export function deleteCollection(id: string) {
  return apiFetch<void>(`/me/collections/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function addCollectionItem(collectionId: string, contentId: string) {
  return apiFetch<{ ok: true }>(
    `/me/collections/${encodeURIComponent(collectionId)}/items`,
    { method: "POST", body: JSON.stringify({ contentId }) },
  );
}

export function removeCollectionItem(collectionId: string, contentId: string) {
  return apiFetch<void>(
    `/me/collections/${encodeURIComponent(collectionId)}/items/${encodeURIComponent(contentId)}`,
    { method: "DELETE" },
  );
}

export function fetchProfile(username: string) {
  return apiFetch<{
    profile: UserProfile;
    publicLibrary: UserLibraryEntry[];
    publicCollections: Collection[];
  }>(`/profiles/${encodeURIComponent(username)}`);
}

export function fetchNotifications() {
  return apiFetch<{
    items: Array<{
      id: string;
      title: string;
      body: string;
      read: boolean;
      href?: string;
      createdAt: string;
    }>;
  }>("/me/notifications");
}

export function markNotificationRead(id: string) {
  return apiFetch<void>(`/me/notifications/${encodeURIComponent(id)}/read`, {
    method: "POST",
  });
}

export function deleteAccount() {
  return apiFetch<{ ok: true }>("/me", { method: "DELETE" });
}

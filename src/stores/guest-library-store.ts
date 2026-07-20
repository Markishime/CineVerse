"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LibraryStatus } from "@/types/content";
import type { ContentSnapshot } from "@/lib/user/my-list";

interface GuestLibraryItem {
  contentId: string;
  status: LibraryStatus;
  rating?: number | null;
  addedAt: string;
  /** Lightweight poster/title so My List works without seed-only lookup */
  snapshot?: ContentSnapshot;
}

interface GuestLibraryState {
  library: GuestLibraryItem[];
  favorites: string[];
  addLibrary: (
    contentId: string,
    status?: LibraryStatus,
    snapshot?: ContentSnapshot,
  ) => void;
  removeLibrary: (contentId: string) => void;
  toggleFavorite: (contentId: string) => void;
  clear: () => void;
  isFavorite: (contentId: string) => boolean;
  getStatus: (contentId: string) => LibraryStatus | null;
  getSnapshot: (contentId: string) => ContentSnapshot | null;
}

export const useGuestLibraryStore = create<GuestLibraryState>()(
  persist(
    (set, get) => ({
      library: [],
      favorites: [],
      addLibrary: (contentId, status = "plan_to_watch", snapshot) =>
        set((s) => {
          const prev = s.library.find((i) => i.contentId === contentId);
          const filtered = s.library.filter((i) => i.contentId !== contentId);
          return {
            library: [
              ...filtered,
              {
                contentId,
                status,
                addedAt: prev?.addedAt ?? new Date().toISOString(),
                snapshot: snapshot ?? prev?.snapshot,
              },
            ],
          };
        }),
      removeLibrary: (contentId) =>
        set((s) => ({
          library: s.library.filter((i) => i.contentId !== contentId),
        })),
      toggleFavorite: (contentId) =>
        set((s) => ({
          favorites: s.favorites.includes(contentId)
            ? s.favorites.filter((id) => id !== contentId)
            : [...s.favorites, contentId],
        })),
      clear: () => set({ library: [], favorites: [] }),
      isFavorite: (contentId) => get().favorites.includes(contentId),
      getStatus: (contentId) =>
        get().library.find((i) => i.contentId === contentId)?.status ?? null,
      getSnapshot: (contentId) =>
        get().library.find((i) => i.contentId === contentId)?.snapshot ?? null,
    }),
    { name: "cineverse-guest-library" },
  ),
);

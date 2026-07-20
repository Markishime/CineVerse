"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark, Trash2 } from "lucide-react";
import { deleteLibrary, fetchLibrary } from "@/lib/api/user";
import { fetchContentById } from "@/lib/api/content";
import { ContentCard } from "@/components/content/content-card";
import { ContinueWatchingRow } from "@/components/content/continue-watching-row";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import {
  contentFromSnapshot,
  LIST_TABS,
} from "@/lib/user/my-list";
import {
  getLocalSnapshot,
  localEntriesAsApiItems,
  mergeServerLibrary,
  readLocalLibrary,
  removeLocalLibrary,
  type LocalLibraryEntry,
} from "@/lib/user/local-library";
import type { Content, LibraryStatus } from "@/types/content";
import { cn } from "@/lib/utils";

type Tab = LibraryStatus | "all";

/**
 * My List / Watchlist — local-first, works for guest + signed-in.
 */
export default function WatchlistPage() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("plan_to_watch");
  const [localTick, setLocalTick] = useState(0);
  const uid = user?.uid ?? null;

  const bumpLocal = useCallback(() => {
    setLocalTick((n) => n + 1);
  }, []);

  useEffect(() => {
    const onChange = () => bumpLocal();
    window.addEventListener("cineverse-library-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("cineverse-library-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [bumpLocal]);

  // Optional server merge when signed in
  const { isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["library-server", uid],
    queryFn: async () => {
      if (!uid) return { items: [] };
      try {
        const remote = await fetchLibrary();
        mergeServerLibrary(uid, remote.items ?? []);
        bumpLocal();
        return remote;
      } catch {
        return { items: [] };
      }
    },
    enabled: Boolean(uid),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const localItems: LocalLibraryEntry[] = useMemo(() => {
    void localTick;
    return readLocalLibrary(uid);
  }, [uid, localTick]);

  const entries = useMemo(() => {
    if (tab === "all") return localItems;
    return localItems.filter((e) => e.status === tab);
  }, [localItems, tab]);

  const contentIds = useMemo(
    () => Array.from(new Set(entries.map((e) => e.contentId))).slice(0, 60),
    [entries],
  );

  const postersQuery = useQuery({
    queryKey: ["watchlist-content", contentIds.join("|")],
    queryFn: async () => {
      const map: Record<string, Content | null> = {};
      await Promise.all(
        contentIds.map(async (id) => {
          try {
            map[id] = await fetchContentById(id);
          } catch {
            const snap =
              getLocalSnapshot(uid, id) ??
              entries.find((e) => e.contentId === id)?.snapshot ??
              null;
            map[id] = snap ? contentFromSnapshot(snap) : null;
          }
        }),
      );
      return map;
    },
    enabled: contentIds.length > 0,
    staleTime: 60_000,
  });

  const removeMut = useMutation({
    mutationFn: async (contentId: string) => {
      removeLocalLibrary(uid, contentId);
      window.dispatchEvent(new Event("cineverse-library-changed"));
      bumpLocal();
      if (uid) {
        try {
          await deleteLibrary(contentId);
        } catch {
          /* local already removed */
        }
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["library"] });
      void queryClient.invalidateQueries({ queryKey: ["library-server"] });
    },
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: localItems.length };
    for (const e of localItems) {
      c[e.status] = (c[e.status] ?? 0) + 1;
    }
    return c;
  }, [localItems]);

  // Keep React Query "library" key warm for other screens
  useEffect(() => {
    queryClient.setQueryData(
      ["library", uid ?? "guest"],
      { items: localEntriesAsApiItems(localItems, uid ?? "guest") },
    );
  }, [localItems, uid, queryClient]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-24 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--primary-light)]">
            Your library
          </p>
          <h1 className="font-display text-3xl font-bold text-white">
            My List & Watchlist
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {user
              ? "Saved on this device and synced when the server is available."
              : "Saved on this device — sign in to sync across devices."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dataUpdatedAt ? (
            <span className="text-xs text-[var(--text-muted)]">
              Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
              {isFetching ? " · refreshing…" : ""}
            </span>
          ) : (
            <span className="text-xs text-[var(--text-muted)]">
              {localItems.length} title{localItems.length === 1 ? "" : "s"}
            </span>
          )}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              bumpLocal();
              void refetch();
            }}
          >
            Refresh
          </Button>
          {!user && (
            <Link href="/login">
              <Button size="sm">Sign in to sync</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="mt-10">
        <ContinueWatchingRow title="Continue watching" />
      </div>

      <div className="mt-10 flex flex-wrap gap-2">
        {LIST_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition",
              tab === t.id
                ? "bg-[var(--primary)] text-white"
                : "bg-white/5 text-[var(--text-secondary)] hover:bg-white/10 hover:text-white",
            )}
          >
            {t.label}
            {counts[t.id] != null ? (
              <span className="ml-1.5 text-xs opacity-70">{counts[t.id]}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {entries.map((e) => {
          const snap =
            e.snapshot ?? getLocalSnapshot(uid, e.contentId) ?? null;
          const content =
            postersQuery.data?.[e.contentId] ??
            (snap ? contentFromSnapshot(snap) : null);

          if (!content) {
            return (
              <div
                key={e.contentId}
                className="flex aspect-[2/3] flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-[var(--surface)] p-3 text-center"
              >
                <Bookmark className="h-6 w-6 text-[var(--text-muted)]" />
                <p className="text-xs text-white line-clamp-3">
                  {e.contentId}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeMut.mutate(e.contentId)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            );
          }

          return (
            <div key={e.contentId} className="relative">
              <ContentCard content={content} className="w-full min-w-0" />
              <button
                type="button"
                aria-label="Remove from list"
                className="absolute right-2 top-2 z-10 rounded-full bg-black/70 p-1.5 text-white hover:bg-black"
                onClick={() => removeMut.mutate(e.contentId)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {entries.length === 0 && (
        <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
          <Bookmark className="mx-auto h-10 w-10 text-[var(--text-muted)]" />
          <p className="mt-4 font-display text-lg font-semibold text-white">
            {tab === "plan_to_watch" ? "My List is empty" : "Nothing here yet"}
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Tap <strong className="text-white">My List</strong> on any movie,
            series, anime, or K-drama card to save it here.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/discover">
              <Button>Discover</Button>
            </Link>
            <Link href="/movies">
              <Button variant="secondary">Movies</Button>
            </Link>
            <Link href="/series">
              <Button variant="secondary">Series</Button>
            </Link>
            <Link href="/anime">
              <Button variant="secondary">Anime</Button>
            </Link>
            <Link href="/kdrama">
              <Button variant="secondary">K-Drama</Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

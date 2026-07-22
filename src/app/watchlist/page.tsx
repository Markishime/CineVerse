"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bookmark, Trash2 } from "lucide-react";
import { deleteLibrary, fetchLibrary } from "@/lib/api/user";
import { fetchContentById } from "@/lib/api/content";
import { ContentCard } from "@/components/content/content-card";
import { ContinueWatchingRow } from "@/components/content/continue-watching-row";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Chip } from "@/components/ui/chip";
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
    <div className="page-shell">
      <PageHeader
        eyebrow="Your library"
        title="My List"
        description={
          user
            ? "Saved on this device and synced when online."
            : "Saved on this device. Sign in to sync across devices."
        }
        actions={
          <>
            <span className="text-xs text-[var(--text-muted)]">
              {dataUpdatedAt
                ? `Updated ${new Date(dataUpdatedAt).toLocaleTimeString()}${isFetching ? " · refreshing…" : ""}`
                : `${localItems.length} title${localItems.length === 1 ? "" : "s"}`}
            </span>
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
          </>
        }
      />

      <div className="mt-10">
        <ContinueWatchingRow title="Continue watching" />
      </div>

      <div className="mt-10 flex flex-wrap gap-2">
        {LIST_TABS.map((t) => (
          <Chip key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
            {counts[t.id] != null ? (
              <span className="text-xs opacity-70">{counts[t.id]}</span>
            ) : null}
          </Chip>
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
                className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/75 text-white transition-colors hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                onClick={() => removeMut.mutate(e.contentId)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {entries.length === 0 && (
        <EmptyState
          className="mt-12"
          icon={Bookmark}
          title={
            tab === "plan_to_watch" ? "My List is empty" : "Nothing here yet"
          }
          description="Tap My List on any movie, series, anime, or K-drama card to save it here."
          actions={[
            { href: "/discover", label: "Discover" },
            { href: "/movies", label: "Movies", variant: "secondary" },
            { href: "/series", label: "Series", variant: "secondary" },
            { href: "/anime", label: "Anime", variant: "secondary" },
            { href: "/kdrama", label: "K-Drama", variant: "secondary" },
          ]}
        />
      )}
    </div>
  );
}

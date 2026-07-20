"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import type { Content } from "@/types/content";
import { deleteLibrary, putLibrary } from "@/lib/api/user";
import { snapshotFromContent } from "@/lib/user/my-list";
import {
  isInMyList,
  removeLocalLibrary,
  upsertLocalLibrary,
} from "@/lib/user/local-library";
import { useAuthStore } from "@/stores/auth-store";
import { useGuestLibraryStore } from "@/stores/guest-library-store";
import { cn } from "@/lib/utils";

/**
 * Toggle My List — local-first so it always works offline / when API is flaky.
 */
export function AddToListButton({
  content,
  className,
  size = "sm",
  showLabel = true,
}: {
  content: Content;
  className?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  const guest = useGuestLibraryStore();
  const queryClient = useQueryClient();
  const uid = user?.uid ?? null;

  const [inList, setInList] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setInList(isInMyList(uid, content.id));
  }, [uid, content.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Stay in sync if another card toggles the same title
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key?.includes("cineverse_library")) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("cineverse-library-changed", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("cineverse-library-changed", refresh);
    };
  }, [refresh]);

  const toggle = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    const snap = snapshotFromContent(content);
    const wasIn = isInMyList(uid, content.id);

    try {
      // 1) Always update local first (source of truth)
      if (wasIn) {
        removeLocalLibrary(uid, content.id);
        if (!user) guest.removeLibrary(content.id);
      } else {
        upsertLocalLibrary(uid, {
          contentId: content.id,
          status: "plan_to_watch",
          snapshot: snap,
        });
        if (!user) {
          guest.addLibrary(content.id, "plan_to_watch", snap);
        }
      }

      setInList(!wasIn);
      window.dispatchEvent(new Event("cineverse-library-changed"));
      void queryClient.invalidateQueries({ queryKey: ["library"] });

      // 2) Best-effort server sync when signed in
      if (user) {
        try {
          if (wasIn) {
            await deleteLibrary(content.id);
          } else {
            await putLibrary(content.id, { status: "plan_to_watch" });
          }
        } catch {
          // Local already saved — still works on this device
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update My List");
      refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggle();
      }}
      disabled={pending}
      title={error ?? (inList ? "Remove from My List" : "Add to My List")}
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-lg font-semibold transition",
        size === "sm" && "px-2 py-1.5 text-[11px]",
        size === "md" && "px-3 py-2 text-sm",
        inList
          ? "bg-[var(--primary)]/25 text-[var(--primary-light)] hover:bg-[var(--primary)]/35"
          : "bg-white/12 text-white hover:bg-white/20",
        className,
      )}
      aria-label={inList ? "Remove from My List" : "Add to My List"}
      aria-pressed={inList}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : inList ? (
        <BookmarkCheck className="h-3.5 w-3.5" />
      ) : (
        <Bookmark className="h-3.5 w-3.5" />
      )}
      {showLabel && (inList ? "In My List" : "My List")}
    </button>
  );
}

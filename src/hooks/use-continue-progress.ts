"use client";

import { useSyncExternalStore } from "react";
import { listContinueWatching } from "@/lib/content/watch-progress";
import { useAuthStore } from "@/stores/auth-store";

type ProgressMap = ReadonlyMap<string, number>;

const EMPTY: ProgressMap = new Map();
const listeners = new Set<() => void>();
let cache: { uid: string | null; map: ProgressMap } | null = null;

function invalidate() {
  cache = null;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    window.addEventListener("cineverse:continue-watching", invalidate);
    window.addEventListener("storage", invalidate);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("cineverse:continue-watching", invalidate);
      window.removeEventListener("storage", invalidate);
    }
  };
}

function snapshot(uid: string | null): ProgressMap {
  if (cache?.uid === uid) return cache.map;
  const map = new Map<string, number>();
  for (const item of listContinueWatching(uid)) {
    if (typeof item.percent === "number" && item.percent > 0) {
      map.set(item.contentId, Math.min(100, item.percent));
    }
  }
  cache = { uid, map };
  return map;
}

/** Shared, single-listener view of Continue Watching progress (0–100) per title. */
export function useContinueProgress(contentId: string): number | undefined {
  const uid = useAuthStore((s) => s.user?.uid ?? null);
  const map = useSyncExternalStore(
    subscribe,
    () => snapshot(uid),
    () => EMPTY,
  );
  return map.get(contentId);
}

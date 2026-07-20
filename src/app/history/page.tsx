"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchContentById } from "@/lib/api/content";
import { ContentCard } from "@/components/content/content-card";
import { ContinueWatchingRow } from "@/components/content/continue-watching-row";
import { useAuthStore } from "@/stores/auth-store";
import {
  contentFromSnapshot,
} from "@/lib/user/my-list";
import {
  getLocalSnapshot,
  readLocalLibrary,
} from "@/lib/user/local-library";
import type { Content } from "@/types/content";
import { Button } from "@/components/ui/button";

export default function HistoryPage() {
  const user = useAuthStore((s) => s.user);
  const uid = user?.uid ?? null;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onChange = () => setTick((n) => n + 1);
    window.addEventListener("cineverse-library-changed", onChange);
    return () => window.removeEventListener("cineverse-library-changed", onChange);
  }, []);

  const completed = useMemo(() => {
    void tick;
    return readLocalLibrary(uid).filter((i) => i.status === "completed");
  }, [uid, tick]);

  const contentIds = useMemo(
    () => completed.map((e) => e.contentId).slice(0, 40),
    [completed],
  );

  const postersQuery = useQuery({
    queryKey: ["history-content", contentIds.join("|")],
    queryFn: async () => {
      const map: Record<string, Content | null> = {};
      await Promise.all(
        contentIds.map(async (id) => {
          try {
            map[id] = await fetchContentById(id);
          } catch {
            const snap =
              getLocalSnapshot(uid, id) ??
              completed.find((c) => c.contentId === id)?.snapshot ??
              null;
            map[id] = snap ? contentFromSnapshot(snap) : null;
          }
        }),
      );
      return map;
    },
    enabled: contentIds.length > 0,
  });

  const items = completed
    .map(
      (e) =>
        postersQuery.data?.[e.contentId] ??
        (e.snapshot ? contentFromSnapshot(e.snapshot) : null),
    )
    .filter(Boolean) as Content[];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-24 sm:px-6">
      <h1 className="font-display text-3xl font-bold">History</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Continue watching and completed titles for your account on this device.
      </p>

      <div className="mt-10">
        <ContinueWatchingRow title="Continue watching" />
      </div>

      <h2 className="mt-12 font-display text-xl font-semibold text-white">
        Completed
      </h2>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((c) => (
          <ContentCard key={c.id} content={c} className="w-full min-w-0" />
        ))}
      </div>
      {items.length === 0 && (
        <p className="mt-8 text-[var(--text-muted)]">
          Nothing completed yet.{" "}
          <Link href="/discover" className="text-[var(--primary-light)]">
            Start watching
          </Link>
          .
        </p>
      )}
      <div className="mt-8">
        <Link href="/watchlist">
          <Button variant="secondary">Open My List</Button>
        </Link>
      </div>
    </div>
  );
}

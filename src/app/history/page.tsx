"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import { fetchContentById } from "@/lib/api/content";
import { ContentCard } from "@/components/content/content-card";
import { ContinueWatchingRow } from "@/components/content/continue-watching-row";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { useAuthStore } from "@/stores/auth-store";
import { contentFromSnapshot } from "@/lib/user/my-list";
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
    return () =>
      window.removeEventListener("cineverse-library-changed", onChange);
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
    <div className="page-shell">
      <PageHeader
        eyebrow="Watch activity"
        title="History"
        description="Continue watching and titles you marked completed on this device."
        actions={
          <Link href="/watchlist">
            <Button variant="secondary" size="sm">
              Open My List
            </Button>
          </Link>
        }
      />

      <div className="mt-10">
        <ContinueWatchingRow title="Continue watching" />
      </div>

      <h2 className="mt-12 font-display text-xl font-semibold text-white">
        Completed
      </h2>

      {items.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map((c) => (
            <ContentCard key={c.id} content={c} className="w-full min-w-0" />
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-6"
          icon={History}
          title="Nothing completed yet"
          description="Mark titles as watched from a detail page, or keep going with Discover."
          actions={[
            { href: "/discover", label: "Start watching" },
            { href: "/watchlist", label: "My List", variant: "secondary" },
          ]}
        />
      )}
    </div>
  );
}

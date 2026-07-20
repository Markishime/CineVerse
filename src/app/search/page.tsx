"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import { searchContent } from "@/lib/api/content";
import { ContentCard } from "@/components/content/content-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { isMatureEnabledClient } from "@/lib/user/local-profile";

function SearchInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const initial = sp.get("q") ?? "";
  const [q, setQ] = useState(initial);
  const type = sp.get("type") ?? "";
  const settings = useAuthStore((s) => s.settings);
  const user = useAuthStore((s) => s.user);
  const [deviceMature, setDeviceMature] = useState(false);

  useEffect(() => {
    setDeviceMature(isMatureEnabledClient(user?.uid));
  }, [user?.uid, settings?.matureContent]);

  const mature = Boolean(settings?.matureContent) || deviceMature;

  const { data, isFetching, isFetched } = useQuery({
    queryKey: ["search", initial, type, mature],
    queryFn: () =>
      searchContent({
        q: initial,
        type: type || undefined,
        mature,
      }),
    enabled: initial.length >= 1,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-24 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Search</h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Unified search: original, Korean, Romaji, and native titles. Exact
        matches rank first.
      </p>

      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const params = new URLSearchParams();
          if (q.trim()) params.set("q", q.trim());
          if (type) params.set("type", type);
          router.push(`/search?${params.toString()}`);
        }}
      >
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <Input
            className="pl-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search movies, series, anime, K-drama, people…"
            autoFocus
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {["", "movie", "series", "anime", "kdrama"].map((t) => (
          <button
            key={t || "all"}
            type="button"
            className={`rounded-full px-3 py-1 text-xs ${
              type === t
                ? "bg-[var(--primary)] text-white"
                : "bg-white/5 text-[var(--text-muted)]"
            }`}
            onClick={() => {
              const params = new URLSearchParams();
              if (q.trim()) params.set("q", q.trim());
              if (t) params.set("type", t);
              router.push(`/search?${params.toString()}`);
            }}
          >
            {t || "All"}
          </button>
        ))}
      </div>

      {isFetching && (
        <p className="mt-8 text-sm text-[var(--text-muted)]">Searching…</p>
      )}

      {isFetched && data && (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {data.items.map((item) => (
            <ContentCard
              key={item.id}
              content={item}
              className="w-full min-w-0"
            />
          ))}
        </div>
      )}

      {isFetched && data?.items.length === 0 && (
        <p className="mt-8 text-[var(--text-muted)]">No results for “{initial}”.</p>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="pt-24 h-40 skeleton mx-4 rounded-xl" />}>
      <SearchInner />
    </Suspense>
  );
}

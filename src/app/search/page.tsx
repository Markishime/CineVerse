"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search as SearchIcon } from "lucide-react";
import { searchContent } from "@/lib/api/content";
import { ContentCard } from "@/components/content/content-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { useAuthStore } from "@/stores/auth-store";
import { isMatureEnabledClient } from "@/lib/user/local-profile";

const TYPE_FILTERS = [
  { id: "", label: "All" },
  { id: "movie", label: "Movies" },
  { id: "series", label: "Series" },
  { id: "anime", label: "Anime" },
  { id: "kdrama", label: "K-Drama" },
] as const;

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

  useEffect(() => {
    setQ(initial);
  }, [initial]);

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

  const push = (nextQ: string, nextType: string) => {
    const params = new URLSearchParams();
    if (nextQ.trim()) params.set("q", nextQ.trim());
    if (nextType) params.set("type", nextType);
    router.push(`/search?${params.toString()}`);
  };

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Find anything"
        title="Search"
        description="Unified search across original, Korean, Romaji, and native titles. Exact matches rank first."
      />

      <form
        className="mt-8 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          push(q, type);
        }}
        role="search"
      >
        <div className="relative flex-1">
          <SearchIcon
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
            aria-hidden
          />
          <Input
            className="h-12 pl-10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search movies, series, anime, K-drama…"
            autoFocus
            aria-label="Search query"
          />
        </div>
        <Button type="submit" className="h-12 px-6 sm:w-auto">
          Search
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Type filter">
        {TYPE_FILTERS.map((t) => (
          <Chip
            key={t.id || "all"}
            active={type === t.id}
            onClick={() => push(q, t.id)}
          >
            {t.label}
          </Chip>
        ))}
      </div>

      {isFetching && (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] skeleton rounded-xl" />
          ))}
        </div>
      )}

      {isFetched && data && data.items.length > 0 && (
        <>
          <p className="mt-8 text-sm text-[var(--text-muted)]">
            {data.items.length} result{data.items.length === 1 ? "" : "s"}
            {initial ? ` for “${initial}”` : ""}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {data.items.map((item) => (
              <ContentCard
                key={item.id}
                content={item}
                className="w-full min-w-0"
              />
            ))}
          </div>
        </>
      )}

      {isFetched && data?.items.length === 0 && (
        <EmptyState
          className="mt-10"
          icon={SearchIcon}
          title={`No results for “${initial}”`}
          description="Try a shorter title, switch type filters, or browse Discover."
          actions={[
            { href: "/discover", label: "Discover" },
            { href: "/movies", label: "Movies", variant: "secondary" },
          ]}
        />
      )}

      {!initial && !isFetched && (
        <EmptyState
          className="mt-10"
          icon={SearchIcon}
          title="Start typing to search"
          description="Find movies, series, anime, and K-dramas across the live catalog."
          actions={[{ href: "/discover", label: "Browse Discover", variant: "secondary" }]}
        />
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="page-shell">
          <div className="h-40 skeleton rounded-2xl" />
        </div>
      }
    >
      <SearchInner />
    </Suspense>
  );
}

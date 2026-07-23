"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { fetchDiscover, fetchHome } from "@/lib/api/content";
import { ContentCard } from "@/components/content/content-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { useAuthStore } from "@/stores/auth-store";
import { isMatureEnabledClient } from "@/lib/user/local-profile";
import { getDeviceRegion } from "@/lib/user/region";
import { cn } from "@/lib/utils";

const FALLBACK_MOODS = [
  { id: "cozy", label: "Cozy nights", emoji: "🌙" },
  { id: "thrill", label: "Heart-racing", emoji: "⚡" },
  { id: "mindbend", label: "Mind-bending", emoji: "🌀" },
  { id: "romance", label: "Soft romance", emoji: "💫" },
  { id: "epic", label: "Epic scale", emoji: "🚀" },
  { id: "comfort", label: "Comfort rewatch", emoji: "☕" },
];

const FALLBACK_GENRES = [
  { id: "action", name: "Action" },
  { id: "adventure", name: "Adventure" },
  { id: "comedy", name: "Comedy" },
  { id: "crime", name: "Crime" },
  { id: "drama", name: "Drama" },
  { id: "fantasy", name: "Fantasy" },
  { id: "horror", name: "Horror" },
  { id: "mystery", name: "Mystery" },
  { id: "romance", name: "Romance" },
  { id: "scifi", name: "Science Fiction" },
  { id: "thriller", name: "Thriller" },
  { id: "animation", name: "Animation" },
];

const TYPES = [
  { id: "", label: "All" },
  { id: "movie", label: "Movies" },
  { id: "series", label: "Series" },
  { id: "anime", label: "Anime" },
  { id: "kdrama", label: "K-Drama" },
] as const;

function DiscoverInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const q = sp.get("q") ?? "";
  const type = sp.get("type") ?? "";
  const genre = sp.get("genre") ?? "";
  const year = sp.get("year") ?? "";
  const mood = sp.get("mood") ?? "";
  const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
  const settings = useAuthStore((s) => s.settings);
  const user = useAuthStore((s) => s.user);
  const [deviceMature, setDeviceMature] = useState(false);
  const [searchDraft, setSearchDraft] = useState(q);
  const [genreDraft, setGenreDraft] = useState(genre);
  const [yearDraft, setYearDraft] = useState(year);

  useEffect(() => {
    setDeviceMature(isMatureEnabledClient(user?.uid));
  }, [user?.uid, settings?.matureContent]);

  useEffect(() => {
    setSearchDraft(q);
    setGenreDraft(genre);
    setYearDraft(year);
  }, [q, genre, year]);

  const mature = Boolean(settings?.matureContent) || deviceMature;

  const update = useCallback(
    (patch: Record<string, string | undefined>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      if (!("page" in patch)) next.delete("page");
      router.replace(`/discover?${next.toString()}`);
    },
    [router, sp],
  );

  const homeQuery = useQuery({
    queryKey: ["home-meta", mature],
    queryFn: () => fetchHome(getDeviceRegion("*"), mature),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const moods = homeQuery.data?.moods?.length
    ? homeQuery.data.moods
    : FALLBACK_MOODS;
  const genres = homeQuery.data?.genres?.length
    ? homeQuery.data.genres
    : FALLBACK_GENRES;

  const {
    data,
    isLoading,
    isFetching,
    isError,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ["discover", q, type, genre, year, mood, page, mature],
    queryFn: () =>
      fetchDiscover({
        q: q || undefined,
        type: type || undefined,
        genre: genre || undefined,
        year: year ? Number(year) : undefined,
        mood: mood || undefined,
        page,
        mature: mature ? "1" : undefined,
      }),
    staleTime: 15_000,
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (searchDraft !== q) update({ q: searchDraft.trim() || undefined });
    }, 400);
    return () => window.clearTimeout(t);
  }, [searchDraft, q, update]);

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  const liveLabel = useMemo(() => {
    if (!dataUpdatedAt) return null;
    return new Date(dataUpdatedAt).toLocaleTimeString();
  }, [dataUpdatedAt]);

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Live catalog"
        title="Discover"
        description="Browse movies, series, anime, and K-dramas. Filters stay in the URL so you can share or refresh anytime."
        actions={
          <>
            <span className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <span
                className={cn(
                  "inline-flex h-2 w-2 rounded-full",
                  isFetching
                    ? "animate-pulse bg-[var(--gold)]"
                    : "bg-[var(--success)]",
                )}
              />
              {isFetching
                ? "Updating…"
                : liveLabel
                  ? `Live · ${liveLabel}`
                  : "Live"}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void refetch()}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Refresh
            </Button>
          </>
        }
      />

      <div
        className="mt-8 flex flex-wrap gap-2"
        role="tablist"
        aria-label="Content type"
      >
        {TYPES.map((t) => (
          <Chip
            key={t.id || "all"}
            active={type === t.id}
            onClick={() => update({ type: t.id || undefined })}
          >
            {t.label}
          </Chip>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-[var(--surface)] p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            placeholder="Search titles…"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                update({ q: searchDraft.trim() || undefined });
              }
            }}
            aria-label="Search titles"
            className="h-11"
          />
          <Input
            placeholder="Genre (e.g. Drama)"
            value={genreDraft}
            onChange={(e) => setGenreDraft(e.target.value)}
            onBlur={() => update({ genre: genreDraft.trim() || undefined })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                update({ genre: genreDraft.trim() || undefined });
              }
            }}
            aria-label="Genre"
            className="h-11"
          />
          <Input
            placeholder="Year"
            value={yearDraft}
            onChange={(e) =>
              setYearDraft(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            onBlur={() => update({ year: yearDraft || undefined })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                update({ year: yearDraft || undefined });
              }
            }}
            aria-label="Year"
            className="h-11"
          />
          <Button
            variant="secondary"
            className="h-11"
            onClick={() =>
              update({
                q: searchDraft.trim() || undefined,
                genre: genreDraft.trim() || undefined,
                year: yearDraft || undefined,
              })
            }
          >
            Apply
          </Button>
          <Button
            variant="outline"
            className="h-11"
            onClick={() => {
              setSearchDraft("");
              setGenreDraft("");
              setYearDraft("");
              router.replace("/discover");
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Mood
        </p>
        <div className="flex flex-wrap gap-2">
          {moods.map((m) => (
            <Chip
              key={m.id}
              active={mood === m.id}
              onClick={() => update({ mood: mood === m.id ? undefined : m.id })}
              className={
                mood === m.id
                  ? "!bg-[var(--secondary)]/25 !text-white ring-1 ring-[var(--secondary)]/50"
                  : undefined
              }
            >
              {m.emoji} {m.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="mt-5 mb-8">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
          Genre
        </p>
        <div className="flex flex-wrap gap-2">
          {genres.map((g) => {
            const name = "name" in g ? g.name : String(g);
            const id = "id" in g ? g.id : name.toLowerCase();
            const active =
              genre.toLowerCase() === name.toLowerCase() ||
              genre.toLowerCase() === String(id).toLowerCase();
            return (
              <Chip
                key={String(id)}
                active={active}
                onClick={() => update({ genre: active ? undefined : name })}
                className="text-xs"
              >
                {name}
              </Chip>
            );
          })}
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] skeleton rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-8 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            Could not load the live catalog. Try again.
          </p>
          <Button className="mt-4" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !isError && items.length > 0 && (
        <>
          <p className="mb-4 text-sm text-[var(--text-muted)]">
            {data?.total != null
              ? `${data.total} titles`
              : `${items.length} titles`}
            {q ? ` for “${q}”` : ""}
            {type ? ` · ${type}` : ""}
            {genre ? ` · ${genre}` : ""}
            {mood ? ` · mood ${mood}` : ""}
            {page > 1 ? ` · page ${page}` : ""}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {items.map((item) => (
              <ContentCard
                key={item.id}
                content={item}
                className="w-full min-w-0"
              />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-3">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => update({ page: String(page - 1) })}
              >
                Previous
              </Button>
              <span className="text-sm text-[var(--text-muted)]">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={page >= totalPages}
                onClick={() => update({ page: String(page + 1) })}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <EmptyState
          title="No matches"
          description="Broaden filters or try a different mood."
          actions={[{ href: "/movies", label: "Browse movies", variant: "secondary" }]}
        />
      )}

      {!isLoading &&
        !isError &&
        items.length === 0 &&
        (homeQuery.data?.trending?.length ?? 0) > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 font-display text-xl font-semibold text-white">
              Trending right now
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {homeQuery.data!.trending.slice(0, 10).map((item) => (
                <ContentCard
                  key={item.id}
                  content={item}
                  className="w-full min-w-0"
                />
              ))}
            </div>
          </div>
        )}
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense
      fallback={
        <div className="page-shell">
          <div className="h-96 skeleton rounded-2xl" />
        </div>
      }
    >
      <DiscoverInner />
    </Suspense>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { fetchDiscover, fetchHome } from "@/lib/api/content";
import { ContentCard } from "@/components/content/content-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { isMatureEnabledClient } from "@/lib/user/local-profile";
import { APP_REGION } from "@/lib/user/region";
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
      // Reset page when filters change (unless page itself is set)
      if (!("page" in patch)) next.delete("page");
      router.replace(`/discover?${next.toString()}`);
    },
    [router, sp],
  );

  // Live catalog meta (moods/genres) + trending fallback
  const homeQuery = useQuery({
    queryKey: ["home-meta", mature, APP_REGION],
    queryFn: () => fetchHome(APP_REGION, mature),
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

  // Debounced search from draft
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
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-24 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">
            Discover
          </h1>
          <p className="mt-2 text-[var(--text-muted)]">
            Live catalog of movies, series, anime, and K-dramas. Filters stay in
            the URL.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
          <span
            className={cn(
              "inline-flex h-2 w-2 rounded-full",
              isFetching ? "animate-pulse bg-[var(--gold)]" : "bg-[var(--success)]",
            )}
          />
          {isFetching ? "Live updating…" : liveLabel ? `Live · ${liveLabel}` : "Live"}
          <Button size="sm" variant="secondary" onClick={() => void refetch()}>
            Refresh
          </Button>
        </div>
      </header>

      {/* Type tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button
            key={t.id || "all"}
            type="button"
            onClick={() => update({ type: t.id || undefined })}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition",
              type === t.id
                ? "bg-[var(--primary)] text-white"
                : "bg-white/5 text-[var(--text-secondary)] hover:bg-white/10",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          placeholder="Search titles…"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              update({ q: searchDraft.trim() || undefined });
            }
          }}
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
        />
        <Input
          placeholder="Year"
          value={yearDraft}
          onChange={(e) => setYearDraft(e.target.value.replace(/\D/g, "").slice(0, 4))}
          onBlur={() => update({ year: yearDraft || undefined })}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              update({ year: yearDraft || undefined });
            }
          }}
        />
        <Button
          variant="secondary"
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

      {/* Moods */}
      <div className="mb-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          Mood
        </p>
        <div className="flex flex-wrap gap-2">
          {moods.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() =>
                update({ mood: mood === m.id ? undefined : m.id })
              }
              className={cn(
                "rounded-full px-3 py-1.5 text-sm transition",
                mood === m.id
                  ? "bg-[var(--secondary)]/30 text-white ring-1 ring-[var(--secondary)]"
                  : "bg-white/5 text-[var(--text-secondary)] hover:bg-white/10",
              )}
            >
              {m.emoji} {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Genres */}
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
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
              <button
                key={String(id)}
                type="button"
                onClick={() =>
                  update({ genre: active ? undefined : name })
                }
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition",
                  active
                    ? "bg-[var(--primary)] text-white"
                    : "bg-white/5 text-[var(--text-secondary)] hover:bg-white/10",
                )}
              >
                {name}
              </button>
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
        <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-6 text-center">
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
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
          <p className="font-display text-lg font-semibold text-white">
            No matches
          </p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Broaden filters or try a different mood.
          </p>
          {(homeQuery.data?.trending?.length ?? 0) > 0 && (
            <div className="mt-10 text-left">
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
      )}
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div className="pt-24 skeleton h-96 mx-4 rounded-xl" />}>
      <DiscoverInner />
    </Suspense>
  );
}

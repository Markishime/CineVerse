"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Search as SearchIcon, X } from "lucide-react";
import { searchContent } from "@/lib/api/content";
import { ContentCard } from "@/components/content/content-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { useAuthStore } from "@/stores/auth-store";
import { useDeviceMature } from "@/hooks/use-device-mature";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { isRestrictedContentUser } from "@/lib/content/mature";
import { displayTitle } from "@/lib/content/normalize";
import { getDetailsHref } from "@/lib/content/watch-href";
import {
  posterFallbackLabel,
  resizeTmdbImage,
  resolveCardImageUrl,
} from "@/lib/content/posters";
import { cn } from "@/lib/utils";

const TYPE_FILTERS = [
  { id: "", label: "All" },
  { id: "movie", label: "Movies" },
  { id: "series", label: "Series" },
  { id: "anime", label: "Anime" },
  { id: "kdrama", label: "K-Drama" },
  { id: "jdrama", label: "J-Drama" },
  { id: "cdrama", label: "C-Drama" },
  { id: "thaidrama", label: "Thai Drama" },
] as const;

const MIN_QUERY = 2;

function SearchInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const type = sp.get("type") ?? "";
  const [q, setQ] = useState(() => sp.get("q") ?? "");
  // Query actually sent to the API: updates 300ms after the last keystroke
  // (or immediately on Enter), never per keystroke.
  const debounced = useDebouncedValue(q.trim(), 300);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const activeQuery = submitted ?? debounced;
  const settings = useAuthStore((s) => s.settings);
  const user = useAuthStore((s) => s.user);
  const deviceMature = useDeviceMature(user?.uid);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const mature =
    isRestrictedContentUser(user?.email) &&
    (Boolean(settings?.matureContent) || deviceMature);

  const enabled = activeQuery.length >= MIN_QUERY;
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ["search", activeQuery, type, mature],
    queryFn: () =>
      searchContent({
        q: activeQuery,
        type: type || undefined,
        mature,
      }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: 1,
  });

  // Keep the URL shareable without feeding it back into the input.
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeQuery) params.set("q", activeQuery);
    if (type) params.set("type", type);
    const next = params.toString();
    if (next !== sp.toString()) {
      router.replace(next ? `/search?${next}` : "/search", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuery, type]);

  const suggestions = useMemo(
    () => (enabled ? (data?.items ?? []).slice(0, 6) : []),
    [enabled, data],
  );
  const showSuggestions = open && q.trim().length >= MIN_QUERY;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const changeType = (nextType: string) => {
    const params = new URLSearchParams();
    if (activeQuery) params.set("q", activeQuery);
    if (nextType) params.set("type", nextType);
    const next = params.toString();
    router.push(next ? `/search?${next}` : "/search");
  };

  const clear = () => {
    setQ("");
    setSubmitted(null);
    setOpen(false);
    setHighlight(-1);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, -1));
    } else if (e.key === "Escape") {
      if (open) setOpen(false);
      else clear();
    } else if (e.key === "Enter" && highlight >= 0 && suggestions[highlight]) {
      e.preventDefault();
      router.push(getDetailsHref(suggestions[highlight]));
    }
  };

  const showResults = enabled && data;
  const resultItems = data?.items ?? [];

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Find anything"
        title="Search"
        description="Unified search across original, Korean, Romaji, and native titles. Exact matches rank first."
      />

      <div className="relative mt-8" ref={boxRef}>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(q.trim());
            setOpen(false);
          }}
          role="search"
        >
          <div className="relative flex-1">
            <SearchIcon
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
              aria-hidden
            />
            <Input
              ref={inputRef}
              className="h-12 pl-10 pr-10"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setSubmitted(null);
                setOpen(true);
                setHighlight(-1);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              placeholder="Search movies, series, anime, K-drama…"
              autoFocus
              autoComplete="off"
              role="combobox"
              aria-expanded={showSuggestions}
              aria-controls="search-suggestions"
              aria-autocomplete="list"
              aria-activedescendant={
                highlight >= 0 ? `search-suggestion-${highlight}` : undefined
              }
              aria-label="Search query"
            />
            {q && (
              <button
                type="button"
                onClick={clear}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-white/10 hover:text-white"
              >
                {isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
          <Button type="submit" className="h-12 px-6">
            Search
          </Button>
        </form>

        {showSuggestions && (
          <ul
            id="search-suggestions"
            role="listbox"
            className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-white/10 bg-[var(--surface)] shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
          >
            {suggestions.length === 0 ? (
              <li className="px-4 py-3 text-sm text-[var(--text-muted)]">
                {isFetching ? "Searching…" : "No suggestions yet"}
              </li>
            ) : (
              suggestions.map((item, i) => {
                const title = displayTitle(item);
                const thumb = resizeTmdbImage(
                  resolveCardImageUrl(item),
                  "w185",
                );
                return (
                  <li
                    key={item.id}
                    id={`search-suggestion-${i}`}
                    role="option"
                    aria-selected={i === highlight}
                  >
                    <a
                      href={getDetailsHref(item)}
                      onClick={(e) => {
                        e.preventDefault();
                        router.push(getDetailsHref(item));
                      }}
                      onMouseEnter={() => setHighlight(i)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 transition-colors",
                        i === highlight ? "bg-white/10" : "hover:bg-white/5",
                      )}
                    >
                      <span className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-[var(--background-secondary)]">
                        <Image
                          src={thumb || posterFallbackLabel(title)}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                          unoptimized
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-white">
                          {title}
                        </span>
                        <span className="block text-xs text-[var(--text-muted)]">
                          {[item.contentType, item.year]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </a>
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>

      <div
        className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        role="group"
        aria-label="Type filter"
      >
        {TYPE_FILTERS.map((t) => (
          <Chip
            key={t.id || "all"}
            active={type === t.id}
            onClick={() => changeType(t.id)}
            className="shrink-0"
          >
            {t.label}
          </Chip>
        ))}
      </div>

      {enabled && isFetching && !data && (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] skeleton rounded-xl" />
          ))}
        </div>
      )}

      {isError && !data && (
        <EmptyState
          className="mt-10"
          icon={AlertTriangle}
          title="Search is unavailable right now"
          description="We couldn't reach the catalog. Check your connection and try again."
          actions={[{ href: "/discover", label: "Browse Discover", variant: "secondary" }]}
        />
      )}
      {isError && !data && (
        <div className="mt-3 flex justify-center">
          <Button size="sm" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      )}

      {showResults && resultItems.length > 0 && (
        <>
          <p className="mt-8 text-sm text-[var(--text-muted)]" aria-live="polite">
            {resultItems.length} result{resultItems.length === 1 ? "" : "s"}
            {` for “${activeQuery}”`}
          </p>
          <div
            className={cn(
              "mt-4 grid grid-cols-2 gap-3 transition-opacity sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5",
              isFetching && "opacity-60",
            )}
          >
            {resultItems.map((item) => (
              <ContentCard
                key={item.id}
                content={item}
                className="w-full min-w-0"
              />
            ))}
          </div>
        </>
      )}

      {showResults && resultItems.length === 0 && !isFetching && (
        <EmptyState
          className="mt-10"
          icon={SearchIcon}
          title={`No results for “${activeQuery}”`}
          description="Try a shorter title, switch type filters, or browse Discover."
          actions={[
            { href: "/discover", label: "Discover" },
            { href: "/movies", label: "Movies", variant: "secondary" },
          ]}
        />
      )}

      {!enabled && (
        <EmptyState
          className="mt-10"
          icon={SearchIcon}
          title={
            q.trim().length === 1
              ? "Keep typing…"
              : "Start typing to search"
          }
          description="Find movies, series, anime, and dramas across the full catalog."
          actions={[
            {
              href: "/discover",
              label: "Browse Discover",
              variant: "secondary",
            },
          ]}
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

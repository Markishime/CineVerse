"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, LayoutGrid, LayoutList, Play, Search } from "lucide-react";
import { apiFetch, buildQuery } from "@/lib/api/client";
import type { SeasonEpisode } from "@/lib/embed/similar";
import { cn } from "@/lib/utils";

interface EpisodeBrowserProps {
  tmdbId: number;
  season: number;
  episode: number;
  seasons: Array<{ season_number: number; name: string; episode_count: number }>;
  className?: string;
}

/** Season picker, episode search and list/grid view with thumbnails and summaries. */
export function EpisodeBrowser({
  tmdbId,
  season,
  episode,
  seasons,
  className,
}: EpisodeBrowserProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [grid, setGrid] = useState(false);

  const playable = seasons.filter((s) => s.season_number > 0);

  const { data, isLoading } = useQuery({
    queryKey: ["tv-season", tmdbId, season],
    queryFn: () =>
      apiFetch<{ episodes: SeasonEpisode[] }>(
        `/tv-season${buildQuery({ tmdbId, season })}`,
        { auth: false },
      ),
    staleTime: 10 * 60_000,
  });

  const episodes = useMemo(() => {
    const list = data?.episodes ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.overview.toLowerCase().includes(q) ||
        String(e.episodeNumber) === q,
    );
  }, [data?.episodes, query]);

  if (playable.length === 0) return null;

  return (
    <section
      id="episodes"
      aria-labelledby="episodes-heading"
      className={cn("scroll-mt-24", className)}
    >
      <h2
        id="episodes-heading"
        className="mb-4 flex items-center gap-3 font-display text-xl font-bold text-white sm:text-2xl"
      >
        <span
          className="h-7 w-1 rounded-full bg-[var(--primary)] shadow-[var(--glow-primary)]"
          aria-hidden
        />
        Episodes
      </h2>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <select
            aria-label="Season"
            value={season}
            onChange={(e) =>
              router.push(`/watch/tv/${tmdbId}/${Number(e.target.value)}/1`)
            }
            className="h-10 appearance-none rounded-xl border border-white/10 bg-[var(--surface)] pl-3 pr-9 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            {playable.map((s) => (
              <option key={s.season_number} value={s.season_number}>
                {s.name || `Season ${s.season_number}`}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
            aria-hidden
          />
        </div>

        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search episodes…"
            aria-label="Search episodes"
            className="h-10 w-full rounded-xl border border-white/10 bg-[var(--surface)] pl-9 pr-3 text-sm text-white placeholder:text-[var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          />
        </div>

        <button
          type="button"
          onClick={() => setGrid((v) => !v)}
          aria-label={grid ? "Show as list" : "Show as grid"}
          aria-pressed={grid}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-[var(--surface)] text-[var(--text-secondary)] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        >
          {grid ? (
            <LayoutList className="h-4 w-4" aria-hidden />
          ) : (
            <LayoutGrid className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 skeleton rounded-xl" />
          ))}
        </div>
      ) : episodes.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-[var(--surface)] p-4 text-sm text-[var(--text-muted)]">
          {query ? "No episodes match your search." : "No episode data yet."}
        </p>
      ) : (
        <ul
          className={cn(
            "scroll-contain max-h-[34rem] gap-3 overflow-y-auto pr-1",
            grid ? "grid grid-cols-1 sm:grid-cols-2" : "flex flex-col",
          )}
          data-lenis-prevent
          data-lenis-prevent-wheel
          data-lenis-prevent-touch
        >
          {episodes.map((ep) => {
            const current = ep.episodeNumber === episode;
            return (
              <li key={ep.episodeNumber}>
                <Link
                  href={`/watch/tv/${tmdbId}/${season}/${ep.episodeNumber}`}
                  aria-current={current ? "true" : undefined}
                  className={cn(
                    "group flex gap-3 rounded-xl border p-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                    current
                      ? "border-[var(--primary)]/50 bg-[var(--primary)]/10"
                      : "border-white/10 bg-[var(--surface)] hover:border-white/20 hover:bg-[var(--surface-elevated)]",
                  )}
                >
                  <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-elevated)] sm:w-32">
                    {ep.still && (
                      <Image
                        src={ep.still}
                        alt=""
                        fill
                        sizes="128px"
                        className="object-cover"
                        unoptimized
                      />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                      <Play className="h-5 w-5 fill-white text-white" aria-hidden />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="c-primary truncate text-sm font-semibold">
                      {ep.episodeNumber}. {ep.name}
                      {current && (
                        <span className="c-accent ml-2 text-[10px] font-bold uppercase tracking-wider">
                          Now playing
                        </span>
                      )}
                    </p>
                    {ep.runtime ? (
                      <p className="c-muted mt-0.5 text-xs">{ep.runtime} min</p>
                    ) : null}
                    {ep.overview && (
                      <p className="c-secondary mt-1 line-clamp-2 text-xs leading-relaxed">
                        {ep.overview}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

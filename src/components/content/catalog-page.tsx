"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Calendar,
  Clock,
  LayoutGrid,
  LayoutList,
  Play,
  Star,
  TrendingUp,
} from "lucide-react";
// Play used for Watch Now filter on Movies
import type { Content, ContentType } from "@/types/content";
import {
  fetchAnime,
  fetchKdrama,
  fetchMovies,
  fetchSeries,
} from "@/lib/api/content";
import { ContentCard } from "./content-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/motion/reveal";
import { displayTitle, primaryScore } from "@/lib/content/normalize";
import { cn, formatRuntime, formatScore } from "@/lib/utils";
import {
  getDetailsHref,
  getTrailerHref,
  getWatchHref,
  hasOfficialTrailer,
  watchCtaLabel,
} from "@/lib/content/watch-href";
import { easeOutExpo } from "@/lib/motion";
import { useAuthStore } from "@/stores/auth-store";
import { APP_REGION } from "@/lib/user/region";

export type CatalogSort =
  | "popularity"
  | "rating"
  | "newest"
  | "oldest"
  | "title_asc"
  | "title_desc"
  | "runtime";

const SORT_OPTIONS: Array<{
  id: CatalogSort;
  label: string;
  icon: typeof TrendingUp;
}> = [
  { id: "popularity", label: "Popularity", icon: TrendingUp },
  { id: "rating", label: "Top rated", icon: Star },
  { id: "newest", label: "Newest", icon: Calendar },
  { id: "oldest", label: "Oldest", icon: Calendar },
  { id: "title_asc", label: "Title A–Z", icon: ArrowDownAZ },
  { id: "title_desc", label: "Title Z–A", icon: ArrowUpAZ },
  { id: "runtime", label: "Longest", icon: Clock },
];

const meta: Record<
  ContentType,
  { title: string; subtitle: string; theme: string; className: string }
> = {
  movie: {
    title: "Movies",
    subtitle: "Stream instantly with Watch Now",
    theme: "movies",
    className: "projector-light",
  },
  series: {
    title: "Series",
    subtitle: "Stream instantly with Watch Now",
    theme: "series",
    className: "",
  },
  anime: {
    title: "Anime",
    subtitle: "Stream instantly with Watch Now",
    theme: "anime",
    className: "neon-edge rounded-2xl",
  },
  kdrama: {
    title: "K-Drama",
    subtitle: "Stream instantly with Watch Now",
    theme: "kdrama",
    className: "rain-glass",
  },
};

async function load(
  type: ContentType,
  page: number,
  sort: CatalogSort,
  mature: boolean,
  watchNowOnly: boolean,
  region: string,
) {
  const params = {
    page,
    pageSize: 60,
    sort,
    mature,
    playable: watchNowOnly || undefined,
    region,
  };
  switch (type) {
    case "movie":
      return fetchMovies(params);
    case "series":
      return fetchSeries(params);
    case "anime":
      return fetchAnime(params);
    case "kdrama":
      return fetchKdrama(params);
  }
}

export function CatalogPage({ type }: { type: ContentType }) {
  const m = meta[type];
  const user = useAuthStore((s) => s.user);
  const settings = useAuthStore((s) => s.settings);
  const settingsMature = Boolean(settings?.matureContent);
  // Also honor device flag so 18+ works even if server settings reset
  const [deviceMature, setDeviceMature] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const flag = window.localStorage.getItem("cineverse_mature_flag") === "1";
        if (flag) {
          setDeviceMature(true);
        } else if (user?.uid) {
          const raw = window.localStorage.getItem(
            `cineverse_settings_${user.uid}`,
          );
          if (raw) {
            const s = JSON.parse(raw) as { matureContent?: boolean };
            setDeviceMature(Boolean(s.matureContent));
          }
        }
      } catch {
        setDeviceMature(false);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [user?.uid, settingsMature]);

  const mature = settingsMature || deviceMature;
  const region = APP_REGION;
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<CatalogSort>("popularity");
  const [view, setView] = useState<"grid" | "list">("grid");
  /** Default all popular/trending; free full via Watch Now toggle */
  const [watchNowOnly, setWatchNowOnly] = useState(false);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["catalog", type, page, sort, mature, watchNowOnly, region],
    queryFn: () => load(type, page, sort, mature, watchNowOnly, region),
    staleTime: 20_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const sortLabel = useMemo(
    () => SORT_OPTIONS.find((s) => s.id === sort)?.label ?? sort,
    [sort],
  );

  return (
    <div data-theme={m.theme} className="min-h-dvh pt-24">
      <div className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <Reveal
          inView={false}
          className={cn(
            "mb-6 space-y-2 rounded-2xl p-6 surface-card",
            m.className,
          )}
        >
          <header>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary-light)]">
            CineVerse catalog · live
          </p>
          <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
            {m.title}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
            {m.subtitle}
            {data?.total != null ? ` · ${data.total} titles` : ""}
            {` · sorted by ${sortLabel}`}
            {" · United States"}
            {mature ? " · 18+ mature on" : ""}
            {isFetching ? " · live refresh…" : ""}
          </p>
          {mature && (
            <Badge tone="accent" className="mt-2">
              18+ mature content enabled
            </Badge>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setWatchNowOnly(true);
                setPage(1);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition",
                watchNowOnly
                  ? "watch-now-cta bg-[var(--gold)] !text-black shadow-lg"
                  : "bg-white/10 text-[var(--text-secondary)] hover:bg-white/15",
              )}
            >
              <Play className="h-4 w-4 fill-current" />
              Watch Now
            </button>
            <button
              type="button"
              onClick={() => {
                setWatchNowOnly(false);
                setPage(1);
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition",
                !watchNowOnly
                  ? "bg-[var(--primary)] text-white"
                  : "bg-white/10 text-[var(--text-secondary)] hover:bg-white/15",
              )}
            >
              All {m.title.toLowerCase()}
            </button>
          </div>
          </header>
        </Reveal>

        {/* Toolbar: sort + view */}
        <Reveal delay={0.05} inView={false} className="mb-6 flex flex-col gap-3 rounded-2xl surface-card p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Sort
            </span>
            {SORT_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = sort === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setSort(opt.id);
                    setPage(1);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
                    active
                      ? "bg-[var(--primary)] text-white shadow-[var(--glow-primary)]"
                      : "bg-white/5 text-[var(--text-secondary)] hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1 rounded-xl bg-black/30 p-1">
            <button
              type="button"
              aria-label="Grid view"
              onClick={() => setView("grid")}
              className={cn(
                "rounded-lg p-2 transition",
                view === "grid"
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--text-muted)] hover:text-white",
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="List view"
              onClick={() => setView("list")}
              className={cn(
                "rounded-lg p-2 transition",
                view === "list"
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--text-muted)] hover:text-white",
              )}
            >
              <LayoutList className="h-4 w-4" />
            </button>
          </div>
        </Reveal>

        {isLoading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] skeleton rounded-xl" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-[var(--danger)]">Failed to load catalog.</p>
        )}

        {data && view === "grid" && (
          <motion.div
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.035, delayChildren: 0.04 },
              },
            }}
          >
            {data.items.map((item, i) => (
              <motion.div
                key={`${item.id}-${i}`}
                variants={{
                  hidden: { opacity: 0, y: 14 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.35, ease: easeOutExpo },
                  },
                }}
              >
                <ContentCard
                  content={item}
                  className="w-full min-w-0"
                  rank={
                    sort === "popularity" && page === 1 ? i + 1 : undefined
                  }
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {data && view === "list" && (
          <ul className="space-y-3">
            {data.items.map((item, i) => (
              <CatalogListRow
                key={`${item.id}-list-${i}`}
                item={item}
                rank={(page - 1) * 60 + i + 1}
                type={type}
              />
            ))}
          </ul>
        )}

        {data && data.items.length > 0 && (
          <div className="mt-10 flex items-center justify-center gap-3">
            <Button
              variant="secondary"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-[var(--text-secondary)]">
              Page {data.page} / {data.totalPages}
              {isFetching ? " · loading…" : ""}
            </span>
            <Button
              variant="secondary"
              disabled={page >= data.totalPages || isFetching}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}

        {data && data.items.length === 0 && (
          <p className="text-[var(--text-muted)]">
            No titles in this collection yet.
          </p>
        )}
      </div>
    </div>
  );
}

function CatalogListRow({
  item,
  rank,
  type,
}: {
  item: Content;
  rank: number;
  type: ContentType;
}) {
  const title = displayTitle(item);
  const score = primaryScore(item);
  const poster = item.poster?.url;
  const genres = item.genres
    .slice(0, 4)
    .map((g) => g.name)
    .join(" · ");

  const watchHref = getWatchHref(item);
  const trailerHref = getTrailerHref(item);
  const detailsHref = getDetailsHref(item);
  const cta = watchCtaLabel(item);
  const showTrailer = hasOfficialTrailer(item);

  return (
    <li className="surface-card overflow-hidden transition hover:ring-1 hover:ring-[var(--primary)]/40">
      <div className="flex gap-3 p-3 sm:gap-4 sm:p-4">
        <Link
          href={watchHref}
          className="relative h-[120px] w-[80px] shrink-0 overflow-hidden rounded-lg bg-[var(--surface-elevated)] sm:h-[140px] sm:w-[94px]"
        >
          {poster ? (
            <Image
              src={poster}
              alt={title}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="poster-fallback absolute inset-0 text-[10px]">
              {title}
            </div>
          )}
          <span className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-[var(--gold)]">
            #{rank}
          </span>
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <Link href={detailsHref}>
                <h2 className="font-display text-base font-semibold text-white hover:text-[var(--primary-light)] sm:text-lg">
                  {title}
                </h2>
              </Link>
              {(item.romajiTitle || item.nativeTitle || item.originalTitle) && (
                <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-muted)] sm:text-sm">
                  {[item.originalTitle, item.romajiTitle, item.nativeTitle]
                    .filter(Boolean)
                    .filter((t, i, a) => a.indexOf(t) === i && t !== title)
                    .join(" · ")}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Link href={watchHref} className="watch-now-cta">
                <Badge
                  tone="gold"
                  className="gap-1 !bg-[var(--gold)] !text-black"
                >
                  <Play className="h-3 w-3 fill-current !text-black" />
                  Watch Now
                </Badge>
              </Link>
              <Badge
                tone={
                  type === "movie"
                    ? "primary"
                    : type === "series"
                      ? "cyan"
                      : type === "anime"
                        ? "accent"
                        : "gold"
                }
              >
                {item.contentType}
              </Badge>
              {item.animeFormat && (
                <Badge tone="muted">{item.animeFormat}</Badge>
              )}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)] sm:text-sm">
            {item.year != null && <span>{item.year}</span>}
            {score != null && (
              <span className="inline-flex items-center gap-1 text-[var(--gold)]">
                <Star className="h-3.5 w-3.5 fill-current" />
                {formatScore(score)}
              </span>
            )}
            {item.runtime != null && item.runtime > 0 && (
              <span>{formatRuntime(item.runtime)}</span>
            )}
            {item.episodeCount != null && (
              <span>{item.episodeCount} eps</span>
            )}
            {item.seasonCount != null && item.seasonCount > 0 && (
              <span>
                {item.seasonCount} season{item.seasonCount > 1 ? "s" : ""}
              </span>
            )}
            {item.status && item.status !== "unknown" && (
              <span className="capitalize">
                {item.status.replace(/_/g, " ")}
              </span>
            )}
            {item.language && (
              <span className="uppercase">{item.language}</span>
            )}
            {item.countries?.length > 0 && (
              <span>{item.countries.join(", ")}</span>
            )}
          </div>

          {genres && (
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">{genres}</p>
          )}

          {item.overview && (
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              {item.overview}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={watchHref} className="watch-now-cta">
              <Button size="sm" variant="gold" className="watch-now-cta !text-black">
                <Play className="h-3.5 w-3.5 !text-black" />
                Watch Now
              </Button>
            </Link>
            {showTrailer && (
              <Link href={trailerHref}>
                <Button size="sm" variant="secondary">
                  <Play className="h-3.5 w-3.5" />
                  Watch Trailer
                </Button>
              </Link>
            )}
            <Link href={detailsHref}>
              <Button size="sm" variant="secondary">
                Full details
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}

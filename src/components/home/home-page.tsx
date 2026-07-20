"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchHome } from "@/lib/api/content";
import { ContentRow } from "@/components/content/content-row";
import { ContinueWatchingRow } from "@/components/content/continue-watching-row";
import { HeroCarousel } from "./hero-carousel";
import { Reveal } from "@/components/motion/reveal";
import { usePerformanceStore } from "@/stores/performance-store";
import { useAuthStore } from "@/stores/auth-store";
import { Badge } from "@/components/ui/badge";
import { APP_REGION } from "@/lib/user/region";

const HeroOrbits = dynamic(
  () => import("./hero-orbits").then((m) => m.HeroOrbits),
  { ssr: false, loading: () => null },
);

export function HomePage() {
  const effective = usePerformanceStore((s) => s.effective);
  const user = useAuthStore((s) => s.user);
  const settings = useAuthStore((s) => s.settings);
  const settingsMature = Boolean(settings?.matureContent);
  const [deviceMature, setDeviceMature] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        if (window.localStorage.getItem("cineverse_mature_flag") === "1") {
          setDeviceMature(true);
        } else if (user?.uid) {
          const raw = window.localStorage.getItem(
            `cineverse_settings_${user.uid}`,
          );
          if (raw) {
            const s = JSON.parse(raw) as {
              matureContent?: boolean;
            };
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

  const { data, isLoading, isError, dataUpdatedAt, refetch } = useQuery({
    queryKey: ["home", mature, region],
    queryFn: () => fetchHome(region, mature),
    staleTime: 15_000,
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchIntervalInBackground: false,
  });

  // Align client poll with server 90s featured rotation window
  useEffect(() => {
    const id = window.setInterval(() => {
      void refetch();
    }, 90_000);
    return () => window.clearInterval(id);
  }, [refetch, region]);

  if (isLoading) {
    return (
      <div className="space-y-8 px-4 pt-24 sm:px-6">
        <div className="h-[70dvh] skeleton rounded-2xl" />
        <div className="h-48 skeleton rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-32 text-center">
        <h1 className="font-display text-2xl font-semibold text-white">
          Couldn&apos;t load the cosmos
        </h1>
        <p className="mt-2 text-[var(--text-secondary)]">
          The catalog API is temporarily unavailable. Try again shortly.
        </p>
      </div>
    );
  }

  // Featured hero = popular & trending today only (movies · series · anime · kdrama)
  const carouselItems = (
    data.featuredCarousel?.length
      ? data.featuredCarousel
      : [data.featured, ...data.trending].filter(Boolean)
  )
    .filter(Boolean)
    .slice(0, 12) as NonNullable<typeof data.featured>[];

  const featuredStamp =
    data.featuredUpdatedAt ??
    (dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : "0");

  return (
    <div className="overflow-x-hidden bg-[var(--background)]">
      <div className="relative">
        {effective === "cinematic" && (
          <div className="pointer-events-none absolute inset-0 z-[1] opacity-35">
            <HeroOrbits />
          </div>
        )}
        <div className="relative z-10">
          <HeroCarousel
            key={`hero-${featuredStamp}-${carouselItems.map((c) => c?.id).join(",")}`}
            items={carouselItems}
            liveLabel="Popular & trending today"
          />
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl space-y-14 px-4 pb-24 pt-10 sm:px-6">
        <ContinueWatchingRow />

        <ContentRow
          title="Trending today"
          subtitle="Movies · series · anime · K-drama"
          items={data.trending}
          showRank
        />

        <ContentRow
          title="Popular movies today"
          subtitle="Trending & popular right now"
          items={data.popularMovies}
          wide
        />
        <ContentRow
          title="Popular series today"
          subtitle="Top TV this moment"
          items={data.popularSeries}
        />
        <ContentRow
          title="Popular anime today"
          subtitle="Trending Japanese animation"
          items={data.airingAnime}
        />
        <ContentRow
          title="Popular K-dramas today"
          subtitle="Top Korean series"
          items={data.trendingKdramas}
        />
        {mature && (data.matureMovies?.length || data.matureSeries?.length || data.matureAnime?.length) ? (
          <>
            {(data.matureMovies?.length ?? 0) > 0 && (
              <ContentRow
                title="18+ Movies"
                items={data.matureMovies!}
              />
            )}
            {(data.matureSeries?.length ?? 0) > 0 && (
              <ContentRow
                title="18+ Series"
                items={data.matureSeries!}
              />
            )}
            {(data.matureAnime?.length ?? 0) > 0 && (
              <ContentRow
                title="18+ Anime"
                items={data.matureAnime!}
              />
            )}
          </>
        ) : null}

        <Reveal className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-white sm:text-2xl">
            Explore by mood
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.moods.map((m) => (
              <Link key={m.id} href={`/discover?mood=${m.id}`}>
                <Badge tone="primary" className="px-3 py-1.5 text-sm">
                  {m.emoji} {m.label}
                </Badge>
              </Link>
            ))}
          </div>
        </Reveal>

        <Reveal className="space-y-4 pb-8">
          <h2 className="font-display text-xl font-semibold text-white sm:text-2xl">
            Explore by genre
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.genres.map((g) => (
              <Link
                key={g.id}
                href={`/discover?genre=${encodeURIComponent(g.name)}`}
              >
                <Badge
                  tone="muted"
                  className="px-3 py-1.5 text-sm hover:bg-white/10"
                >
                  {g.name}
                </Badge>
              </Link>
            ))}
          </div>
        </Reveal>
      </div>
    </div>
  );
}

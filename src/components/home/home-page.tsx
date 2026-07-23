"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { fetchHome } from "@/lib/api/content";
import { ContentRow } from "@/components/content/content-row";
import { ContinueWatchingRow } from "@/components/content/continue-watching-row";
import { HeroCarousel } from "./hero-carousel";
import { Reveal, RevealItem, RevealStagger } from "@/components/motion/reveal";
import { usePerformanceStore } from "@/stores/performance-store";
import { useAuthStore } from "@/stores/auth-store";
import { Badge } from "@/components/ui/badge";
import { APP_REGION } from "@/lib/user/region";
import { landingSection } from "@/lib/motion";
import { filterPublicCatalog } from "@/lib/content/mature";

const HeroOrbits = dynamic(
  () => import("./hero-orbits").then((m) => m.HeroOrbits),
  { ssr: false, loading: () => null },
);

export function HomePage() {
  const effective = usePerformanceStore((s) => s.effective);
  const reduce = useReducedMotion();
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

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["home", mature, region],
    queryFn: () => fetchHome(region, mature),
    staleTime: 15_000,
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchIntervalInBackground: false,
  });

  const carouselItems = useMemo(() => {
    if (!data) return [];
    const raw = (
      data.featuredCarousel?.length
        ? data.featuredCarousel
        : [data.featured, ...data.trending].filter(Boolean)
    ).filter(Boolean) as NonNullable<typeof data.featured>[];
    // Belt-and-suspenders: hero never shows 18+ even if API regresses.
    return filterPublicCatalog(raw).slice(0, 12);
  }, [data]);

  if (isLoading) {
    return (
      <div className="overflow-x-hidden bg-[var(--background)]">
        <div className="relative min-h-[100dvh] w-full">
          <div className="absolute inset-0 skeleton opacity-40" />
          <div className="relative z-10 mx-auto flex h-[100dvh] max-w-7xl items-end px-4 pb-28 sm:items-center sm:px-6">
            <div className="w-full max-w-xl space-y-4">
              <div className="h-4 w-40 skeleton rounded-full" />
              <div className="h-12 w-full skeleton rounded-xl" />
              <div className="h-12 w-4/5 skeleton rounded-xl" />
              <div className="h-20 w-full skeleton rounded-xl" />
              <div className="flex gap-3 pt-2">
                <div className="h-11 w-32 skeleton rounded-full" />
                <div className="h-11 w-32 skeleton rounded-full" />
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl space-y-10 px-4 py-12 sm:px-6">
          <div className="h-48 skeleton rounded-xl" />
          <div className="h-48 skeleton rounded-xl" />
        </div>
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
          Something went wrong. Try again shortly.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="mt-6 rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-white transition-transform hover:scale-105 active:scale-95"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-x-hidden bg-[var(--background)]">
      <div className="relative">
        {effective === "cinematic" && (
          <div className="pointer-events-none absolute inset-0 z-[1] opacity-35">
            <HeroOrbits />
          </div>
        )}
        <div className="hero-vignette relative z-10">
          <HeroCarousel
            items={carouselItems}
            liveLabel="Popular & trending today"
          />
        </div>
      </div>

      {/* Cinematic fade from hero into catalog */}
      <div
        className="hero-cinematic-fade pointer-events-none relative z-[5] -mt-[7.5rem]"
        aria-hidden
      />

      <motion.div
        id="home-catalog"
        className="landing-row-enter relative z-10 mx-auto max-w-7xl space-y-12 px-4 pb-28 pt-2 sm:space-y-14 sm:px-6 will-change-transform"
        initial={reduce ? false : "hidden"}
        whileInView={reduce ? undefined : "visible"}
        viewport={{ once: true, amount: 0.02, margin: "0px 0px -40px 0px" }}
        variants={reduce ? undefined : landingSection}
        style={{ backfaceVisibility: "hidden" }}
      >
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
        <ContentRow
          title="Popular Korean movies today"
          subtitle="Top Korean cinema"
          items={data.koreanMovies}
          wide
        />
        {(data.koreanSeries?.length ?? 0) > 0 && (
          <ContentRow
            title="Popular Korean series today"
            subtitle="Korean TV beyond K-drama"
            items={data.koreanSeries}
          />
        )}
        {(data.japaneseMovies?.length ?? 0) > 0 && (
          <ContentRow
            title="Popular Japanese movies today"
            subtitle="Top Japanese cinema"
            items={data.japaneseMovies}
            wide
          />
        )}
        {(data.japaneseSeries?.length ?? 0) > 0 && (
          <ContentRow
            title="Popular Japanese series today"
            subtitle="Japanese TV beyond J-drama"
            items={data.japaneseSeries}
          />
        )}
        {(data.chineseMovies?.length ?? 0) > 0 && (
          <ContentRow
            title="Popular Chinese movies today"
            subtitle="Top Chinese cinema"
            items={data.chineseMovies}
            wide
          />
        )}
        {(data.chineseSeries?.length ?? 0) > 0 && (
          <ContentRow
            title="Popular Chinese series today"
            subtitle="Chinese TV beyond C-drama"
            items={data.chineseSeries}
          />
        )}
        {(data.thaiMovies?.length ?? 0) > 0 && (
          <ContentRow
            title="Popular Thai movies today"
            subtitle="Top Thai cinema"
            items={data.thaiMovies}
          />
        )}
        {(data.thaiSeries?.length ?? 0) > 0 && (
          <ContentRow
            title="Popular Thai series today"
            subtitle="Thai TV beyond drama"
            items={data.thaiSeries}
          />
        )}
        {(data.filipinoMovies?.length ?? 0) > 0 && (
          <ContentRow
            title="Popular Filipino movies today"
            subtitle="Top Filipino cinema"
            items={data.filipinoMovies}
          />
        )}
        {(data.filipinoSeries?.length ?? 0) > 0 && (
          <ContentRow
            title="Popular Filipino series today"
            subtitle="Top Filipino TV"
            items={data.filipinoSeries}
          />
        )}
        <div className="cinematic-glow relative">
          <ContentRow
            title="Popular J-dramas today"
            subtitle="Top Japanese series"
            items={data.trendingJdramas}
          />
          <ContentRow
            title="Popular C-dramas today"
            subtitle="Top Chinese series"
            items={data.trendingCdramas}
          />
          <ContentRow
            title="Popular Thai dramas today"
            subtitle="Top Thai series"
            items={data.trendingThaidramas}
          />
        </div>
        {/* 18+ titles never appear on home (popular/trending). Open the 18+ tab. */}

        <div className="cinematic-divider" />
        <Reveal className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-white sm:text-2xl">
            Explore by mood
          </h2>
          <RevealStagger className="flex flex-wrap gap-2">
            {data.moods.map((m) => (
              <RevealItem key={m.id}>
                <Link
                  href={`/discover?mood=${m.id}`}
                  className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  <Badge
                    tone="primary"
                    className="px-3 py-1.5 text-sm transition-colors duration-150 hover:brightness-110"
                  >
                    {m.emoji} {m.label}
                  </Badge>
                </Link>
              </RevealItem>
            ))}
          </RevealStagger>
        </Reveal>

        <Reveal className="space-y-4 pb-8">
          <h2 className="font-display text-xl font-semibold text-white sm:text-2xl">
            Explore by genre
          </h2>
          <RevealStagger className="flex flex-wrap gap-2">
            {data.genres.map((g) => (
              <RevealItem key={g.id}>
                <Link
                  href={`/discover?genre=${encodeURIComponent(g.name)}`}
                  className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                >
                  <Badge
                    tone="muted"
                    className="px-3 py-1.5 text-sm transition-colors duration-150 hover:bg-white/12"
                  >
                    {g.name}
                  </Badge>
                </Link>
              </RevealItem>
            ))}
          </RevealStagger>
        </Reveal>
      </motion.div>
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { fetchHome } from "@/lib/api/content";
import { seedHomePayload } from "@/lib/api/home-fallback";
import { ContentRow } from "@/components/content/content-row";
import { ContinueWatchingRow } from "@/components/content/continue-watching-row";
import { HeroCarousel } from "./hero-carousel";
import { Reveal, RevealItem, RevealStagger } from "@/components/motion/reveal";
import { usePerformanceStore } from "@/stores/performance-store";
import { useAuthStore } from "@/stores/auth-store";
import { Badge } from "@/components/ui/badge";
import { getDeviceRegion } from "@/lib/user/region";
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
  const region = getDeviceRegion("*");

  // Instant seed so the homepage NEVER sits on a full-screen skeleton while
  // /api/v1/home hangs on Cloud Functions cold starts or provider outages.
  const fallback = useMemo(() => seedHomePayload(), []);

  const { data, isError, refetch, isFetching } = useQuery({
    queryKey: ["home", mature, region],
    queryFn: () => fetchHome(region, mature),
    staleTime: 15_000,
    // Seed is already on screen — one soft retry is enough.
    retry: 1,
    retryDelay: 600,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchIntervalInBackground: false,
    placeholderData: fallback,
  });

  // Always have something to render (live or seed).
  const home = data ?? fallback;

  const carouselItems = useMemo(() => {
    const raw = (
      home.featuredCarousel?.length
        ? home.featuredCarousel
        : [home.featured, ...home.trending].filter(Boolean)
    ).filter(Boolean) as NonNullable<typeof home.featured>[];
    return filterPublicCatalog(raw).slice(0, 12);
  }, [home]);

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
        {isError && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--gold)]/25 bg-[var(--gold)]/10 px-4 py-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Live catalog is slow right now — showing offline picks.{" "}
              {isFetching ? "Refreshing…" : null}
            </p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white hover:bg-white/15"
            >
              Retry live
            </button>
          </div>
        )}

        <ContinueWatchingRow />

        <ContentRow
          title="Trending today"
          subtitle="Movies · series · anime · K-drama"
          items={home.trending}
          showRank
        />

        <ContentRow
          title="Popular movies today"
          subtitle="Trending & popular right now"
          items={home.popularMovies}
          wide
        />
        <ContentRow
          title="Popular series today"
          subtitle="Top TV this moment"
          items={home.popularSeries}
        />
        <ContentRow
          title="Popular anime today"
          subtitle="Trending Japanese animation"
          items={home.airingAnime}
        />
        <ContentRow
          title="Popular K-dramas today"
          subtitle="Top Korean series"
          items={home.trendingKdramas}
        />
        <ContentRow
          title="Popular Korean movies today"
          subtitle="Top Korean cinema"
          items={home.koreanMovies}
          wide
        />
        {(home.koreanSeries?.length ?? 0) > 0 && (
          <ContentRow
            title="Popular Korean series today"
            subtitle="Korean TV beyond K-drama"
            items={home.koreanSeries}
          />
        )}
        {(home.japaneseMovies?.length ?? 0) > 0 && (
          <ContentRow
            title="Popular Japanese movies today"
            subtitle="Top Japanese cinema"
            items={home.japaneseMovies}
            wide
          />
        )}
        {(home.japaneseSeries?.length ?? 0) > 0 && (
          <ContentRow
            title="Popular Japanese series today"
            subtitle="Japanese TV beyond J-drama"
            items={home.japaneseSeries}
          />
        )}
        {(home.chineseMovies?.length ?? 0) > 0 && (
          <ContentRow
            title="Popular Chinese movies today"
            subtitle="Top Chinese cinema"
            items={home.chineseMovies}
            wide
          />
        )}
        {(home.chineseSeries?.length ?? 0) > 0 && (
          <ContentRow
            title="Popular Chinese series today"
            subtitle="Chinese TV beyond C-drama"
            items={home.chineseSeries}
          />
        )}
        {(home.thaiMovies?.length ?? 0) > 0 && (
          <ContentRow
            title="Popular Thai movies today"
            subtitle="Top Thai cinema"
            items={home.thaiMovies}
          />
        )}
        {(home.thaiSeries?.length ?? 0) > 0 && (
          <ContentRow
            title="Popular Thai series today"
            subtitle="Thai TV beyond drama"
            items={home.thaiSeries}
          />
        )}
        {(home.filipinoMovies?.length ?? 0) > 0 && (
          <ContentRow
            title="Popular Filipino movies today"
            subtitle="Top Filipino cinema"
            items={home.filipinoMovies}
          />
        )}
        {(home.filipinoSeries?.length ?? 0) > 0 && (
          <ContentRow
            title="Popular Filipino series today"
            subtitle="Top Filipino TV"
            items={home.filipinoSeries}
          />
        )}
        <div className="cinematic-glow relative">
          <ContentRow
            title="Popular J-dramas today"
            subtitle="Top Japanese series"
            items={home.trendingJdramas}
          />
          <ContentRow
            title="Popular C-dramas today"
            subtitle="Top Chinese series"
            items={home.trendingCdramas}
          />
          <ContentRow
            title="Popular Thai dramas today"
            subtitle="Top Thai series"
            items={home.trendingThaidramas}
          />
        </div>
        {/* 18+ titles never appear on home (popular/trending). Open the 18+ tab. */}

        <div className="cinematic-divider" />
        <Reveal className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-white sm:text-2xl">
            Explore by mood
          </h2>
          <RevealStagger className="flex flex-wrap gap-2">
            {home.moods.map((m) => (
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
            {home.genres.map((g) => (
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

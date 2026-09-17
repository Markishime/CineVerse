"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo } from "react";
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
import { isRestrictedContentUser } from "@/lib/content/mature";
import { isAnimeLikeContent } from "@/lib/content/classification";

const HeroOrbits = dynamic(
  () => import("./hero-orbits").then((m) => m.HeroOrbits),
  { ssr: false, loading: () => null },
);

export function HomePage() {
  const effective = usePerformanceStore((s) => s.effective);
  const reduce = useReducedMotion();
  const user = useAuthStore((s) => s.user);

  const mature = isRestrictedContentUser(user?.email);
  const region = getDeviceRegion("*");

  // Instant seed so the homepage NEVER sits on a full-screen skeleton while
  // /api/v1/home hangs on Cloud Functions cold starts or provider outages.
  const fallback = useMemo(() => seedHomePayload(), []);

  const { data, isError, refetch, isFetching } = useQuery({
    queryKey: ["home", mature, region],
    queryFn: () => fetchHome(region, mature),
    staleTime: 60_000,
    // Seed is already on screen — one soft retry is enough.
    retry: 1,
    retryDelay: 600,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchIntervalInBackground: false,
    placeholderData: fallback,
  });

  // Always have something to render (live or seed).
  const home = data ?? fallback;

  const carouselItems = useMemo(() => {
    // Hero "Popular & trending today" — never anime / animation
    const raw = (
      home.featuredCarousel?.length
        ? home.featuredCarousel
        : [home.featured, ...home.trending].filter(Boolean)
    ).filter(Boolean) as NonNullable<typeof home.featured>[];
    return filterPublicCatalog(raw)
      .filter((c) => !isAnimeLikeContent(c))
      .slice(0, 12);
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
            liveLabel={home.catalogStatus === "live" ? "Popular & trending today" : "Discover your next watch"}
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
        className="landing-row-enter relative z-10 mx-auto max-w-7xl space-y-12 px-4 pb-28 pt-2 sm:space-y-14 sm:px-6"
        initial={false}
        whileInView={reduce ? undefined : "visible"}
        viewport={{ once: true, amount: 0.02, margin: "0px 0px -40px 0px" }}
        variants={reduce ? undefined : landingSection}
        style={{ backfaceVisibility: "hidden" }}
      >
        {(isError || home.catalogStatus === "fallback") && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--gold)]/25 bg-[var(--gold)]/10 px-4 py-3">
            <p className="text-sm text-[var(--text-secondary)]">
              Showing saved picks. Live availability may be limited.{" "}
              {isFetching ? "Refreshing…" : null}
            </p>
            <button
              type="button"
              disabled={isFetching}
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
          subtitle="Movies · series · anime · dramas"
          items={home.trending}
          showRank
        />

        <nav aria-label="Browse catalogs" className="flex flex-wrap gap-2">
          {[["Movies", "/movies"], ["Series", "/series"], ["Anime", "/anime"], ["K-dramas", "/kdrama"], ["J-dramas", "/jdrama"], ["C-dramas", "/cdrama"], ["Thai dramas", "/thaidrama"]].map(([label, href]) => (
            <Link key={href} href={href} className="rounded-full border border-white/15 px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[var(--primary)]">{label}</Link>
          ))}
        </nav>
        <ContentRow title="Latest movies" subtitle="Newest released films in the catalog" items={home.latestMovies ?? []} wide />
        <ContentRow title="Latest series" subtitle="Recently premiered series" items={home.latestSeries ?? []} />
        <ContentRow title="Latest anime" subtitle="Recent anime releases and premieres" items={home.latestAnime ?? []} />
        <ContentRow title="Latest dramas" subtitle="Recent K, J, C, Thai and Filipino premieres" items={home.latestDramas ?? []} />

        {/* Popularity is separate from release date. */}
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
          subtitle="TV series · OVAs · trending Japanese animation"
          items={home.airingAnime}
        />
        <ContentRow
          title="Popular dramas today"
          subtitle="K · J · C · Thai · Filipino"
          items={home.popularDramas ?? []}
        />

        {(home.animeMovies?.length ?? 0) > 0 && (
          <ContentRow
            title="Anime movies"
            subtitle="Theatrical & feature anime films"
            items={home.animeMovies ?? []}
            wide
          />
        )}

        {/* ── Dramas by region ── */}
        <div className="cinematic-glow relative space-y-12 sm:space-y-14">
          <ContentRow
            title="Popular K-dramas today"
            subtitle="Top Korean dramas"
            items={home.trendingKdramas}
          />
          <ContentRow
            title="Popular J-dramas today"
            subtitle="Top Japanese dramas"
            items={home.trendingJdramas}
          />
          <ContentRow
            title="Popular C-dramas today"
            subtitle="Top Chinese dramas"
            items={home.trendingCdramas}
          />
          <ContentRow
            title="Popular Thai dramas today"
            subtitle="Top Thai dramas"
            items={home.trendingThaidramas}
          />
          <ContentRow
            title="Popular Filipino dramas today"
            subtitle="Top Filipino series & dramas"
            items={home.filipinoSeries}
          />
          {(home.gmmtvDramas?.length ?? 0) > 0 && (
            <ContentRow
              title="Free Thai dramas (GMMTV)"
              subtitle="Official free episodes on YouTube"
              items={home.gmmtvDramas ?? []}
            />
          )}
        </div>

        {/* ── More picks ── */}
        <ContentRow
          title="Top rated"
          subtitle="Highest scores across the catalog"
          items={home.topRated}
        />
        {(home.comingSoon?.length ?? 0) > 0 && (
          <ContentRow
            title="Coming soon"
            subtitle="Upcoming titles"
            items={home.comingSoon ?? []}
          />
        )}
        {(home.freeLegal?.length ?? 0) > 0 && (
          <ContentRow
            title="Free legal picks"
            subtitle="Public domain & free legal streams"
            items={home.freeLegal}
            wide
          />
        )}
        {(home.traktTrending?.length ?? 0) > 0 && (
          <ContentRow
            title="Trakt trending"
            subtitle="What the community is watching"
            items={home.traktTrending ?? []}
            showRank
          />
        )}
        {(home.communityFavorites?.length ?? 0) > 0 && (
          <ContentRow
            title="Community favorites"
            subtitle="Popular across CineVerse"
            items={home.communityFavorites}
          />
        )}

        {(home.koreanMovies?.length ?? 0) > 0 && (
          <ContentRow
            title="Popular Korean movies today"
            subtitle="Top Korean cinema"
            items={home.koreanMovies}
            wide
          />
        )}
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
        {/* Adult titles never appear on home; restricted users use Anime → Hentai. */}

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

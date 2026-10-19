"use client";
import Image from "next/image";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import YouTube, { type YouTubeEvent, type YouTubeProps } from "react-youtube";
import { motion, useMotionValue } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Pause,
  Play,
  Star,
} from "lucide-react";
import type { Content } from "@/types/content";
import { Button, buttonVariants } from "@/components/ui/button";
import { displayTitle, primaryScore } from "@/lib/content/normalize";
import { formatRuntime, formatScore, cn } from "@/lib/utils";
import { getDetailsHref, getWatchHref } from "@/lib/content/watch-href";
import { heroCopyContainer, heroCopyItem } from "@/lib/motion";
import {
  cinematicBackdropUrl,
  normalizeImageUrl,
  resizeTmdbImage,
} from "@/lib/content/posters";
import { pickHeroTrailer } from "@/lib/content/trailers";
import {
  ensureKnownTrailers,
  isPlayableTrailerKey,
  lookupKnownTrailerKeys,
} from "@/lib/content/known-trailers";

import {
  applyPlayback,
  hardSilence,
  releasePlayer,
  type YtPlayer,
} from "@/lib/playback/youtube-controls";

function HeroTrailerBg({
  trailerKey,
  alternateKeys = [],
  title,
  poster,
  active,
  playbackAllowed,
  reduceMotion,
  onPlayer,
}: {
  trailerKey: string | null;
  /** Extra keys to try if the primary video is unavailable */
  alternateKeys?: string[];
  title: string;
  poster: string | null;
  active: boolean;
  /** False when hero is scrolled off-screen or tab is hidden */
  playbackAllowed: boolean;
  reduceMotion: boolean;
  onPlayer?: (player: YtPlayer | null) => void;
}) {
  const keyQueue = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of [trailerKey, ...alternateKeys]) {
      if (!raw || !isPlayableTrailerKey(raw)) continue;
      const k = raw.trim();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(k);
    }
    return out;
  }, [trailerKey, alternateKeys]);

  const [keyIndex, setKeyIndex] = useState(0);
  const [failedAll, setFailedAll] = useState(false);

  // Reset attempt chain when slide / keys change
  const queueKey = keyQueue.join("|");
  const [previousQueue, setPreviousQueue] = useState(queueKey);
  if (previousQueue !== queueKey) {
    setPreviousQueue(queueKey);
    setKeyIndex(0);
    setFailedAll(false);
  }

  const activeKey =
    !failedAll && keyQueue[keyIndex] ? keyQueue[keyIndex]! : null;

  // Only the active, visible slide may own a live YouTube iframe.
  const shouldPlay = Boolean(active && playbackAllowed && activeKey);

  const [showPlayer, setShowPlayer] = useState(false);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const playerRef = useRef<YtPlayer | null>(null);
  const destroyedRef = useRef(false);
  const shouldPlayRef = useRef(shouldPlay);
  useEffect(() => {
    shouldPlayRef.current = shouldPlay;
  }, [shouldPlay]);

  // Mount / unmount player with hard silence on every leave
  useEffect(() => {
    destroyedRef.current = false;
    if (!shouldPlay) {
      releasePlayer(playerRef);
      onPlayer?.(null);
      const t = window.setTimeout(() => {
        setShowPlayer(false);
        setPlayingKey(null);
      }, 0);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setShowPlayer(true), 220);
    return () => {
      window.clearTimeout(t);
      destroyedRef.current = true;
      releasePlayer(playerRef);
      onPlayer?.(null);
    };
  }, [shouldPlay, activeKey, onPlayer]);

  // Every visible preview plays with audio enabled.
  useEffect(() => {
    applyPlayback(playerRef.current, {
      play: shouldPlay,
      soundOn: shouldPlay,
    });
  }, [shouldPlay, showPlayer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      destroyedRef.current = true;
      releasePlayer(playerRef);
      onPlayer?.(null);
    };
  }, [onPlayer]);

  const opts: YouTubeProps["opts"] = useMemo(
    () => ({
      width: "100%",
      height: "100%",
      // nocookie host is more reliable for third-party hero embeds
      host: "https://www.youtube-nocookie.com",
      playerVars: {
        autoplay: 1,
        mute: 0,
        controls: 0,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        loop: 1,
        playlist: activeKey ?? undefined,
        iv_load_policy: 3,
        disablekb: 1,
        fs: 0,
        cc_load_policy: 0,
        // Required by YT for some rights-holder trailers on custom domains
        origin:
          typeof window !== "undefined" ? window.location.origin : undefined,
      },
    }),
    [activeKey],
  );

  const onReady = useCallback(
    (event: YouTubeEvent) => {
      if (destroyedRef.current) return;
      const p = event.target as unknown as YtPlayer;
      playerRef.current = p;
      p.getIframe?.()?.setAttribute(
        "allow",
        "autoplay; encrypted-media; picture-in-picture",
      );
      onPlayer?.(p);
      applyPlayback(p, {
        play: shouldPlayRef.current,
        soundOn: shouldPlayRef.current,
      });
    },
    [onPlayer],
  );

  const onStateChange = useCallback(
    (event: YouTubeEvent<number>) => {
      const p = event.target as unknown as YtPlayer;
      if (destroyedRef.current || p !== playerRef.current) return;
      if (!shouldPlayRef.current) {
        hardSilence(p);
        return;
      }
      // Keep the artwork visible until the trailer actually starts, rather than
      // replacing it with YouTube's blank loading screen or autoplay prompt.
      if (event.data === 1) {
        p.unMute?.();
        p.setVolume?.(72);
        setPlayingKey(activeKey);
      }
      if (event.data === 2) setPlayingKey(null);
      // Loop only when ended (0) or cued (5) — never fight mute on pause (2)
      if (event.data === 0 || event.data === 5) {
        applyPlayback(p, {
          play: true,
          soundOn: true,
        });
      }
    },
    [activeKey],
  );

  // YouTube error 100/101/150 = unavailable / embed blocked → try next key
  const onError = useCallback(() => {
    if (destroyedRef.current) return;
    setPlayingKey(null);
    releasePlayer(playerRef);
    onPlayer?.(null);
    setKeyIndex((i) => {
      const next = i + 1;
      if (next >= keyQueue.length) {
        setFailedAll(true);
        setShowPlayer(false);
        return i;
      }
      return next;
    });
  }, [keyQueue.length, onPlayer]);

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[var(--background)]"
      data-trailer-state={
        shouldPlay
          ? playingKey === activeKey
            ? "playing"
            : "loading"
          : "poster"
      }
    >
      <div
        className={cn(
          "absolute inset-0",
          active && !reduceMotion && "hero-kenburns",
        )}
      >
        {poster ? (
          <Image
            src={poster}
            alt=""
            fill
            fetchPriority={active ? "high" : "auto"}
            loading={active ? undefined : "lazy"}
            sizes="100vw"
            className="object-cover object-center"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/35 via-[var(--background)] to-[var(--secondary)]/20" />
        )}
      </div>

      <div
        className={cn(
          "absolute inset-0 z-[1] overflow-hidden transition-opacity duration-700",
          showPlayer && activeKey && shouldPlay && playingKey === activeKey
            ? "opacity-100"
            : "opacity-0",
        )}
        aria-hidden
      >
        {showPlayer && shouldPlay && activeKey ? (
          <div className="absolute left-1/2 top-1/2 aspect-video h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2">
            <YouTube
              key={`yt-hero-${activeKey}-${keyIndex}`}
              videoId={activeKey}
              opts={opts}
              onReady={onReady}
              onStateChange={onStateChange}
              onError={onError}
              className="pointer-events-none absolute inset-0 h-full w-full"
              iframeClassName="pointer-events-none absolute inset-0 h-full w-full border-0"
              title={`${title} official trailer`}
            />
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none absolute inset-0 z-[2] bg-black/10" />
    </div>
  );
}

function runtimeOrSeasons(
  runtime?: number | null,
  seasonCount?: number | null,
): string | null {
  if (runtime && runtime > 0) return formatRuntime(runtime);
  if (seasonCount && seasonCount > 0) {
    return `${seasonCount} season${seasonCount === 1 ? "" : "s"}`;
  }
  return null;
}

function HeroCopy({
  item,
  eyebrow,
  animated,
}: {
  item: Content;
  eyebrow?: string;
  animated: boolean;
}) {
  const title = displayTitle(item);
  const score = primaryScore(item);
  const watchHref = getWatchHref(item);
  const detailsHref = getDetailsHref(item);
  const genreNames = (item.genres ?? []).slice(0, 3).map((g) => g.name);
  const runtimeLabel = runtimeOrSeasons(item.runtime, item.seasonCount);

  const Wrap = animated ? motion.div : "div";
  const Item = animated ? motion.div : "div";
  const Title = animated ? motion.h1 : "h1";
  const P = animated ? motion.p : "p";

  const itemProps = animated ? { variants: heroCopyItem } : {};
  const containerProps = animated
    ? {
        variants: heroCopyContainer,
        initial: "hidden" as const,
        animate: "visible" as const,
        exit: "exit" as const,
      }
    : {};

  return (
    <Wrap
      className="hero-feature-copy w-full max-w-[44rem]"
      {...containerProps}
    >
      <P
        className="hero-feature-eyebrow mb-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/75 sm:mb-5 sm:text-xs"
        {...itemProps}
      >
        {eyebrow || "Featured today"}
      </P>

      <Title
        className="hero-feature-title text-balance font-display font-bold leading-[1.02] tracking-[-0.045em] text-[var(--text-primary)]"
        {...itemProps}
      >
        <Link
          href={detailsHref}
          className="rounded-sm !text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          {title}
        </Link>
      </Title>

      <Item
        className="hero-feature-meta mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-white/80 sm:text-sm"
        {...itemProps}
      >
        {score != null && (
          <span className="inline-flex items-center gap-1 text-white">
            <Star className="h-3.5 w-3.5 fill-current" />
            {formatScore(score)}
          </span>
        )}
        {item.year && <span>{item.year}</span>}
        {item.ageRating && (
          <span className="border border-white/40 px-1.5 py-0.5 text-[10px]">
            {item.ageRating}
          </span>
        )}
        {runtimeLabel && <span>{runtimeLabel}</span>}
      </Item>

      {genreNames.length > 0 && (
        <P
          className="hero-feature-genres mt-3 text-xs font-medium text-white/70 sm:text-sm"
          {...itemProps}
        >
          {genreNames.join(" · ")}
        </P>
      )}

      {item.overview && (
        <P
          className="hero-feature-description mt-4 line-clamp-3 max-w-[34rem] text-sm leading-relaxed text-white/90 sm:text-lg"
          {...itemProps}
        >
          {item.overview}
        </P>
      )}

      <Item
        className="hero-feature-actions mt-7 flex flex-wrap items-center gap-2.5 sm:mt-8 sm:gap-3"
        {...itemProps}
      >
        <Link
          href={watchHref}
          className={cn(
            buttonVariants({ size: "lg", variant: "ghost" }),
            "hero-play-button h-11 rounded px-6 font-semibold motion-safe:active:scale-[0.98] sm:h-12 sm:px-8",
          )}
        >
          <Play className="h-5 w-5 fill-current" aria-hidden />
          Play
        </Link>
        <Link
          href={detailsHref}
          aria-label={`More info about ${title}`}
          className={cn(
            buttonVariants({ size: "lg", variant: "ghost" }),
            "hero-info-button h-11 rounded px-5 font-semibold motion-safe:active:scale-[0.98] sm:h-12 sm:px-7",
          )}
        >
          <Info className="h-5 w-5" aria-hidden />
          More info
        </Link>
      </Item>
    </Wrap>
  );
}

export function HeroCarousel({
  items,
  eyebrow,
}: {
  items: Content[];
  eyebrow?: string;
}) {
  const reduceMotion = usePrefersReducedMotion();

  // Client hydration: primary trailer + alternate keys for each slide
  const [hydratedTrailers, setHydratedTrailers] = useState<
    Record<string, Content["trailer"]>
  >({});
  const [alternateKeysById, setAlternateKeysById] = useState<
    Record<string, string[]>
  >({});

  const [index, setIndex] = useState(0);
  const requestedRef = useRef(new Set<string>());
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Video previews do not need WebGL. Resolve the visible and next title in
    // every graphics mode, including when the user opts to play one manually.
    if (!items.length) return;
    const targets = [items[index], items[(index + 1) % items.length]].filter(
      (c): c is Content => Boolean(c?.id) && !requestedRef.current.has(c.id),
    );
    if (!targets.length) return;
    for (const c of targets) requestedRef.current.add(c.id);

    void (async () => {
      const trailerUpdates: Record<string, Content["trailer"]> = {};
      const altUpdates: Record<string, string[]> = {};

      await Promise.all(
        targets.map(async (c) => {
          try {
            const res = await fetch(
              `/api/v1/content/${encodeURIComponent(c.id)}/trailers`,
            );
            if (!res.ok) return;
            const data = (await res.json()) as {
              trailers?: Array<{
                id?: string;
                key?: string;
                site?: string;
                name?: string;
                official?: boolean;
                type?: string;
              }>;
            };
            const mapped = (data.trailers ?? [])
              .filter((t) => t.site?.toLowerCase() === "youtube")
              .map((t) => ({
                id: t.id ?? `yt_${t.key}`,
                key: String(t.key ?? "").trim(),
                site: "youtube" as const,
                name: t.name ?? "Official Trailer",
                official: Boolean(t.official),
                type: t.type ?? "Trailer",
              }))
              .filter(
                (t) => isPlayableTrailerKey(t.key) && pickHeroTrailer([t]),
              );

            const best = pickHeroTrailer(mapped);
            const alts = mapped
              .map((t) => t.key)
              .filter((k) => k !== best?.key);

            if (best && !isPlayableTrailerKey(c.trailer?.key)) {
              trailerUpdates[c.id] = best;
            }
            if (alts.length) altUpdates[c.id] = alts.slice(0, 4);
          } catch {
            /* ignore */
          }
        }),
      );

      if (!mountedRef.current) return;
      if (Object.keys(trailerUpdates).length) {
        setHydratedTrailers((prev) => ({ ...prev, ...trailerUpdates }));
      }
      if (Object.keys(altUpdates).length) {
        setAlternateKeysById((prev) => ({ ...prev, ...altUpdates }));
      }
    })();
  }, [items, index]);

  // Preserve server order. Always pin curated keys client-side so a bad
  // TMDB/seed id never blocks JJK / Last of Us / Stranger Things / etc.
  const slides = useMemo(() => {
    const seen = new Set<string>();
    const out: Content[] = [];
    for (const c of items) {
      if (!c?.id || seen.has(c.id)) continue;
      seen.add(c.id);
      const extra = hydratedTrailers[c.id];
      let item: Content =
        extra && !isPlayableTrailerKey(c.trailer?.key)
          ? { ...c, trailer: extra }
          : c.trailer && !isPlayableTrailerKey(c.trailer.key)
            ? { ...c, trailer: extra ?? null }
            : c;
      item = ensureKnownTrailers(item);
      if (!item.poster?.url && !item.backdrop?.url && !item.trailer?.key) {
        continue;
      }
      out.push(item);
    }
    return out.slice(0, 12);
  }, [items, hydratedTrailers]);

  const [paused, setPaused] = useState(false);
  const [previewRequested, setPreviewRequested] = useState(false);
  const progress = useMotionValue(0);
  const [heroInView, setHeroInView] = useState(true);
  const [docVisible, setDocVisible] = useState(true);
  const sectionRef = useRef<HTMLElement | null>(null);
  const activePlayerRef = useRef<YtPlayer | null>(null);

  const previewEnabled = !paused && (!reduceMotion || previewRequested);
  const playbackAllowed = heroInView && docVisible && previewEnabled;
  const carouselAllowed = heroInView && docVisible && !paused && !reduceMotion;

  // Pause / mute when hero leaves the viewport (scroll down)
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        // Require a meaningful share of the hero still on screen
        setHeroInView(entry.isIntersecting && entry.intersectionRatio >= 0.28);
      },
      { threshold: [0, 0.15, 0.28, 0.45, 0.7, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Pause when the browser tab is hidden
  useEffect(() => {
    const onVis = () => {
      setDocVisible(document.visibilityState === "visible");
    };
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const autoplayDelay = 28_000;

  const autoplayPlugin = useMemo(
    () =>
      Autoplay({
        active: carouselAllowed,
        delay: autoplayDelay,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
        stopOnFocusIn: true,
        playOnInit: false,
      }),
    [autoplayDelay, carouselAllowed],
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: slides.length > 1,
      duration: reduceMotion ? 0 : 30,
      align: "start",
      containScroll: false,
      skipSnaps: false,
    },
    [autoplayPlugin],
  );
  const indexRef = useRef(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const next = emblaApi.selectedScrollSnap();
    // Only kill audio when the snap actually changes (not on reInit/same index)
    if (next !== indexRef.current) {
      hardSilence(activePlayerRef.current);
      activePlayerRef.current = null;
      indexRef.current = next;
    }
    setIndex(next);
    progress.set(0);
  }, [emblaApi, progress]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    const id = requestAnimationFrame(() => onSelect());
    return () => {
      cancelAnimationFrame(id);
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  // Force-sync active player when leaving view, muting, or after slide settle
  useEffect(() => {
    const p = activePlayerRef.current;
    if (!playbackAllowed) {
      hardSilence(p);
      return;
    }
    applyPlayback(p, { play: true, soundOn: true });
  }, [playbackAllowed, index]);

  // Some browsers require an interaction before unmuted autoplay. Retry on
  // the first click or keypress, without adding a separate sound control.
  useEffect(() => {
    if (!playbackAllowed) return;
    let activated = false;
    const resume = () => {
      if (activated || !activePlayerRef.current) return;
      activated = true;
      applyPlayback(activePlayerRef.current, { play: true, soundOn: true });
    };
    window.addEventListener("click", resume, true);
    window.addEventListener("keydown", resume, true);
    return () => {
      window.removeEventListener("click", resume, true);
      window.removeEventListener("keydown", resume, true);
    };
  }, [playbackAllowed, index]);

  useEffect(() => {
    if (!emblaApi) return;
    try {
      const ap = emblaApi.plugins()?.autoplay;
      if (!carouselAllowed) {
        ap?.stop?.();
      } else {
        ap?.play?.();
        ap?.reset?.();
      }
    } catch {
      /* ignore */
    }
  }, [emblaApi, carouselAllowed, autoplayDelay]);

  useEffect(() => {
    if (!carouselAllowed || slides.length < 2) return;
    progress.set(0);
    let raf = 0;
    const tick = () => {
      const remaining = emblaApi?.plugins().autoplay?.timeUntilNext();
      if (remaining != null)
        progress.set(Math.max(0, Math.min(1, 1 - remaining / autoplayDelay)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [
    index,
    autoplayDelay,
    reduceMotion,
    slides.length,
    carouselAllowed,
    emblaApi,
    progress,
  ]);

  const registerActivePlayer = useCallback((player: YtPlayer | null) => {
    activePlayerRef.current = player;
  }, []);

  const togglePreview = useCallback(() => {
    if (!previewEnabled) {
      setPreviewRequested(true);
      setPaused(false);
    } else {
      hardSilence(activePlayerRef.current);
      setPaused(true);
    }
  }, [previewEnabled]);

  if (!slides.length) {
    return (
      <section
        className="hero-feature-viewport relative flex items-center bg-[var(--background)] px-5 sm:px-12"
        aria-busy="true"
        aria-label="Loading featured titles"
      >
        <div className="mx-auto w-full max-w-7xl space-y-4">
          <div className="h-6 w-32 skeleton rounded-full" />
          <div className="h-12 w-3/4 max-w-xl skeleton rounded-lg" />
          <div className="h-16 w-full max-w-xl skeleton rounded-lg" />
          <div className="flex gap-3">
            <div className="h-12 w-32 skeleton rounded-xl" />
            <div className="h-12 w-36 skeleton rounded-xl" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="hero-feature relative w-full overflow-hidden bg-[var(--background)]"
      aria-label="Featured titles"
      aria-roledescription="carousel"
      data-featured-index={index}
    >
      <div
        className="hero-feature-viewport w-full overflow-hidden"
        ref={emblaRef}
      >
        <div className="flex h-full">
          {slides.map((item, i) => {
            const title = displayTitle(item);
            const isActive = i === index;
            const knownKeys = lookupKnownTrailerKeys(item);
            const trailerKey =
              (item.trailer?.site === "youtube" &&
              isPlayableTrailerKey(item.trailer.key)
                ? item.trailer.key.trim()
                : null) ||
              knownKeys[0] ||
              null;
            // Known alts + API alts (skip primary)
            const altKeys = [
              ...knownKeys.slice(trailerKey === knownKeys[0] ? 1 : 0),
              ...(alternateKeysById[item.id] ?? []),
            ].filter((k) => k !== trailerKey && isPlayableTrailerKey(k));
            const backdropUrl = normalizeImageUrl(item.backdrop?.url);
            const posterUrl = normalizeImageUrl(item.poster?.url);
            const poster = backdropUrl
              ? resizeTmdbImage(backdropUrl, "w1280")
              : posterUrl
                ? resizeTmdbImage(posterUrl, "w780")
                : cinematicBackdropUrl(item.id, title);
            return (
              <div
                key={`${item.id}-slide-${i}`}
                className="relative h-full min-w-0 shrink-0 grow-0 basis-full overflow-hidden"
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${slides.length}: ${title}`}
                aria-hidden={!isActive}
                inert={!isActive}
              >
                <HeroTrailerBg
                  trailerKey={trailerKey}
                  alternateKeys={altKeys}
                  title={title}
                  poster={poster}
                  active={isActive}
                  playbackAllowed={playbackAllowed && isActive}
                  reduceMotion={reduceMotion}
                  onPlayer={isActive ? registerActivePlayer : undefined}
                />

                <div className="hero-feature-shade pointer-events-none absolute inset-0 z-[3]" />

                <div className="hero-feature-content relative z-10 mx-auto flex h-full w-full items-center">
                  <HeroCopy
                    item={item}
                    eyebrow={eyebrow}
                    animated={isActive && !reduceMotion}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="hero-feature-controls absolute inset-x-0 bottom-6 z-20 mx-auto flex w-full items-center justify-between gap-4 sm:bottom-8">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous featured title"
            className="h-10 w-10 rounded-full text-white/80 hover:bg-white/10"
            disabled={slides.length < 2}
            onClick={() => emblaApi?.scrollPrev(reduceMotion)}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next featured title"
            className="h-10 w-10 rounded-full text-white/80 hover:bg-white/10"
            disabled={slides.length < 2}
            onClick={() => emblaApi?.scrollNext(reduceMotion)}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePreview}
            aria-label={previewEnabled ? "Pause preview" : "Play preview"}
            aria-pressed={previewEnabled}
            className="ml-2 h-10 w-10 rounded-full border border-white/35 text-white/80 hover:bg-white/10"
          >
            {previewEnabled ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div
          className="flex min-w-0 items-center"
          role="group"
          aria-label="Choose a featured title"
        >
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`Show ${displayTitle(s)}`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => emblaApi?.scrollTo(i, reduceMotion)}
              className="group relative flex h-10 w-4 items-center px-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-6"
            >
              <span
                className={cn(
                  "relative h-0.5 w-full overflow-hidden transition-colors",
                  i === index
                    ? "bg-white/40"
                    : "bg-white/20 group-hover:bg-white/60",
                )}
              >
                {i === index && (
                  <motion.span
                    className="absolute inset-0 origin-left bg-white"
                    style={{ scaleX: reduceMotion || paused ? 1 : progress }}
                  />
                )}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

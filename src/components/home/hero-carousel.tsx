"use client";

import Image from "next/image";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import YouTube, { type YouTubeEvent, type YouTubeProps } from "react-youtube";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Play,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { Content } from "@/types/content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { displayTitle, primaryScore } from "@/lib/content/normalize";
import { formatScore, cn } from "@/lib/utils";
import {
  getDetailsHref,
  getTrailerHref,
  getWatchHref,
  hasOfficialTrailer,
} from "@/lib/content/watch-href";
import { heroCopyContainer, heroCopyItem } from "@/lib/motion";

const SOUND_PREF_KEY = "cineverse_hero_trailer_sound";

function isValidYoutubeKey(key?: string | null): boolean {
  return Boolean(key && /^[\w-]{11}$/.test(key.trim()));
}

type YtPlayer = {
  playVideo?: () => void;
  pauseVideo?: () => void;
  mute?: () => void;
  unMute?: () => void;
  isMuted?: () => boolean;
  setVolume?: (n: number) => void;
  getPlayerState?: () => number;
};

function HeroTrailerBg({
  trailerKey,
  title,
  poster,
  active,
  nearActive,
  soundOn,
  reduceMotion,
}: {
  trailerKey: string | null;
  title: string;
  poster: string | null;
  active: boolean;
  nearActive: boolean;
  soundOn: boolean;
  reduceMotion: boolean;
}) {
  const validKey =
    trailerKey && isValidYoutubeKey(trailerKey) ? trailerKey.trim() : null;
  const [showPlayer, setShowPlayer] = useState(false);
  const playerRef = useRef<YtPlayer | null>(null);

  useEffect(() => {
    playerRef.current = null;
    if (!active || !validKey) {
      const t = window.setTimeout(() => setShowPlayer(false), 0);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setShowPlayer(true), 380);
    return () => window.clearTimeout(t);
  }, [validKey, active]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p || !active) return;
    try {
      if (soundOn) {
        p.unMute?.();
        p.setVolume?.(72);
        p.playVideo?.();
      } else {
        p.mute?.();
      }
    } catch {
      /* ignore */
    }
  }, [soundOn, active, showPlayer]);

  const opts: YouTubeProps["opts"] = useMemo(
    () => ({
      width: "100%",
      height: "100%",
      host: "https://www.youtube.com",
      playerVars: {
        autoplay: 1,
        mute: 1,
        controls: 0,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        loop: 1,
        playlist: validKey ?? undefined,
        iv_load_policy: 3,
        disablekb: 1,
        fs: 0,
        cc_load_policy: 0,
      },
    }),
    [validKey],
  );

  const onReady = useCallback(
    (event: YouTubeEvent) => {
      const p = event.target as unknown as YtPlayer;
      playerRef.current = p;
      try {
        p.playVideo?.();
        if (soundOn) {
          p.unMute?.();
          p.setVolume?.(72);
        } else {
          p.mute?.();
        }
      } catch {
        /* ignore */
      }
    },
    [soundOn],
  );

  const onStateChange = useCallback(
    (event: YouTubeEvent<number>) => {
      if (!active) return;
      if (event.data === 0 || event.data === 2 || event.data === 5) {
        try {
          event.target.playVideo?.();
          if (soundOn) {
            (event.target as unknown as YtPlayer).unMute?.();
          }
        } catch {
          /* ignore */
        }
      }
    },
    [active, soundOn],
  );

  const shouldMountPlayer = active || nearActive;

  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--background)]">
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
            priority={active}
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
          showPlayer && validKey && active ? "opacity-100" : "opacity-0",
        )}
        aria-hidden
      >
        {shouldMountPlayer && validKey ? (
          <div className="absolute left-1/2 top-1/2 aspect-video h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2">
            <YouTube
              key={`yt-hero-${validKey}`}
              videoId={validKey}
              opts={opts}
              onReady={onReady}
              onStateChange={onStateChange}
              className="pointer-events-none absolute inset-0 h-full w-full"
              iframeClassName="pointer-events-none absolute inset-0 h-full w-full border-0"
              title={`${title} official trailer`}
            />
          </div>
        ) : null}
      </div>

      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-[2] transition-colors duration-500",
          soundOn ? "bg-black/20" : "bg-black/25",
        )}
      />
    </div>
  );
}

function HeroCopy({
  item,
  liveLabel,
  soundOn,
  isActive,
  animated,
}: {
  item: Content;
  liveLabel?: string;
  soundOn: boolean;
  isActive: boolean;
  animated: boolean;
}) {
  const title = displayTitle(item);
  const score = primaryScore(item);
  const trailerKey =
    item.trailer?.site === "youtube" && isValidYoutubeKey(item.trailer.key)
      ? item.trailer.key.trim()
      : null;
  const watchHref = getWatchHref(item);
  const trailerHref = getTrailerHref(item);
  const detailsHref = getDetailsHref(item);
  const showTrailer = hasOfficialTrailer(item) || Boolean(trailerKey);

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
      className="text-scrim max-w-xl rounded-2xl p-5 sm:max-w-2xl sm:p-8"
      {...containerProps}
    >
      <P
        className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary-light)]"
        {...itemProps}
      >
        <Sparkles className="h-3.5 w-3.5" />
        {liveLabel || "Popular & trending today"}
      </P>

      <Item className="mb-3 flex flex-wrap gap-2" {...itemProps}>
        <Badge
          tone={
            item.contentType === "movie"
              ? "primary"
              : item.contentType === "series"
                ? "cyan"
                : item.contentType === "anime"
                  ? "accent"
                  : "gold"
          }
        >
          {item.contentType}
        </Badge>
        {item.year && <Badge tone="muted">{item.year}</Badge>}
        {score != null && (
          <Badge tone="gold">★ {formatScore(score)}</Badge>
        )}
        {trailerKey && (
          <Badge tone="primary">
            {soundOn && isActive ? "Trailer · audio" : "Trailer"}
          </Badge>
        )}
      </Item>

      <Title
        className="font-display text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl"
        {...itemProps}
      >
        {title}
      </Title>

      {item.overview && (
        <P
          className="mt-4 line-clamp-3 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base"
          {...itemProps}
        >
          {item.overview}
        </P>
      )}

      <Item className="mt-7 flex flex-wrap gap-3" {...itemProps}>
        <Link href={watchHref} className="watch-now-cta">
          <Button
            size="lg"
            variant="gold"
            className="watch-now-cta !text-black shadow-lg shadow-[var(--gold)]/25 transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]"
          >
            <Play className="h-4 w-4 !text-black" />
            Watch Now
          </Button>
        </Link>
        {showTrailer && (
          <Link href={trailerHref}>
            <Button
              size="lg"
              variant="secondary"
              className="transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]"
            >
              <Play className="h-4 w-4" />
              Watch Trailer
            </Button>
          </Link>
        )}
        <Link href={detailsHref}>
          <Button
            size="lg"
            variant="secondary"
            className="transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]"
          >
            <Bookmark className="h-4 w-4" />
            Details
          </Button>
        </Link>
      </Item>
    </Wrap>
  );
}

export function HeroCarousel({
  items,
  liveLabel,
}: {
  items: Content[];
  liveLabel?: string;
}) {
  const reduceMotion = useReducedMotion() ?? false;

  const slides = useMemo(() => {
    const seen = new Set<string>();
    const out: Content[] = [];
    const sorted = [...items].sort((a, b) => {
      const at =
        a.trailer?.site === "youtube" && isValidYoutubeKey(a.trailer.key)
          ? 1
          : 0;
      const bt =
        b.trailer?.site === "youtube" && isValidYoutubeKey(b.trailer.key)
          ? 1
          : 0;
      return bt - at;
    });
    for (const item of sorted) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      if (!item.poster?.url && !item.backdrop?.url && !item.trailer?.key) {
        continue;
      }
      out.push(item);
    }
    return out.slice(0, 12);
  }, [items]);

  const [soundOn, setSoundOn] = useState(false);
  const [soundHint, setSoundHint] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SOUND_PREF_KEY);
      if (saved === "1") {
        const t = window.setTimeout(() => {
          setSoundOn(true);
          setSoundHint(false);
        }, 0);
        return () => window.clearTimeout(t);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const autoplayDelay = soundOn ? 28_000 : 12_000;

  const autoplayPlugin = useMemo(
    () =>
      Autoplay({
        delay: autoplayDelay,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
      }),
    [autoplayDelay],
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: slides.length > 1,
      duration: reduceMotion ? 18 : 36,
      align: "start",
      containScroll: false,
      skipSnaps: false,
    },
    [autoplayPlugin],
  );
  const [index, setIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setIndex(emblaApi.selectedScrollSnap());
    setProgress(0);
  }, [emblaApi]);

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

  useEffect(() => {
    if (!emblaApi) return;
    try {
      emblaApi.plugins()?.autoplay?.reset?.();
    } catch {
      /* ignore */
    }
  }, [emblaApi, soundOn]);

  useEffect(() => {
    if (reduceMotion || slides.length < 2) return;
    setProgress(0);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / autoplayDelay);
      setProgress(t);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index, autoplayDelay, reduceMotion, slides.length]);

  const toggleSound = useCallback(() => {
    setSoundOn((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(SOUND_PREF_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
    setSoundHint(false);
  }, []);

  const scrollToCatalog = useCallback(() => {
    const el = document.getElementById("home-catalog");
    if (el) {
      el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
      return;
    }
    window.scrollTo({
      top: window.innerHeight * 0.92,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [reduceMotion]);

  const activeHasTrailer = Boolean(
    slides[index]?.trailer?.site === "youtube" &&
      isValidYoutubeKey(slides[index]?.trailer?.key),
  );

  if (!slides.length) {
    return (
      <section className="relative flex min-h-[100dvh] items-center justify-center bg-[var(--background)] pt-20">
        <p className="text-[var(--text-secondary)]">Loading featured titles…</p>
      </section>
    );
  }

  return (
    <section className="relative min-h-[100dvh] w-full overflow-hidden bg-[var(--background)]">
      <div className="h-[100dvh] w-full overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {slides.map((item, i) => {
            const title = displayTitle(item);
            const isActive = i === index;
            const nearActive = Math.abs(i - index) <= 1;
            const trailerKey =
              item.trailer?.site === "youtube" &&
              isValidYoutubeKey(item.trailer.key)
                ? item.trailer.key.trim()
                : null;
            const poster = item.backdrop?.url || item.poster?.url || null;

            return (
              <div
                key={`${item.id}-slide-${i}`}
                className="relative h-[100dvh] min-w-0 shrink-0 grow-0 basis-full overflow-hidden"
              >
                <HeroTrailerBg
                  trailerKey={trailerKey}
                  title={title}
                  poster={poster}
                  active={isActive}
                  nearActive={nearActive}
                  soundOn={soundOn}
                  reduceMotion={reduceMotion}
                />

                <div className="absolute inset-0 z-[3] bg-gradient-to-t from-[var(--background)] via-[var(--background)]/65 to-black/30" />
                <div className="absolute inset-y-0 left-0 z-[3] w-full bg-gradient-to-r from-[var(--background)] via-[var(--background)]/80 to-transparent md:w-[70%]" />

                <div className="relative z-10 mx-auto flex h-full max-w-7xl items-end px-4 pb-32 pt-28 sm:items-center sm:px-6 sm:pb-28">
                  {isActive ? (
                    reduceMotion ? (
                      <HeroCopy
                        item={item}
                        liveLabel={liveLabel}
                        soundOn={soundOn}
                        isActive
                        animated={false}
                      />
                    ) : (
                      <AnimatePresence mode="wait">
                        <HeroCopy
                          key={item.id}
                          item={item}
                          liveLabel={liveLabel}
                          soundOn={soundOn}
                          isActive
                          animated
                        />
                      </AnimatePresence>
                    )
                  ) : (
                    <div className="pointer-events-none opacity-0" aria-hidden>
                      <HeroCopy
                        item={item}
                        liveLabel={liveLabel}
                        soundOn={false}
                        isActive={false}
                        animated={false}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!reduceMotion && slides.length > 1 && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-30 h-[2px] bg-white/5"
          aria-hidden
        >
          <div
            className="h-full origin-left bg-[var(--primary-light)]"
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-10 z-20 flex items-center justify-between gap-3 px-4 sm:bottom-12 sm:px-8">
        <div className="pointer-events-auto flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            aria-label="Previous"
            className="border border-white/15 bg-black/55 backdrop-blur-md transition-transform hover:scale-105 active:scale-95"
            onClick={() => emblaApi?.scrollPrev()}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            aria-label="Next"
            className="border border-white/15 bg-black/55 backdrop-blur-md transition-transform hover:scale-105 active:scale-95"
            onClick={() => emblaApi?.scrollNext()}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>

          {activeHasTrailer && (
            <Button
              variant={soundOn ? "gold" : "secondary"}
              size="sm"
              aria-pressed={soundOn}
              aria-label={soundOn ? "Mute trailer" : "Unmute trailer"}
              className={cn(
                "border border-white/15 backdrop-blur-md transition-transform hover:scale-105 active:scale-95",
                !soundOn && "bg-black/55",
              )}
              onClick={toggleSound}
            >
              {soundOn ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {soundOn ? "Sound on" : "Sound off"}
              </span>
            </Button>
          )}
        </div>

        <div className="pointer-events-auto flex max-w-[50%] flex-wrap items-center justify-end gap-2">
          {activeHasTrailer && soundHint && !soundOn && (
            <button
              type="button"
              onClick={toggleSound}
              className="hidden animate-pulse rounded-full border border-white/20 bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur-md sm:inline-flex"
            >
              Tap for cinematic audio
            </button>
          )}
          {slides.map((s, i) => (
            <button
              key={`dot-${s.id}-${i}`}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => emblaApi?.scrollTo(i)}
              className={cn(
                "relative h-1.5 overflow-hidden rounded-full transition-all duration-300",
                i === index
                  ? "w-8 bg-white/25"
                  : "w-1.5 bg-white/35 hover:bg-white/55",
              )}
            >
              {i === index && (
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-[var(--primary-light)]"
                  style={{
                    width: reduceMotion ? "100%" : `${progress * 100}%`,
                  }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={scrollToCatalog}
        className="pointer-events-auto absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1 text-[var(--text-secondary)] transition-colors hover:text-white sm:bottom-4"
        aria-label="Scroll to catalog"
      >
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] opacity-80">
          Browse
        </span>
        <ChevronDown
          className={cn("h-5 w-5", !reduceMotion && "hero-scroll-cue")}
        />
      </button>
    </section>
  );
}

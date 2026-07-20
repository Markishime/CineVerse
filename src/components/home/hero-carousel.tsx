"use client";

import Image from "next/image";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import YouTube, { type YouTubeEvent, type YouTubeProps } from "react-youtube";
import {
  Bookmark,
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

/**
 * Cinematic trailer background with optional audio.
 * Browsers require muted autoplay — we start muted, then unMute when
 * the user enables sound (or has a saved preference + clicks the page).
 */
function HeroTrailerBg({
  trailerKey,
  title,
  poster,
  active,
  soundOn,
}: {
  trailerKey: string | null;
  title: string;
  poster: string | null;
  active: boolean;
  soundOn: boolean;
}) {
  const validKey =
    trailerKey && isValidYoutubeKey(trailerKey) ? trailerKey.trim() : null;
  const [showPlayer, setShowPlayer] = useState(false);
  const playerRef = useRef<YtPlayer | null>(null);

  // Mount player only on the active slide
  useEffect(() => {
    playerRef.current = null;
    if (!active || !validKey) {
      const t = window.setTimeout(() => setShowPlayer(false), 0);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => setShowPlayer(true), 350);
    return () => window.clearTimeout(t);
  }, [validKey, active]);

  // Apply mute / volume when preference changes or slide becomes active
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
        // Always start muted so autoplay is allowed; we unMute via API
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
        // Official trailers only are passed in as keys
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
          // May be blocked until a user gesture — toggle still works after click
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
      // If playback pauses while active, nudge play (keep cinematic loop)
      if (!active) return;
      // YT.PlayerState.PAUSED = 2, ENDED = 0, CUED = 5
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

  const thumb = validKey
    ? `https://i.ytimg.com/vi/${validKey}/maxresdefault.jpg`
    : null;

  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--background)]">
      {poster ? (
        <Image
          src={poster}
          alt=""
          fill
          priority={active}
          sizes="100vw"
          className="object-cover object-center"
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/35 via-[var(--background)] to-[var(--secondary)]/20" />
      )}

      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            const el = e.currentTarget;
            if (validKey && !el.src.includes("hqdefault")) {
              el.src = `https://i.ytimg.com/vi/${validKey}/hqdefault.jpg`;
            }
          }}
        />
      ) : null}

      {showPlayer && validKey && active ? (
        <div className="absolute inset-0 z-[1] overflow-hidden" aria-hidden>
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
        </div>
      ) : null}

      {/* Slightly lighter vignette when audio is on so picture stays readable */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 z-[2] transition-colors",
          soundOn ? "bg-black/20" : "bg-black/25",
        )}
      />
    </div>
  );
}

export function HeroCarousel({
  items,
  liveLabel,
}: {
  items: Content[];
  liveLabel?: string;
}) {
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

  // Cinematic audio preference (session)
  const [soundOn, setSoundOn] = useState(false);
  const [soundHint, setSoundHint] = useState(true);

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

  const autoplayPlugin = useMemo(
    () =>
      Autoplay({
        // Longer dwell when audio is on so trailers feel immersive
        delay: soundOn ? 28_000 : 12_000,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
      }),
    [soundOn],
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop: slides.length > 1,
      duration: 28,
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

  // Reset autoplay timer when sound mode changes
  useEffect(() => {
    if (!emblaApi) return;
    try {
      const ap = emblaApi.plugins()?.autoplay;
      ap?.reset?.();
    } catch {
      /* ignore */
    }
  }, [emblaApi, soundOn]);

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
            const score = primaryScore(item);
            const isActive = i === index;
            const trailerKey =
              item.trailer?.site === "youtube" &&
              isValidYoutubeKey(item.trailer.key)
                ? item.trailer.key.trim()
                : null;
            const poster = item.backdrop?.url || item.poster?.url || null;
            const watchHref = getWatchHref(item);
            const trailerHref = getTrailerHref(item);
            const detailsHref = getDetailsHref(item);
            const showTrailer = hasOfficialTrailer(item) || Boolean(trailerKey);

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
                  soundOn={soundOn}
                />

                <div className="absolute inset-0 z-[3] bg-gradient-to-t from-[var(--background)] via-[var(--background)]/65 to-black/30" />
                <div className="absolute inset-y-0 left-0 z-[3] w-full bg-gradient-to-r from-[var(--background)] via-[var(--background)]/80 to-transparent md:w-[70%]" />

                <div className="relative z-10 mx-auto flex h-full max-w-7xl items-end px-4 pb-28 pt-28 sm:items-center sm:px-6 sm:pb-24">
                  <div className="text-scrim max-w-xl rounded-2xl p-5 sm:max-w-2xl sm:p-8">
                    <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--primary-light)]">
                      <Sparkles className="h-3.5 w-3.5" />
                      {liveLabel || "Popular & trending today"}
                    </p>

                    <div className="mb-3 flex flex-wrap gap-2">
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
                    </div>

                    <h1 className="font-display text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl">
                      {title}
                    </h1>

                    {item.overview && (
                      <p className="mt-4 line-clamp-3 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
                        {item.overview}
                      </p>
                    )}

                    <div className="mt-7 flex flex-wrap gap-3">
                      <Link href={watchHref} className="watch-now-cta">
                        <Button
                          size="lg"
                          variant="gold"
                          className="watch-now-cta !text-black shadow-lg shadow-[var(--gold)]/25"
                        >
                          <Play className="h-4 w-4 !text-black" />
                          Watch Now
                        </Button>
                      </Link>
                      {showTrailer && (
                        <Link href={trailerHref}>
                          <Button size="lg" variant="secondary">
                            <Play className="h-4 w-4" />
                            Watch Trailer
                          </Button>
                        </Link>
                      )}
                      <Link href={detailsHref}>
                        <Button size="lg" variant="secondary">
                          <Bookmark className="h-4 w-4" />
                          Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sound + carousel controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-8 z-20 flex items-center justify-between gap-3 px-4 sm:px-8">
        <div className="pointer-events-auto flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            aria-label="Previous"
            className="border border-white/15 bg-black/55 backdrop-blur-md"
            onClick={() => emblaApi?.scrollPrev()}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            aria-label="Next"
            className="border border-white/15 bg-black/55 backdrop-blur-md"
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
                "border border-white/15 backdrop-blur-md",
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
                "h-1.5 rounded-full transition-all",
                i === index
                  ? "w-6 bg-[var(--primary-light)]"
                  : "w-1.5 bg-white/35 hover:bg-white/55",
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

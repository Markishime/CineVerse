"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Rotating cinematic video backdrops for auth pages.
 * Cycles Movies → Series → Anime → K-Drama every 5 seconds.
 */
const AUTH_BACKDROPS = [
  {
    id: "movies",
    label: "Movies",
    video: "/scroll/03-movies.mp4",
    poster: "/scroll/03-movies.jpg",
    accent: "from-amber-500/30",
  },
  {
    id: "series",
    label: "Series",
    video: "/scroll/04-series.mp4",
    poster: "/scroll/04-series.jpg",
    accent: "from-cyan-500/30",
  },
  {
    id: "anime",
    label: "Anime",
    video: "/scroll/05-anime.mp4",
    poster: "/scroll/05-anime.jpg",
    accent: "from-violet-500/30",
  },
  {
    id: "kdrama",
    label: "K-Drama",
    video: "/scroll/06-kdrama.mp4",
    poster: "/scroll/06-kdrama.jpg",
    accent: "from-rose-500/30",
  },
] as const;

const INTERVAL_MS = 5000;

export function AuthVideoBackground() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const active = AUTH_BACKDROPS[index];

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % AUTH_BACKDROPS.length);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [reduce]);

  // Warm the next clip so crossfades stay seamless
  useEffect(() => {
    if (reduce || typeof document === "undefined") return;
    const next = AUTH_BACKDROPS[(index + 1) % AUTH_BACKDROPS.length];
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.src = next.video;
    v.load();
  }, [index, reduce]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={active.id}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        >
          {reduce ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={active.poster}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <video
              key={active.video}
              className="absolute inset-0 h-full w-full object-cover"
              src={active.video}
              poster={active.poster}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
            />
          )}
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-br to-transparent opacity-60",
              active.accent,
            )}
          />
        </motion.div>
      </AnimatePresence>

      {/* Readable scrims */}
      <div className="absolute inset-0 bg-[var(--background)]/55" />
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--background)] via-[var(--background)]/88 to-[var(--background)]/50" />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-transparent to-[var(--background)]/70" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(139,124,255,0.18),transparent_55%)]" />

      {/* Category pill */}
      <div className="absolute bottom-6 left-6 z-[1] hidden sm:block lg:bottom-10 lg:left-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/90 shadow-lg backdrop-blur-md"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--primary-light)] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--primary-light)]" />
            </span>
            {active.label}
          </motion.div>
        </AnimatePresence>

        {/* Progress dots */}
        <div className="mt-3 flex gap-1.5">
          {AUTH_BACKDROPS.map((b, i) => (
            <span
              key={b.id}
              className={cn(
                "h-1 rounded-full transition-all duration-500",
                i === index
                  ? "w-6 bg-[var(--primary-light)]"
                  : "w-1.5 bg-white/25",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

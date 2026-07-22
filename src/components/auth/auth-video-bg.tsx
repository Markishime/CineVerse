"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Cinematic still backdrops for auth — taste direction:
 * celestial noir void + one accent per scene (gold / cyan / violet / rose).
 * Ken Burns drift replaces looping AI video for calmer, premium motion.
 */
const AUTH_BACKDROPS = [
  {
    id: "movies",
    label: "Movies",
    image: "/auth/movies.jpg",
    accent: "from-amber-400/25 via-transparent to-transparent",
    glow: "rgba(243, 201, 105, 0.22)",
    pill: "text-amber-200",
  },
  {
    id: "series",
    label: "Series",
    image: "/auth/series.jpg",
    accent: "from-cyan-400/25 via-transparent to-transparent",
    glow: "rgba(49, 215, 245, 0.2)",
    pill: "text-cyan-200",
  },
  {
    id: "anime",
    label: "Anime",
    image: "/auth/anime.jpg",
    accent: "from-violet-400/30 via-fuchsia-500/10 to-transparent",
    glow: "rgba(167, 156, 255, 0.28)",
    pill: "text-violet-200",
  },
  {
    id: "kdrama",
    label: "K-Drama",
    image: "/auth/kdrama.jpg",
    accent: "from-rose-400/20 via-amber-500/10 to-transparent",
    glow: "rgba(255, 122, 175, 0.18)",
    pill: "text-rose-200",
  },
] as const;

const INTERVAL_MS = 6500;

export function AuthVideoBackground() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const active = AUTH_BACKDROPS[index];

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % AUTH_BACKDROPS.length);
      setProgress(0);
    }, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [reduce]);

  // Soft progress fill for the active pill rail
  useEffect(() => {
    if (reduce) return;
    setProgress(0);
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      setProgress(Math.min(1, (now - start) / INTERVAL_MS));
      if (now - start < INTERVAL_MS) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [index, reduce]);

  // Prefetch next still
  useEffect(() => {
    if (typeof window === "undefined") return;
    const next = AUTH_BACKDROPS[(index + 1) % AUTH_BACKDROPS.length];
    const img = new window.Image();
    img.src = next.image;
  }, [index]);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={active.id}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.15, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <motion.img
            src={active.image}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            initial={
              reduce
                ? false
                : { scale: 1.08, x: "0.6%", y: "0.4%" }
            }
            animate={
              reduce
                ? { scale: 1 }
                : { scale: 1.16, x: "-0.8%", y: "-0.6%" }
            }
            transition={{
              duration: INTERVAL_MS / 1000,
              ease: "linear",
            }}
          />
          <div
            className={cn(
              "absolute inset-0 bg-gradient-to-br opacity-70",
              active.accent,
            )}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 70% 55% at 70% 40%, ${active.glow}, transparent 70%)`,
            }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Readability scrims — form column stays legible without glass stacking */}
      <div className="absolute inset-0 bg-[var(--background)]/45" />
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--background)] via-[var(--background)]/92 to-[var(--background)]/30 lg:via-[var(--background)]/88" />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-transparent to-[var(--background)]/70" />

      {/* Scene rail */}
      <div className="absolute bottom-6 left-6 z-[1] hidden sm:block lg:bottom-10 lg:left-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex items-center gap-2.5 rounded-full border border-white/12 bg-black/50 px-3.5 py-1.5 shadow-lg backdrop-blur-md"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--primary-light)] opacity-50" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--primary-light)]" />
            </span>
            <span
              className={cn(
                "text-[11px] font-semibold uppercase tracking-[0.18em]",
                active.pill,
              )}
            >
              {active.label}
            </span>
          </motion.div>
        </AnimatePresence>

        <div className="mt-3.5 flex gap-1.5">
          {AUTH_BACKDROPS.map((b, i) => (
            <button
              key={b.id}
              type="button"
              tabIndex={-1}
              aria-hidden
              className={cn(
                "relative h-1 overflow-hidden rounded-full transition-all duration-500",
                i === index ? "w-7 bg-white/20" : "w-1.5 bg-white/25",
              )}
              onClick={() => {
                setIndex(i);
                setProgress(0);
              }}
              style={{ pointerEvents: "auto" }}
            >
              {i === index && (
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-[var(--primary-light)]"
                  style={{
                    width: reduce ? "100%" : `${progress * 100}%`,
                  }}
                />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

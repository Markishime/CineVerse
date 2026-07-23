"use client";

import Link from "next/link";
import {
  Clapperboard,
  Film,
  Play,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { AuthVideoBackground } from "@/components/auth/auth-video-bg";
import {
  easeOutExpo,
  fadeUp,
  staggerContainer,
  staggerItem,
} from "@/lib/motion";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: Film,
    title: "Free forever",
    body: "Unlimited discovery across movies, series, anime and K-drama",
    tone: "text-[var(--primary-light)]",
    ring: "bg-[var(--primary)]/15",
  },
  {
    icon: Sparkles,
    title: "Live catalogs",
    body: "Posters, trailers, and seasons from trusted sources",
    tone: "text-[var(--secondary)]",
    ring: "bg-[var(--secondary)]/12",
  },
  {
    icon: ShieldCheck,
    title: "Legal watch paths",
    body: "Verified rights and official links, never piracy",
    tone: "text-[var(--gold)]",
    ring: "bg-[var(--gold)]/12",
  },
  {
    icon: Star,
    title: "Your orbit",
    body: "Watchlist, progress, and picks that follow you",
    tone: "text-[var(--accent)]",
    ring: "bg-[var(--accent)]/12",
  },
] as const;

const STATS = [
  { value: "50k+", label: "Titles" },
  { value: "Live", label: "Catalogs" },
  { value: "Free", label: "Forever" },
] as const;

export function AuthShell({
  children,
  title,
  subtitle,
  badge = "Free · Unlimited",
  footer,
  side = "login",
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: string;
  footer?: React.ReactNode;
  side?: "login" | "signup" | "forgot";
}) {
  const reduce = useReducedMotion();

  const headline =
    side === "signup"
      ? "Your universe of stories starts here."
      : side === "forgot"
        ? "We will get you back into the cosmos."
        : "Welcome back to the cosmos.";

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[var(--background)]">
      <AuthVideoBackground />

      {/* Soft decorative orbs */}
      <div className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-[var(--primary)]/15 blur-[100px]" />
      <div className="pointer-events-none absolute -right-16 bottom-1/4 h-64 w-64 rounded-full bg-[var(--secondary)]/10 blur-[90px]" />

      <div className="relative z-10 mx-auto grid min-h-[100dvh] max-w-6xl grid-cols-1 items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.12fr_0.88fr] lg:gap-14 lg:py-14">
        {/* Brand narrative — desktop */}
        <motion.aside
          className="hidden lg:block"
          initial={reduce ? false : "hidden"}
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div variants={staggerItem}>
            <Link
              href="/"
              className="group inline-flex items-center gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
            >
              <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)] shadow-[var(--glow-primary)] transition-transform duration-200 group-hover:scale-[1.05]">
                <Clapperboard className="h-5 w-5 text-white" />
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--secondary)] ring-2 ring-[var(--background)]" />
              </span>
              <span>
                <span className="block font-display text-2xl font-bold tracking-tight text-[var(--primary-light)]">
                  CineVerse
                </span>
                <span className="block text-[11px] font-medium tracking-wide text-[var(--text-muted)]">
                  Celestial entertainment
                </span>
              </span>
            </Link>
          </motion.div>

          <motion.p
            variants={staggerItem}
            className="mt-11 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]"
          >
            <Play className="h-3 w-3 text-[var(--primary-light)]" />
            Stream your story
          </motion.p>

          <motion.h2
            variants={staggerItem}
            className="mt-5 max-w-lg font-display text-[2.75rem] font-bold leading-[1.05] tracking-tight text-white xl:text-[3.35rem]"
          >
            {headline}
          </motion.h2>

          <motion.p
            variants={staggerItem}
            className="mt-5 max-w-[40ch] text-base leading-relaxed text-[var(--text-secondary)]"
          >
            Movies, series, anime, and K-drama. Trailers, season guides, legal
            watch links, and full titles when rights allow.
          </motion.p>

          <motion.div
            variants={staggerItem}
            className="mt-8 flex flex-wrap gap-3"
          >
            {STATS.map((s) => (
              <div
                key={s.label}
                className="min-w-[5.5rem] rounded-2xl border border-white/10 bg-black/30 px-4 py-3 backdrop-blur-sm"
              >
                <p className="font-display text-xl font-bold text-white">
                  {s.value}
                </p>
                <p className="mt-0.5 text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
                  {s.label}
                </p>
              </div>
            ))}
          </motion.div>

          <motion.ul
            variants={staggerContainer}
            className="mt-10 grid max-w-lg grid-cols-1 gap-3 sm:grid-cols-2"
          >
            {FEATURES.map((f) => (
              <motion.li
                key={f.title}
                variants={staggerItem}
                className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3.5 transition hover:border-white/14 hover:bg-white/[0.05]"
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    f.ring,
                  )}
                >
                  <f.icon className={cn("h-4 w-4", f.tone)} aria-hidden />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">
                    {f.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-[var(--text-muted)]">
                    {f.body}
                  </span>
                </span>
              </motion.li>
            ))}
          </motion.ul>
        </motion.aside>

        {/* Form panel */}
        <motion.div
          className="w-full max-w-md justify-self-center lg:max-w-none lg:justify-self-end"
          initial={reduce ? false : { opacity: 0, y: 24, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.48, ease: easeOutExpo, delay: 0.06 }}
        >
          <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-[var(--surface)]/95 shadow-[0_32px_90px_-24px_rgba(0,0,0,0.8),0_0_0_1px_rgba(139,124,255,0.08)] backdrop-blur-xl">
            {/* Top accent bar */}
            <div className="h-1 w-full bg-gradient-to-r from-[var(--primary)] via-[var(--secondary)] to-[var(--accent)]" />

            <div className="border-b border-white/8 px-6 pb-5 pt-6 sm:px-8 sm:pt-7">
              <Link
                href="/"
                className="mb-5 inline-flex items-center gap-2.5 rounded-xl lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)] shadow-[var(--glow-primary)]">
                  <Clapperboard className="h-4 w-4 text-white" />
                </span>
                <span className="font-display text-lg font-bold text-[var(--primary-light)]">
                  CineVerse
                </span>
              </Link>

              <div className="inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/25 bg-[var(--primary)]/10 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary-light)] shadow-[0_0_8px_var(--primary-light)]" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary-light)]">
                  {badge}
                </p>
              </div>
              <h1 className="mt-3.5 font-display text-2xl font-bold tracking-tight text-white sm:text-[1.85rem]">
                {title}
              </h1>
              <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-[var(--text-secondary)]">
                {subtitle}
              </p>
            </div>

            <motion.div
              className="px-6 py-6 sm:px-8 sm:py-7"
              variants={fadeUp}
              initial={reduce ? false : "hidden"}
              animate="visible"
            >
              {children}
            </motion.div>

            {footer && (
              <div className="border-t border-white/8 bg-gradient-to-b from-[var(--background-secondary)]/90 to-[var(--background-secondary)] px-6 py-4 text-center text-sm text-[var(--text-muted)] sm:px-8">
                {footer}
              </div>
            )}
          </div>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-[var(--text-muted)]">
            By continuing you agree to our{" "}
            <Link
              href="/terms"
              className="text-[var(--primary-light)] underline-offset-2 transition-colors hover:text-white hover:underline"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="text-[var(--primary-light)] underline-offset-2 transition-colors hover:text-white hover:underline"
            >
              Privacy
            </Link>
            .
          </p>
        </motion.div>
      </div>
    </div>
  );
}

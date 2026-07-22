"use client";

import Link from "next/link";
import {
  Clapperboard,
  Film,
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

const FEATURES = [
  {
    icon: Film,
    title: "Free forever",
    body: "Unlimited discovery across movies, series, anime and K-drama",
    tone: "text-[var(--primary-light)]",
  },
  {
    icon: Sparkles,
    title: "Live catalogs",
    body: "Posters, trailers, and seasons from trusted sources",
    tone: "text-[var(--secondary)]",
  },
  {
    icon: ShieldCheck,
    title: "Legal watch paths",
    body: "Verified rights and official links, never piracy",
    tone: "text-[var(--gold)]",
  },
  {
    icon: Star,
    title: "Your orbit",
    body: "Watchlist, progress, and picks that follow you",
    tone: "text-[var(--accent)]",
  },
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

      <div className="relative z-10 mx-auto grid min-h-[100dvh] max-w-6xl grid-cols-1 items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-16">
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
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary)] shadow-[var(--glow-primary)] transition-transform duration-200 group-hover:scale-[1.04]">
                <Clapperboard className="h-5 w-5 text-white" />
              </span>
              <span className="font-display text-2xl font-bold tracking-tight text-[var(--primary-light)]">
                CineVerse
              </span>
            </Link>
          </motion.div>

          <motion.p
            variants={staggerItem}
            className="mt-12 text-[11px] font-semibold uppercase tracking-[0.26em] text-[var(--text-muted)]"
          >
            Celestial entertainment
          </motion.p>

          <motion.h2
            variants={staggerItem}
            className="mt-3 max-w-lg font-display text-[2.75rem] font-bold leading-[1.06] tracking-tight text-white xl:text-[3.25rem]"
          >
            {headline}
          </motion.h2>

          <motion.p
            variants={staggerItem}
            className="mt-5 max-w-[38ch] text-base leading-relaxed text-[var(--text-secondary)]"
          >
            Movies, series, anime, and K-drama. Trailers, season guides, legal
            watch links, and full titles when rights allow.
          </motion.p>

          <motion.ul
            variants={staggerContainer}
            className="mt-12 max-w-md space-y-5 border-t border-white/10 pt-8"
          >
            {FEATURES.map((f) => (
              <motion.li
                key={f.title}
                variants={staggerItem}
                className="flex items-start gap-3.5"
              >
                <f.icon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${f.tone}`}
                  aria-hidden
                />
                <span>
                  <span className="block text-sm font-semibold text-white">
                    {f.title}
                  </span>
                  <span className="mt-0.5 block text-sm leading-relaxed text-[var(--text-muted)]">
                    {f.body}
                  </span>
                </span>
              </motion.li>
            ))}
          </motion.ul>
        </motion.aside>

        {/* Form panel — solid surface, intentional elevation (not glass default) */}
        <motion.div
          className="w-full max-w-md justify-self-center lg:max-w-none lg:justify-self-end"
          initial={reduce ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: easeOutExpo, delay: 0.05 }}
        >
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[var(--surface)] shadow-[0_28px_80px_-20px_rgba(0,0,0,0.75)]">
            <div className="border-b border-white/8 px-6 pb-5 pt-6 sm:px-8 sm:pt-7">
              <Link
                href="/"
                className="mb-5 inline-flex items-center gap-2 rounded-lg lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)]">
                  <Clapperboard className="h-3.5 w-3.5 text-white" />
                </span>
                <span className="font-display text-lg font-bold text-[var(--primary-light)]">
                  CineVerse
                </span>
              </Link>

              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--primary-light)]">
                {badge}
              </p>
              <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]">
                {title}
              </h1>
              <p className="mt-2 max-w-[40ch] text-sm leading-relaxed text-[var(--text-secondary)]">
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
              <div className="border-t border-white/8 bg-[var(--background-secondary)]/80 px-6 py-4 text-center text-sm text-[var(--text-muted)] sm:px-8">
                {footer}
              </div>
            )}
          </div>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-[var(--text-muted)]">
            By continuing you agree to our{" "}
            <Link
              href="/terms"
              className="text-[var(--primary-light)] underline-offset-2 hover:underline"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="text-[var(--primary-light)] underline-offset-2 hover:underline"
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

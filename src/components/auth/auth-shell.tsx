"use client";

import Link from "next/link";
import { Clapperboard, Film, Sparkles, Star } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { AuthVideoBackground } from "@/components/auth/auth-video-bg";
import { easeOutExpo, fadeUp, staggerContainer, staggerItem } from "@/lib/motion";

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

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[var(--background)]">
      <AuthVideoBackground />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-6xl flex-col justify-center gap-10 px-4 py-24 sm:px-6 lg:flex-row lg:items-center lg:gap-16">
        {/* Brand panel */}
        <motion.div
          className="hidden flex-1 lg:block"
          initial={reduce ? false : "hidden"}
          animate="visible"
          variants={staggerContainer}
        >
          <motion.div variants={staggerItem}>
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] shadow-[var(--glow-primary)]">
                <Clapperboard className="h-5 w-5 text-white" />
              </span>
              <span className="font-display text-2xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-[var(--primary-light)] via-[var(--secondary)] to-[var(--accent)] bg-clip-text text-transparent">
                  CineVerse
                </span>
              </span>
            </Link>
          </motion.div>
          <motion.h2
            variants={staggerItem}
            className="mt-8 max-w-md font-display text-4xl font-bold leading-tight text-white xl:text-5xl"
          >
            {side === "signup"
              ? "Your universe of stories starts here."
              : side === "forgot"
                ? "We'll get you back in."
                : "Welcome back to the cosmos."}
          </motion.h2>
          <motion.p
            variants={staggerItem}
            className="mt-4 max-w-md text-[var(--text-secondary)]"
          >
            Movies, series, anime, and K-drama — with trailers, season guides,
            legal watch links, and verified full titles when rights allow.
          </motion.p>
          <motion.ul
            variants={staggerContainer}
            className="mt-8 space-y-3 text-sm text-[var(--text-secondary)]"
          >
            <motion.li variants={staggerItem} className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-[var(--primary-light)]">
                <Film className="h-4 w-4" />
              </span>
              Free forever · unlimited discovery
            </motion.li>
            <motion.li variants={staggerItem} className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-[var(--secondary)]">
                <Sparkles className="h-4 w-4" />
              </span>
              Live posters & trailers from trusted catalogs
            </motion.li>
            <motion.li variants={staggerItem} className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-[var(--gold)]">
                <Star className="h-4 w-4" />
              </span>
              Cinematic catalog across every genre
            </motion.li>
          </motion.ul>
        </motion.div>

        {/* Form card */}
        <motion.div
          className="w-full max-w-md shrink-0"
          initial={reduce ? false : { opacity: 0, y: 28, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: easeOutExpo, delay: 0.08 }}
        >
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-[var(--surface)]/80 shadow-2xl shadow-black/50 backdrop-blur-xl">
            <div className="border-b border-white/10 bg-gradient-to-r from-[var(--primary)]/15 via-transparent to-[var(--secondary)]/10 px-6 py-5 sm:px-8">
              <Link
                href="/"
                className="mb-4 inline-flex items-center gap-2 lg:hidden"
              >
                <span className="font-display text-lg font-bold text-white">
                  CineVerse
                </span>
              </Link>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--primary-light)]">
                {badge}
              </p>
              <h1 className="mt-1 font-display text-2xl font-bold text-white sm:text-3xl">
                {title}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                {subtitle}
              </p>
            </div>
            <motion.div
              className="px-6 py-6 sm:px-8 sm:py-8"
              variants={fadeUp}
              initial={reduce ? false : "hidden"}
              animate="visible"
            >
              {children}
            </motion.div>
            {footer && (
              <div className="border-t border-white/10 px-6 py-4 text-center text-sm text-[var(--text-muted)] sm:px-8">
                {footer}
              </div>
            )}
          </div>
          <p className="mt-4 text-center text-xs text-[var(--text-muted)]">
            By continuing you agree to our{" "}
            <Link href="/terms" className="text-[var(--primary-light)] underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="text-[var(--primary-light)] underline"
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

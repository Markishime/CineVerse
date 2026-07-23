/**
 * Shared Framer Motion presets for CineVerse.
 *
 * 60fps rules (never compromise these):
 * - Animate only `transform` + `opacity` (no width/height/top/left/box-shadow anims)
 * - Keep durations short (≤ 280ms) so the main thread stays free
 * - Prefer `once: true` in-view so rows don’t re-animate on scroll thrash
 * - Call sites must respect `useReducedMotion()`
 */

import type { Transition, Variants } from "framer-motion";

export const easeOutExpo: Transition["ease"] = [0.16, 1, 0.3, 1];

/** Snappy spring — settles in ~1 frame budget at 60fps */
export const springSoft: Transition = {
  type: "spring",
  stiffness: 480,
  damping: 36,
  mass: 0.5,
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: easeOutExpo },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.18, ease: easeOutExpo },
  },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: easeOutExpo },
  },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.02,
      delayChildren: 0,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: easeOutExpo },
  },
};

export const pageTransition: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: easeOutExpo },
  },
  exit: {
    opacity: 0,
    y: -3,
    transition: { duration: 0.1, ease: "easeIn" },
  },
};

export const cardHover = {
  rest: { y: 0, scale: 1 },
  hover: {
    y: -3,
    scale: 1.02,
    transition: springSoft,
  },
};

/** Viewport once config for scroll-triggered reveals */
export const inViewOnce = {
  once: true,
  margin: "-32px 0px" as const,
  amount: 0.08 as const,
};

/** Hero slide copy — staggered entrance on each carousel change */
export const heroCopyContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.015,
      staggerDirection: -1,
    },
  },
};

export const heroCopyItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: easeOutExpo },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.14, ease: "easeIn" },
  },
};

/** Catalog rows rise gently as you scroll — cheap opacity/y only */
export const landingSection: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease: easeOutExpo },
  },
};

/** Row enter used by ContentRow — keep under one 60fps frame budget */
export const rowEnter = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: easeOutExpo },
} as const;

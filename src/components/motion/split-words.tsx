"use client";

import { Fragment } from "react";
import { motion, type Variants } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { easeOutExpo } from "@/lib/motion";
import { cn } from "@/lib/utils";

const word: Variants = {
  hidden: { y: "108%", rotate: 4, opacity: 0 },
  visible: (i: number) => ({
    y: "0%",
    rotate: 0,
    opacity: 1,
    transition: { duration: 0.7, ease: easeOutExpo, delay: 0.06 * i },
  }),
  exit: { y: "-60%", opacity: 0, transition: { duration: 0.18, ease: "easeIn" } },
};

/**
 * Masked word-by-word reveal. Screen readers get the plain text once; the
 * animated copies are hidden from assistive tech so names stay exact.
 */
export function SplitWords({
  text,
  className,
  wordClassName,
  delay = 0,
  inView = false,
}: {
  text: string;
  className?: string;
  wordClassName?: string;
  /** Extra stagger offset, in words */
  delay?: number;
  /** Trigger on scroll into view instead of on mount */
  inView?: boolean;
}) {
  const reduce = usePrefersReducedMotion();
  if (reduce) return <span className={className}>{text}</span>;

  const words = text.split(/\s+/).filter(Boolean);
  const trigger = inView
    ? { whileInView: "visible", viewport: { once: true, amount: 0.6 } }
    : { animate: "visible" };

  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <motion.span
        aria-hidden
        initial="hidden"
        exit="exit"
        {...trigger}
        className="inline"
      >
        {words.map((w, i) => (
          <Fragment key={`${w}-${i}`}>
            <span className="inline-block overflow-hidden pb-[0.12em] -mb-[0.12em] align-bottom">
              <motion.span
                custom={i + delay}
                variants={word}
                className={cn("inline-block origin-bottom-left", wordClassName)}
              >
                {w}
              </motion.span>
            </span>
            {/* Real space between masks so long titles can wrap */}
            {i < words.length - 1 ? " " : null}
          </Fragment>
        ))}
      </motion.span>
    </span>
  );
}

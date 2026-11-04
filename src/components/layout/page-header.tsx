"use client";

import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { SplitWords } from "@/components/motion/split-words";
import { easeOutExpo } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Consistent product-page title block with a staggered entrance */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  const reduce = usePrefersReducedMotion();
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, ease: easeOutExpo, delay },
        };

  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-4",
        className,
      )}
    >
      <div className="min-w-0 max-w-2xl">
        {eyebrow && (
          <motion.p
            className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--primary-light)]"
            {...rise(0)}
          >
            <motion.span
              className="inline-block h-px w-6 origin-left bg-[var(--primary-light)]"
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.7, ease: easeOutExpo, delay: 0.1 }}
              aria-hidden
            />
            {eyebrow}
          </motion.p>
        )}
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
          <SplitWords text={title} delay={1} />
        </h1>
        {description && (
          <motion.p
            className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base"
            {...rise(0.25)}
          >
            {description}
          </motion.p>
        )}
      </div>
      {actions ? (
        <motion.div
          className="flex flex-wrap items-center gap-2"
          {...rise(0.35)}
        >
          {actions}
        </motion.div>
      ) : null}
    </header>
  );
}

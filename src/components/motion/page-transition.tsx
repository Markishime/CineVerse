"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { pageTransition } from "@/lib/motion";

/**
 * Smooth route-level enter animation for main content.
 * Exit is limited (Next App Router unmounts quickly); enter still feels premium.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = usePrefersReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={reduce ? undefined : pageTransition}
        initial={reduce ? false : "initial"}
        animate={reduce ? undefined : "animate"}
        exit={reduce ? undefined : "exit"}
        // Transform/opacity only — keeps route changes at 60fps
        className="min-h-[inherit] will-change-[opacity,transform]"
        style={{ backfaceVisibility: "hidden" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

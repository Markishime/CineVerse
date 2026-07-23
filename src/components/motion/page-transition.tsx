"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { pageTransition } from "@/lib/motion";

/**
 * Smooth route-level enter animation for main content.
 * Exit is limited (Next App Router unmounts quickly); enter still feels premium.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  if (reduce) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={pageTransition}
        initial="initial"
        animate="animate"
        exit="exit"
        // Transform/opacity only — keeps route changes at 60fps
        className="min-h-[inherit] will-change-[opacity,transform]"
        style={{ backfaceVisibility: "hidden" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

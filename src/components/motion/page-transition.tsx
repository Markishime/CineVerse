"use client";

import { motion } from "framer-motion";
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
    <motion.div
      key={pathname}
      variants={reduce ? undefined : pageTransition}
      initial={reduce ? false : "initial"}
      animate={reduce ? undefined : "animate"}
      // Do not hold the previous route while Next commits the next one. This
      // keeps browser Back/Forward and slower TV browsers responsive.
      className="min-h-[inherit]"
      style={{ backfaceVisibility: "hidden" }}
    >
      {children}
    </motion.div>
  );
}

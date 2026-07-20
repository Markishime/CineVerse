"use client";

import { useEffect, type ReactNode } from "react";
import { usePerformanceStore } from "@/stores/performance-store";

/**
 * Lenis smooth scrolling — disabled on reduced-motion and performance mode.
 * Does not hijack scroll; short pins only used on homepage desktop scenes.
 */
export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const effective = usePerformanceStore((s) => s.effective);
  const reducedMotion = usePerformanceStore((s) => s.reducedMotion);

  useEffect(() => {
    if (reducedMotion || effective === "performance") return;
    if (typeof window === "undefined") return;

    let lenis: { destroy: () => void; raf: (t: number) => void } | null =
      null;
    let rafId = 0;
    let cancelled = false;

    (async () => {
      try {
        const Lenis = (await import("lenis")).default;
        if (cancelled) return;
        const instance = new Lenis({
          duration: 1.1,
          smoothWheel: true,
          touchMultiplier: 1.5,
        });
        lenis = instance;
        document.documentElement.classList.add("lenis", "lenis-smooth");

        const raf = (time: number) => {
          instance.raf(time);
          rafId = requestAnimationFrame(raf);
        };
        rafId = requestAnimationFrame(raf);
      } catch {
        // Lenis optional
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      document.documentElement.classList.remove("lenis", "lenis-smooth");
      lenis?.destroy();
    };
  }, [effective, reducedMotion]);

  return <>{children}</>;
}

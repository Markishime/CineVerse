"use client";

import { useEffect, type ReactNode } from "react";
import { usePerformanceStore } from "@/stores/performance-store";

/** Shared Lenis instance for ScrollTrigger pages (homepage cinematic scroll) */
export type CineverseLenis = {
  destroy: () => void;
  raf: (t: number) => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  off: (event: string, cb: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    __cineverseLenis?: CineverseLenis | null;
  }
}

/**
 * Site-wide Lenis smooth scrolling — 120Hz-ready, zero artificial lag.
 * - High lerp tracks the wheel immediately (no multi-second duration lag)
 * - requestAnimationFrame runs at display refresh (60–120+ Hz)
 * Disabled on reduced-motion and performance mode.
 */
export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const effective = usePerformanceStore((s) => s.effective);
  const reducedMotion = usePerformanceStore((s) => s.reducedMotion);

  useEffect(() => {
    if (reducedMotion || effective === "performance") return;
    if (typeof window === "undefined") return;

    let lenis: CineverseLenis | null = null;
    let rafId = 0;
    let cancelled = false;

    (async () => {
      try {
        const Lenis = (await import("lenis")).default;
        if (cancelled) return;

        // lerp 0.18 ≈ snappy tracking at 120Hz — no duration rubber-band lag
        const instance = new Lenis({
          lerp: 0.18,
          smoothWheel: true,
          syncTouch: false,
          touchMultiplier: 1.15,
          wheelMultiplier: 1,
          infinite: false,
          autoResize: true,
          autoRaf: false,
        }) as unknown as CineverseLenis;

        lenis = instance;
        window.__cineverseLenis = instance;
        document.documentElement.classList.add("lenis", "lenis-smooth");
        document.documentElement.dataset.scrollFps = "120";

        // Native display-refresh loop (60 / 90 / 120 Hz)
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
      delete document.documentElement.dataset.scrollFps;
      if (window.__cineverseLenis === lenis) {
        window.__cineverseLenis = null;
      }
      lenis?.destroy();
    };
  }, [effective, reducedMotion]);

  return <>{children}</>;
}

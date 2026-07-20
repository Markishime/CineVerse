"use client";

import { useEffect, type ReactNode } from "react";
import {
  detectWebGL,
  resolveCinematicDefault,
  usePerformanceStore,
} from "@/stores/performance-store";

export function PerformanceProvider({ children }: { children: ReactNode }) {
  const setEffective = usePerformanceStore((s) => s.setEffective);
  const setWebglSupported = usePerformanceStore((s) => s.setWebglSupported);
  const setReducedMotion = usePerformanceStore((s) => s.setReducedMotion);

  useEffect(() => {
    const webgl = detectWebGL();
    setWebglSupported(webgl);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      const reducedMotion = mq.matches;
      setReducedMotion(reducedMotion);
      // Always cinematic unless accessibility / no WebGL forces fallback
      setEffective(resolveCinematicDefault({ reducedMotion, webgl }));
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [setEffective, setWebglSupported, setReducedMotion]);

  return <>{children}</>;
}

"use client";

import { create } from "zustand";

/**
 * Cinematic is always the product default.
 * Only reduced-motion / missing WebGL force a lighter effective mode.
 */
interface PerformanceState {
  effective: "cinematic" | "balanced" | "performance";
  setEffective: (mode: "cinematic" | "balanced" | "performance") => void;
  webglSupported: boolean;
  setWebglSupported: (v: boolean) => void;
  reducedMotion: boolean;
  setReducedMotion: (v: boolean) => void;
}

export const usePerformanceStore = create<PerformanceState>((set) => ({
  effective: "cinematic",
  webglSupported: true,
  reducedMotion: false,
  setEffective: (effective) => set({ effective }),
  setWebglSupported: (webglSupported) => set({ webglSupported }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
}));

export function resolveCinematicDefault(opts: {
  reducedMotion: boolean;
  webgl: boolean;
}): "cinematic" | "performance" {
  if (opts.reducedMotion || !opts.webgl) return "performance";
  return "cinematic";
}

export function isLowEndDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  if (nav.deviceMemory != null && nav.deviceMemory <= 4) return true;
  if (nav.hardwareConcurrency != null && nav.hardwareConcurrency <= 4) {
    return true;
  }
  const et = nav.connection?.effectiveType;
  if (et === "slow-2g" || et === "2g") return true;
  return false;
}

export function detectWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

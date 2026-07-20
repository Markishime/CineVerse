"use client";

import { useEffect, useRef } from "react";

/**
 * Autoplaying, muted, looped chapter video.
 * Pauses when off-screen to save battery on mid-range devices.
 */
export function ScrollVideoBg({
  src,
  poster,
  active,
  reduced,
}: {
  src: string;
  poster: string;
  active: boolean;
  reduced: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    if (active) {
      el.play().catch(() => {
        /* autoplay policies */
      });
    } else {
      el.pause();
    }
  }, [active, reduced]);

  if (reduced) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={poster}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
    );
  }

  return (
    <video
      ref={ref}
      className="absolute inset-0 h-full w-full object-cover scale-105"
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden
    />
  );
}

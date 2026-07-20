"use client";

import { useEffect, useRef } from "react";

interface HlsPlayerProps {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  onProgress?: (seconds: number) => void;
  onComplete?: () => void;
  className?: string;
}

/**
 * HLS / progressive player for CineVerse-owned or licensed assets only.
 * Uses short-lived signed URLs from the playback session API — never TMDB.
 */
export function HlsPlayer({
  src,
  poster,
  autoPlay = true,
  onProgress,
  onComplete,
  className,
}: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let hls: { destroy: () => void } | null = null;
    let destroyed = false;

    void (async () => {
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        return;
      }
      try {
        const Hls = (await import("hls.js")).default;
        if (destroyed || !Hls.isSupported()) {
          if (!destroyed) video.src = src;
          return;
        }
        const instance = new Hls({ enableWorker: true });
        instance.loadSource(src);
        instance.attachMedia(video);
        instance.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) {
            console.error("Fatal HLS playback error:", data);
            instance.destroy();
          }
        });
        hls = instance;
      } catch {
        if (!destroyed) video.src = src;
      }
    })();

    return () => {
      destroyed = true;
      hls?.destroy();
    };
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTime = () => {
      if (onProgress) onProgress(video.currentTime);
    };
    const onEnded = () => onComplete?.();

    // Throttle progress via interval rather than every frame
    let timer: number | null = null;
    if (onProgress) {
      timer = window.setInterval(onTime, 10_000);
    }
    video.addEventListener("ended", onEnded);
    return () => {
      if (timer != null) window.clearInterval(timer);
      video.removeEventListener("ended", onEnded);
    };
  }, [onProgress, onComplete, src]);

  return (
    <video
      ref={videoRef}
      className={className ?? "absolute inset-0 h-full w-full bg-black"}
      controls
      controlsList="nodownload"
      playsInline
      autoPlay={autoPlay}
      poster={poster}
      preload="metadata"
    >
      Your browser does not support video playback.
    </video>
  );
}

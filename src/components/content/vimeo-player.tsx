"use client";

import { useEffect, useRef } from "react";

interface VimeoPlayerProps {
  videoId: string | number;
  onProgress?: (seconds: number) => void;
  onComplete?: () => void;
  className?: string;
}

/**
 * Vimeo embed for CineVerse-owned or licensed uploads only.
 * Uses official iframe embed (no stream scraping).
 * Optional @vimeo/player can be added later for richer events.
 */
export function VimeoPlayer({
  videoId,
  onProgress,
  onComplete,
  className,
}: VimeoPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Lightweight progress via postMessage when available
    function onMessage(event: MessageEvent) {
      if (!event.origin.includes("vimeo.com")) return;
      try {
        const data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.event === "timeupdate" && onProgress) {
          const sec = data?.data?.seconds;
          if (typeof sec === "number") onProgress(sec);
        }
        if (data?.event === "finish" || data?.event === "ended") {
          onComplete?.();
        }
      } catch {
        // ignore non-JSON messages
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onProgress, onComplete]);

  const id = String(videoId).replace(/[^\d]/g, "");
  if (!id) return null;

  return (
    <iframe
      ref={iframeRef}
      title="Vimeo legal playback"
      src={`https://player.vimeo.com/video/${id}?autoplay=1&title=0&byline=0&portrait=0`}
      className={className ?? "absolute inset-0 h-full w-full"}
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
    />
  );
}

"use client";

import { useEffect, useRef } from "react";
import YouTube, { type YouTubeEvent, type YouTubeProps } from "react-youtube";

interface YouTubeMoviePlayerProps {
  videoId: string;
  title: string;
  autoplay?: boolean;
  onProgress?: (seconds: number) => void;
  onComplete?: () => void;
  className?: string;
}

/**
 * Official YouTube IFrame player for legal full films / trailers.
 * Never downloads or proxies the stream — embed only.
 */
export function YouTubeMoviePlayer({
  videoId,
  title,
  autoplay = true,
  onProgress,
  onComplete,
  className,
}: YouTubeMoviePlayerProps) {
  const progressTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (progressTimer.current != null) {
        window.clearInterval(progressTimer.current);
      }
    };
  }, []);

  const options: YouTubeProps["opts"] = {
    width: "100%",
    height: "100%",
    playerVars: {
      autoplay: autoplay ? 1 : 0,
      controls: 1,
      playsinline: 1,
      rel: 0,
      modestbranding: 1,
    },
  };

  function clearProgress() {
    if (progressTimer.current != null) {
      window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  }

  function handleStateChange(event: YouTubeEvent<number>) {
    const player = event.target;
    // YT.PlayerState.PLAYING = 1, ENDED = 0
    if (event.data === 1 && onProgress) {
      clearProgress();
      progressTimer.current = window.setInterval(() => {
        try {
          const currentTime = player.getCurrentTime?.();
          if (typeof currentTime === "number") onProgress(currentTime);
        } catch {
          clearProgress();
        }
      }, 10_000);
    } else if (event.data !== 1) {
      clearProgress();
    }

    if (event.data === 0) {
      onComplete?.();
    }
  }

  return (
    <div
      className={
        className ??
        "absolute inset-0 h-full w-full overflow-hidden bg-black [&_iframe]:h-full [&_iframe]:w-full"
      }
    >
      <YouTube
        videoId={videoId}
        title={title}
        opts={options}
        onStateChange={handleStateChange}
        className="h-full w-full"
        iframeClassName="h-full w-full"
      />
    </div>
  );
}

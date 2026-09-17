"use client";

import { useEffect, useRef, useState } from "react";
import type { SubtitleTrack } from "@/lib/playback/subtitles";

interface HlsPlayerProps {
  src: string;
  subtitles?: SubtitleTrack[];
  poster?: string;
  autoPlay?: boolean;
  onProgress?: (seconds: number) => void;
  onComplete?: () => void;
  className?: string;
}

export function HlsPlayer(props: HlsPlayerProps) {
  return <AssetPlayer key={props.src} {...props} />;
}

function AssetPlayer({ src, subtitles = [], poster, autoPlay = true, onProgress, onComplete, className }: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    let disposed = false;
    let hls: { destroy: () => void } | undefined;
    const start = () => { if (autoPlay) void video.play().catch(() => { /* Autoplay denial leaves native controls available. */ }); };
    const isHls = /\.m3u8(?:[?#]|$)/i.test(src);
    if (!isHls || video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.addEventListener("loadedmetadata", start, { once: true });
    } else {
      void import("hls.js").then(({ default: Hls }) => {
        if (disposed) return;
        if (!Hls.isSupported()) { setError(true); return; }
        const instance = new Hls({ enableWorker: true, maxBufferLength: 30, backBufferLength: 30 });
        hls = instance;
        let networkRetries = 0;
        let mediaRetries = 0;
        instance.on(Hls.Events.MANIFEST_PARSED, start);
        instance.on(Hls.Events.ERROR, (_, data) => {
          if (!data.fatal || disposed) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries++ < 2) instance.startLoad();
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetries++ < 1) instance.recoverMediaError();
          else { instance.destroy(); setError(true); }
        });
        instance.loadSource(src);
        instance.attachMedia(video);
      }).catch(() => { if (!disposed) setError(true); });
    }
    return () => {
      disposed = true;
      video.removeEventListener("loadedmetadata", start);
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [src, autoPlay, attempt]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onProgress) return;
    const report = () => { if (video.currentTime > 0) onProgress(video.currentTime); };
    const timer = window.setInterval(report, 10_000);
    video.addEventListener("pause", report);
    return () => { clearInterval(timer); video.removeEventListener("pause", report); };
  }, [onProgress]);

  return <>
    <video ref={videoRef} className={className ?? "absolute inset-0 h-full w-full bg-black"}
      controls playsInline autoPlay={autoPlay} poster={poster} preload="metadata"
      crossOrigin={subtitles.length ? "anonymous" : undefined}
      onError={() => setError(true)} onEnded={onComplete}>
      {subtitles.map((track, index) => <track key={`${track.src}-${track.srcLang}`} kind="subtitles"
        src={track.src} srcLang={track.srcLang} label={track.label}
        default={Boolean(track.default && subtitles.findIndex((t) => t.default) === index)} />)}
      Your browser does not support video playback.
    </video>
    {error && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[var(--background)]/95 p-6 text-center">
      <p>This video could not be loaded. The source may be temporarily unavailable.</p>
      <button className="rounded-full border border-white/20 px-5 py-2 focus-visible:outline-2" onClick={() => { setError(false); setAttempt((n) => n + 1); }}>Retry video</button>
    </div>}
  </>;
}

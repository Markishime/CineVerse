"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Loader2,
  MonitorPlay,
  RefreshCw,
  Server,
  X,
} from "lucide-react";
import {
  type EmbedProviderId,
  EMBED_PROVIDERS,
  getProvidersForContentType,
  buildEmbedUrl,
} from "@/lib/embed/providers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

interface VideoPlayerProps {
  tmdbId: number;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
  title: string;
  originalLanguage?: string;
  contentType?: string;
  autoPlay?: boolean;
  className?: string;
  onProviderLoad?: (providerId: EmbedProviderId) => void;
  onAllFailed?: () => void;
}

type PlayerStatus = "loading" | "loaded" | "error" | "all_failed";

/**
 * Smart video player with:
 * - Automatic fallback between 7 providers (anime-optimized: autoembed → vidsrc → vidcore → multiembed)
 * - Server switcher for manual provider selection
 * - 8-second load timeout per provider before auto-advancing
 * - Content-type aware provider ordering (anime-first for anime content)
 */
export function VideoPlayer({
  tmdbId,
  mediaType,
  season,
  episode,
  title,
  originalLanguage,
  contentType = "series",
  autoPlay = true,
  className,
  onProviderLoad,
  onAllFailed,
}: VideoPlayerProps) {
  const settings = useAuthStore((s) => s.settings);
  const availableProviders = getProvidersForContentType(contentType, mediaType);
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState<PlayerStatus>("loading");
  const [showMenu, setShowMenu] = useState(false);
  const [triedProviders, setTriedProviders] = useState<EmbedProviderId[]>([]);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeProvider = availableProviders[activeIndex];

  // Determine the effective language: originalLanguage > user preference by content type > "en"
  const effectiveLanguage = (() => {
    if (originalLanguage) return originalLanguage;
    if (!settings) return "en";
    const ct = contentType.toLowerCase();
    if (ct.includes("anime")) return settings.animeAudioLanguage ?? "ja";
    if (ct.includes("kdrama") || ct.includes("korean"))
      return settings.kdramaAudioLanguage ?? "ko";
    return settings.generalAudioLanguage ?? "en";
  })();

  const embedUrl =
    activeProvider && season && episode
      ? buildEmbedUrl(activeProvider.id, tmdbId, mediaType, season, episode, { language: effectiveLanguage })
      : activeProvider
        ? buildEmbedUrl(activeProvider.id, tmdbId, mediaType, undefined, undefined, { language: effectiveLanguage })
        : null;

  // Load timeout: auto-advance if iframe doesn't fire onLoad within 8s
  useEffect(() => {
    if (status !== "loading" || !embedUrl) return;

    loadTimerRef.current = setTimeout(() => {
      setStatus("error");
      setTriedProviders((prev) =>
        prev.includes(activeProvider.id) ? prev : [...prev, activeProvider.id],
      );
      setActiveIndex((prev) => {
        const next = prev + 1;
        if (next >= availableProviders.length) {
          onAllFailed?.();
          return prev;
        }
        return next;
      });
      setStatus(() =>
        activeIndex + 1 >= availableProviders.length ? "all_failed" : "loading",
      );
    }, 8000);

    return () => {
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    };
  }, [status, embedUrl, activeProvider?.id, activeIndex, availableProviders.length, onAllFailed]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showMenu]);

  const handleIframeLoad = () => {
    if (loadTimerRef.current) {
      clearTimeout(loadTimerRef.current);
      loadTimerRef.current = null;
    }
    setStatus("loaded");
    setTriedProviders((prev) =>
      prev.includes(activeProvider.id) ? prev : [...prev, activeProvider.id],
    );
    onProviderLoad?.(activeProvider.id);
  };

  const handleIframeError = () => {
    if (loadTimerRef.current) {
      clearTimeout(loadTimerRef.current);
      loadTimerRef.current = null;
    }
    setStatus("error");
    setTriedProviders((prev) =>
      prev.includes(activeProvider.id) ? prev : [...prev, activeProvider.id],
    );
    setActiveIndex((prev) => {
      const next = prev + 1;
      if (next >= availableProviders.length) {
        onAllFailed?.();
        return prev;
      }
      return next;
    });
    setStatus(() =>
      activeIndex + 1 >= availableProviders.length ? "all_failed" : "loading",
    );
  };

  const switchTo = (index: number) => {
    if (index === activeIndex) return;
    setActiveIndex(index);
    setStatus("loading");
    setShowMenu(false);
  };

  const retry = () => {
    setStatus("loading");
  };

  const retryAll = () => {
    setActiveIndex(0);
    setStatus("loading");
    setTriedProviders([]);
  };

  return (
    <div className={cn("relative", className)}>
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
        {/* Loading overlay */}
        {status === "loading" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/90">
            <Loader2 className="h-10 w-10 animate-spin text-[var(--primary)]" />
            <p className="text-sm text-white">
              Loading from{" "}
              <span className="font-semibold text-[var(--primary-light)]">
                {activeProvider?.name}
              </span>
              ...
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Provider {activeIndex + 1} of {availableProviders.length}
            </p>
          </div>
        )}

        {/* All providers failed */}
        {status === "all_failed" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-black/95 to-[var(--surface)]/90 p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--danger)]/15">
              <AlertTriangle className="h-8 w-8 text-[var(--danger)]" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-white">
                All servers unavailable
              </p>
              <p className="mt-1 max-w-sm text-sm text-[var(--text-secondary)]">
                None of the streaming providers could load this title right now.
                This is usually temporary — try again in a few moments.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={retryAll}>
                <RefreshCw className="h-4 w-4" />
                Try all servers
              </Button>
              <Button variant="secondary" onClick={retry}>
                Retry current
              </Button>
            </div>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Attempted:{" "}
              {triedProviders
                .map(
                  (id) =>
                    EMBED_PROVIDERS.find((p) => p.id === id)?.name ?? id,
                )
                .join(", ")}
            </p>
          </div>
        )}

        {/* Embed iframe — provider change triggers reload */}
        {embedUrl && (
          <iframe
            key={`${activeProvider?.id}-${tmdbId}-${season}-${episode}`}
            title={title}
            src={`${embedUrl}${embedUrl.includes("?") ? "&" : "?"}${autoPlay ? "autoplay=1&" : ""}rd=0&tm=1`}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            style={{ display: status === "loading" ? "none" : "block" }}
          />
        )}
      </div>

      {/* Controls bar */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {status === "loaded" && (
            <Badge tone="primary">
              <MonitorPlay className="mr-1 h-3 w-3" />
              {activeProvider?.name}
            </Badge>
          )}
          {status === "loading" && activeProvider && (
            <Badge tone="muted">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              {activeProvider.name}
            </Badge>
          )}
          {status === "error" && (
            <Badge tone="accent">
              <AlertTriangle className="mr-1 h-3 w-3" />
              {activeProvider?.name} failed
            </Badge>
          )}
          {status === "all_failed" && (
            <Badge tone="accent">
              <X className="mr-1 h-3 w-3" />
              All servers down
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {(status === "error" || status === "all_failed") && (
            <Button size="sm" variant="secondary" onClick={retry}>
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          )}

          {/* Server switcher dropdown */}
          <div className="relative" ref={menuRef}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowMenu(!showMenu)}
            >
              <Server className="h-3.5 w-3.5" />
              Change Server
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform",
                  showMenu && "rotate-180",
                )}
              />
            </Button>
            {showMenu && (
              <div className="absolute right-0 z-50 mt-1 w-56 overflow-hidden rounded-xl border border-white/10 bg-[var(--surface-elevated)] shadow-2xl">
                <div className="border-b border-white/10 px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Streaming Servers
                  </p>
                </div>
                {availableProviders.map((provider, i) => {
                  const isActive = i === activeIndex;
                  const wasTried = triedProviders.includes(provider.id);
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => switchTo(i)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors",
                        isActive
                          ? "bg-[var(--primary)]/15 text-[var(--primary-light)]"
                          : "text-white hover:bg-white/5",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          isActive
                            ? "bg-[var(--primary)] text-white"
                            : wasTried
                              ? "bg-white/10 text-[var(--text-muted)]"
                              : "bg-white/5 text-white",
                        )}
                      >
                        {isActive ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          i + 1
                        )}
                      </span>
                      <span className="flex-1">{provider.name}</span>
                      {isActive && (
                        <Badge tone="primary" className="text-[10px]">
                          Active
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

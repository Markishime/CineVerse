"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  type AnimeStreamIds,
  EMBED_PROVIDERS,
  getProvidersForContentType,
  buildEmbedUrl,
  buildAnimeEmbedUrl,
  getProviderName,
} from "@/lib/embed/providers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

interface VideoPlayerProps {
  tmdbId?: number;
  mediaType: "movie" | "tv";
  season?: number;
  episode?: number;
  title: string;
  originalLanguage?: string;
  contentType?: string;
  /** AniList media id — preferred for anime backends */
  anilistId?: number;
  /** MyAnimeList id */
  malId?: number;
  animeFormat?: string;
  year?: number | null;
  autoPlay?: boolean;
  className?: string;
  onProviderLoad?: (providerId: EmbedProviderId) => void;
  onAllFailed?: () => void;
}

type PlayerStatus = "loading" | "loaded" | "error" | "all_failed";

/**
 * Smart video player with multi-provider fallback.
 * Anime: Cinezo → ScreenScape → AnimePahe → DropFile → ezvidapi → SupaPlay
 *         (+ TMDB general embeds when a TMDB id exists)
 * Others: AutoEmbed → VidCore → 2Embed
 */
export function VideoPlayer({
  tmdbId,
  mediaType,
  season,
  episode,
  title,
  originalLanguage,
  contentType = "series",
  anilistId,
  malId,
  animeFormat,
  year,
  autoPlay = true,
  className,
  onProviderLoad,
  onAllFailed,
}: VideoPlayerProps) {
  const settings = useAuthStore((s) => s.settings);
  const isAnime = contentType === "anime";

  // Auto-detect drama type from original language when not already set.
  // This ensures regional movies/series use drama-specific embed providers
  // (DramaPlay, KissKH) even when the caller passes contentType="movie".
  const resolvedContentType = (() => {
    if (isAnime || contentType === "anime") return contentType;
    if (
      contentType !== "movie" &&
      contentType !== "series" &&
      contentType !== "kdrama" &&
      contentType !== "cdrama" &&
      contentType !== "jdrama" &&
      contentType !== "thaidrama"
    ) {
      return contentType;
    }
    // Already a drama type — keep it
    if (
      contentType === "kdrama" ||
      contentType === "cdrama" ||
      contentType === "jdrama" ||
      contentType === "thaidrama"
    ) {
      return contentType;
    }
    // Detect from language
    const lang = (originalLanguage ?? "").toLowerCase();
    if (lang === "ko") return "kdrama";
    if (lang === "zh" || lang === "cn") return "cdrama";
    if (lang === "ja") return "jdrama";
    if (lang === "th") return "thaidrama";
    return contentType;
  })();

  const availableProviders = getProvidersForContentType(resolvedContentType, mediaType);
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState<PlayerStatus>("loading");
  const [showMenu, setShowMenu] = useState(false);
  const [triedProviders, setTriedProviders] = useState<EmbedProviderId[]>([]);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeProvider = availableProviders[activeIndex];

  const effectiveLanguage = (() => {
    // The user's audio-language setting is an explicit preference and must win
    // over the content's original language (otherwise picking "English dub"
    // for anime does nothing because originalLanguage is always "ja").
    const ct = resolvedContentType.toLowerCase();
    if (settings) {
      if (ct.includes("anime")) {
        return settings.animeAudioLanguage || originalLanguage || "ja";
      }
      if (
        ct.includes("kdrama") ||
        ct.includes("cdrama") ||
        ct.includes("jdrama") ||
        ct.includes("thaidrama") ||
        ct.includes("korean")
      ) {
        return settings.kdramaAudioLanguage || originalLanguage || "ko";
      }
      return settings.generalAudioLanguage || originalLanguage || "en";
    }
    // No settings loaded yet — fall back to the content's own language.
    if (originalLanguage) return originalLanguage;
    return isAnime ? "ja" : "en";
  })();

  const preferDub =
    effectiveLanguage === "en" || effectiveLanguage.startsWith("en-");

  const animeIds: AnimeStreamIds = {
    title,
    anilist: anilistId,
    mal: malId,
    tmdb: tmdbId,
    tmdbMediaType: mediaType,
    episode:
      animeFormat === "MOVIE" || mediaType === "movie"
        ? 1
        : Math.max(1, episode ?? 1),
    season: Math.max(1, season ?? 1),
    animeFormat,
    language: effectiveLanguage,
    dub: preferDub,
  };

  // Sync embed URL (or null when provider needs async resolve)
  const staticEmbedUrl = (() => {
    if (!activeProvider) return null;
    if (isAnime) {
      if (activeProvider.needsResolve) return null;
      return buildAnimeEmbedUrl(activeProvider.id, animeIds, {
        language: effectiveLanguage,
        dub: preferDub,
        autoplay: autoPlay,
      });
    }
    if (!tmdbId) return null;
    if (mediaType === "tv" && season && episode) {
      return buildEmbedUrl(
        activeProvider.id,
        tmdbId,
        "tv",
        season,
        episode,
        { language: effectiveLanguage },
      );
    }
    return buildEmbedUrl(activeProvider.id, tmdbId, "movie", undefined, undefined, {
      language: effectiveLanguage,
    });
  })();

  const embedUrl = resolvedUrl ?? staticEmbedUrl;

  // Async resolve for AnimePahe / SupaPlay
  useEffect(() => {
    setResolvedUrl(null);
    if (!activeProvider?.needsResolve || !isAnime) return;

    let cancelled = false;
    setStatus("loading");

    (async () => {
      try {
        if (activeProvider.id === "animepahe") {
          const params = new URLSearchParams({
            provider: "animepahe",
            title,
            episode: String(animeIds.episode ?? 1),
          });
          if (year) params.set("year", String(year));
          if (anilistId) params.set("anilist", String(anilistId));
          const res = await fetch(
            `/api/v1/playback/anime-embed?${params.toString()}`,
          );
          if (!res.ok) throw new Error("resolve failed");
          const data = (await res.json()) as { ok?: boolean; url?: string };
          if (!cancelled && data.url) {
            setResolvedUrl(data.url);
            return;
          }
        }
        // SupaPlay and other session-based backends: skip if unresolved
        if (!cancelled) {
          setStatus("error");
          setTriedProviders((prev) =>
            prev.includes(activeProvider.id)
              ? prev
              : [...prev, activeProvider.id],
          );
          setActiveIndex((prev) => {
            const next = prev + 1;
            if (next >= availableProviders.length) {
              onAllFailed?.();
              return prev;
            }
            return next;
          });
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setTriedProviders((prev) =>
            prev.includes(activeProvider.id)
              ? prev
              : [...prev, activeProvider.id],
          );
          setActiveIndex((prev) => {
            const next = prev + 1;
            if (next >= availableProviders.length) {
              onAllFailed?.();
              return prev;
            }
            return next;
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProvider?.id, isAnime, title, anilistId, animeIds.episode, year]);

  // When static URL is missing (and not resolving), advance
  useEffect(() => {
    if (!activeProvider) return;
    if (activeProvider.needsResolve) return;
    if (staticEmbedUrl) return;
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
  }, [
    activeProvider,
    staticEmbedUrl,
    availableProviders.length,
    onAllFailed,
  ]);

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
    }, 10_000);

    return () => {
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    };
  }, [
    status,
    embedUrl,
    activeProvider?.id,
    activeIndex,
    availableProviders.length,
    onAllFailed,
  ]);

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

  const handleIframeLoad = useCallback(() => {
    if (loadTimerRef.current) {
      clearTimeout(loadTimerRef.current);
      loadTimerRef.current = null;
    }
    setStatus("loaded");
    setTriedProviders((prev) =>
      prev.includes(activeProvider.id) ? prev : [...prev, activeProvider.id],
    );
    onProviderLoad?.(activeProvider.id);
  }, [activeProvider?.id, onProviderLoad]);

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
    setResolvedUrl(null);
    setShowMenu(false);
  };

  const retry = () => {
    setResolvedUrl(null);
    setStatus("loading");
  };

  const retryAll = () => {
    setActiveIndex(0);
    setStatus("loading");
    setTriedProviders([]);
    setResolvedUrl(null);
  };

  const iframeSrc = embedUrl
    ? `${embedUrl}${embedUrl.includes("?") ? "&" : "?"}${autoPlay ? "autoplay=1&" : ""}rd=0`
    : null;

  return (
    <div className={cn("relative", className)}>
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
        {status === "loading" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/90 px-4">
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
              {isAnime ? " · anime sources" : ""}
            </p>
            <p className="max-w-xs text-center text-[11px] leading-relaxed text-[var(--text-muted)]">
              Some servers take a few seconds. If this one fails, use{" "}
              <span className="text-white/80">Servers</span> to switch.
            </p>
          </div>
        )}

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
              {triedProviders.map((id) => getProviderName(id)).join(", ")}
            </p>
          </div>
        )}

        {iframeSrc && (
          <iframe
            key={`${activeProvider?.id}-${tmdbId}-${anilistId}-${season}-${episode}-${iframeSrc}`}
            title={title}
            src={iframeSrc}
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
              <X className="mr-1 h-3 w-3" />
              Switching server…
            </Badge>
          )}
          {isAnime && (
            <Badge tone="muted">
              {animeFormat === "MOVIE" ? "Anime film" : "Anime"}
            </Badge>
          )}
        </div>

        <div className="relative" ref={menuRef}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowMenu((v) => !v)}
            aria-expanded={showMenu}
          >
            <Server className="h-4 w-4" />
            Servers
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          {showMenu && (
            <div className="absolute right-0 z-20 mt-1 min-w-[12rem] overflow-hidden rounded-xl border border-white/10 bg-[var(--surface)] py-1 shadow-xl">
              {availableProviders.map((p, i) => {
                const tried = triedProviders.includes(p.id);
                const active = i === activeIndex;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                      active
                        ? "bg-[var(--primary)]/20 text-white"
                        : "text-[var(--text-secondary)] hover:bg-white/5 hover:text-white",
                    )}
                    onClick={() => switchTo(i)}
                  >
                    {active ? (
                      <Check className="h-3.5 w-3.5 text-[var(--primary-light)]" />
                    ) : tried ? (
                      <X className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                    ) : (
                      <span className="w-3.5" />
                    )}
                    {p.name}
                    {p.animeOnly && (
                      <span className="ml-auto text-[10px] text-[var(--text-muted)]">
                        anime
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Always visible so users know to try another server if load stalls */}
      <div
        role="note"
        className="mt-3 flex gap-2.5 rounded-xl border border-[var(--gold)]/25 bg-[var(--gold)]/8 px-3.5 py-3 text-left"
      >
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]"
          aria-hidden
        />
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--gold)]">
            Important Notice
          </p>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            If the current server does not work, switch to another server. Some
            servers may take a few seconds to load.
          </p>
        </div>
      </div>
    </div>
  );
}

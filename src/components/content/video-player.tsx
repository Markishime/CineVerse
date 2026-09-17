"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  getProvidersForContentType,
  buildEmbedUrl,
  buildAnimeEmbedUrl,
} from "@/lib/embed/providers";
import { EMBED_ALLOW } from "@/lib/embed/ad-shield";
import {
  isFilipinoLocale,
  preferDubForLanguage,
  resolveEmbedLanguage,
  toStreamHostLanguage,
} from "@/lib/embed/language";
import { useEmbedAdShield } from "@/hooks/use-embed-ad-shield";
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
  /** ISO country codes from catalog / TMDB (e.g. KR, JP, CN) */
  countries?: string[];
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
 * Default chain (all types): VidFast → AutoEmbed → VidSrc → …
 */
export function VideoPlayer({
  tmdbId,
  mediaType,
  season,
  episode,
  title,
  originalLanguage,
  countries,
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
  // Parent-level popup blocker only — never sandbox the iframe (breaks all providers)
  useEmbedAdShield(true);

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
    // Detect from language / country
    const lang = (originalLanguage ?? "").toLowerCase();
    if (lang === "ko" || countries?.some((c) => c.toUpperCase() === "KR"))
      return "kdrama";
    if (
      lang === "zh" ||
      lang === "cn" ||
      countries?.some((c) => ["CN", "TW", "HK"].includes(c.toUpperCase()))
    )
      return "cdrama";
    if (lang === "ja" || countries?.some((c) => c.toUpperCase() === "JP"))
      return "jdrama";
    if (lang === "th" || countries?.some((c) => c.toUpperCase() === "TH"))
      return "thaidrama";
    return contentType;
  })();

  // Anime series always use TV embeds — never movie (Demon Slayer wrong-film bug)
  const embedMediaType: "movie" | "tv" =
    isAnime && animeFormat !== "MOVIE" ? "tv" : mediaType;

  const availableProviders = useMemo(
    () =>
      getProvidersForContentType(
        resolvedContentType,
        embedMediaType,
        {
          tmdb: tmdbId,
          anilist: anilistId,
          mal: malId,
          animeFormat,
          countries,
          originalLanguage,
        },
        Math.max(1, season ?? 1),
        Math.max(1, episode ?? 1),
      ),
    [
      resolvedContentType,
      embedMediaType,
      tmdbId,
      anilistId,
      malId,
      animeFormat,
      countries,
      originalLanguage,
      season,
      episode,
    ],
  );
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [status, setStatus] = useState<PlayerStatus>("loading");
  const [showMenu, setShowMenu] = useState(false);
  const [triedProviders, setTriedProviders] = useState<EmbedProviderId[]>([]);
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  // Post-load verification: the iframe's onLoad fires when the provider's HTML
  // shell loads, NOT when a real video stream resolves inside it. Many hosts
  // load a shell for a title they don't actually have (common for regional
  // catalogs like Korean films), leaving a black player. We wait for a positive
  // playback signal after onLoad; if none arrives we auto-advance.
  const verifyTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [confirmedPlaying, setConfirmedPlaying] = useState(false);
  const confirmedRef = useRef(false);
  // When the user manually picks a server we must NOT auto-advance away from it.
  const userPickedRef = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const skipLockRef = useRef(false);

  // Reset to first playable provider when the title / id set changes.
  const identityKey = [
    tmdbId,
    anilistId,
    malId,
    resolvedContentType,
    season,
    episode,
  ].join("|");
  const [prevIdentityKey, setPrevIdentityKey] = useState(identityKey);
  if (prevIdentityKey !== identityKey) {
    setPrevIdentityKey(identityKey);
    setActiveIndex(0);
    setStatus("loading");
    setTriedProviders([]);
    setResolvedUrl(null);
    setShowMenu(false);
    setConfirmedPlaying(false);
  }

  // Clamp the menu selection if a provider list shrinks under it.
  const activeProvider =
    availableProviders.length > 0 && activeIndex >= availableProviders.length
      ? availableProviders[0]
      : availableProviders[activeIndex];

  // Drop a previously-resolved async stream when the active provider changes.
  const activeProviderId = activeProvider?.id ?? "";
  const [prevActiveProviderId, setPrevActiveProviderId] =
    useState(activeProviderId);
  if (prevActiveProviderId !== activeProviderId) {
    setPrevActiveProviderId(activeProviderId);
    setStatus("loading");
    setResolvedUrl(null);
  }

  // Manual-pick / confirmation guards belong to the current identity.
  useEffect(() => {
    confirmedRef.current = false;
    userPickedRef.current = false;
  }, [identityKey]);

  // Clear any pending load/verify timers on unmount.
  useEffect(() => {
    return () => {
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
      if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current);
    };
  }, []);

  /**
   * Origin language for UI (KR→ko, JP→ja, PH→tl, …).
   * Stream hosts get a host-safe code via toStreamHostLanguage (tl→en) so
   * Filipino titles still play on AutoEmbed / VidFast.
   */
  const originLanguage = (() => {
    const origin = resolveEmbedLanguage({
      originalLanguage,
      contentType: resolvedContentType,
      countries,
    });

    // Anime only: allow explicit user audio preference (sub ja vs dub en)
    if (isAnime && settings?.animeAudioLanguage) {
      const pref = settings.animeAudioLanguage.toLowerCase();
      if (pref && pref !== origin) {
        return resolveEmbedLanguage({
          originalLanguage,
          contentType: resolvedContentType,
          countries,
          userPreference: settings.animeAudioLanguage,
          allowUserOverride: true,
        });
      }
    }

    return origin;
  })();

  // What we send to AutoEmbed / VidFast / VidSrc as lang=
  const effectiveLanguage = toStreamHostLanguage(originLanguage, countries);
  const isFilipino = isFilipinoLocale({
    originalLanguage: originalLanguage ?? originLanguage,
    countries,
  });

  const preferDub = preferDubForLanguage(effectiveLanguage);

  const animeIds: AnimeStreamIds = {
    title,
    anilist: anilistId,
    mal: malId,
    tmdb: tmdbId,
    // Series anime always "tv" so AutoEmbed doesn't open a random live-action film
    tmdbMediaType: embedMediaType,
    episode:
      animeFormat === "MOVIE" || embedMediaType === "movie"
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
    if (embedMediaType === "tv") {
      return buildEmbedUrl(
        activeProvider.id,
        tmdbId,
        "tv",
        Math.max(1, season ?? 1),
        Math.max(1, episode ?? 1),
        { language: effectiveLanguage, autoplay: autoPlay },
      );
    }
    return buildEmbedUrl(activeProvider.id, tmdbId, "movie", undefined, undefined, {
      language: effectiveLanguage,
      autoplay: autoPlay,
    });
  })();

  const embedUrl = resolvedUrl ?? staticEmbedUrl;

  // Async resolve for AnimePahe / SupaPlay
  useEffect(() => {
    if (!activeProvider?.needsResolve || !isAnime) return;

    let cancelled = false;

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

  // When static URL is missing (and not resolving), advance once
  useEffect(() => {
    if (!activeProvider) return;
    if (activeProvider.needsResolve) return;
    if (staticEmbedUrl) return;
    if (skipLockRef.current) return;
    skipLockRef.current = true;
    setTriedProviders((prev) =>
      prev.includes(activeProvider.id) ? prev : [...prev, activeProvider.id],
    );
    setActiveIndex((prev) => {
      const next = prev + 1;
      if (next >= availableProviders.length) {
        onAllFailed?.();
        setStatus("all_failed");
        return prev;
      }
      return next;
    });
    setStatus("loading");
    // release lock after index has applied
    const t = window.setTimeout(() => {
      skipLockRef.current = false;
    }, 50);
    return () => window.clearTimeout(t);
  }, [
    activeProvider,
    staticEmbedUrl,
    availableProviders.length,
    onAllFailed,
  ]);

  // Longer timeout — don't race into SuperEmbed; user can still switch Servers
  useEffect(() => {
    if (status !== "loading" || !embedUrl || !activeProvider) return;

    loadTimerRef.current = setTimeout(() => {
      setTriedProviders((prev) =>
        prev.includes(activeProvider.id) ? prev : [...prev, activeProvider.id],
      );
      setActiveIndex((prev) => {
        const next = prev + 1;
        if (next >= availableProviders.length) {
          onAllFailed?.();
          setStatus("all_failed");
          return prev;
        }
        setStatus("loading");
        return next;
      });
    }, 10_000);

    return () => {
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current);
    };
  }, [
    status,
    embedUrl,
    activeProvider,
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

  const clearTimers = useCallback(() => {
    if (loadTimerRef.current) {
      clearTimeout(loadTimerRef.current);
      loadTimerRef.current = null;
    }
    if (verifyTimerRef.current) {
      clearTimeout(verifyTimerRef.current);
      verifyTimerRef.current = null;
    }
  }, []);

  /** Advance to the next provider, or land on the no-source terminal state. */
  const advanceToNextProvider = useCallback(() => {
    clearTimers();
    // Each new provider must re-prove itself with a fresh stream signal.
    confirmedRef.current = false;
    setConfirmedPlaying(false);
    const current = availableProviders[activeIndex];
    if (current) {
      setTriedProviders((prev) =>
        prev.includes(current.id) ? prev : [...prev, current.id],
      );
    }
    setActiveIndex((prev) => {
      const next = prev + 1;
      if (next >= availableProviders.length) {
        onAllFailed?.();
        setStatus("all_failed");
        return prev;
      }
      setStatus("loading");
      return next;
    });
  }, [activeIndex, availableProviders, onAllFailed, clearTimers]);

  // Listen for postMessages from provider iframes:
  //  - POSITIVE playback signals confirm a real stream (cancels auto-advance).
  //  - Catalog-miss / error signals trigger an immediate advance.
  // Runs whenever a provider is active (not only after "loaded") so a fast
  // "not found" during loading also advances.
  useEffect(() => {
    if (!activeProvider) return;
    function handleMessage(e: MessageEvent) {
      if (!embedUrl || e.source !== iframeRef.current?.contentWindow || e.origin !== new URL(embedUrl).origin) return;
      const data = e.data;
      const raw =
        typeof data === "string"
          ? data
          : typeof data?.type === "string"
            ? data.type
            : typeof data?.event === "string"
              ? data.event
              : "";
      const msg = raw.toLowerCase();
      if (!msg) return;

      // Positive evidence the provider actually RESOLVED this title's stream.
      // Verified against live hosts: AutoEmbed emits {"type":"PLAYER_TITLE",...}
      // only when the movie resolves (a title it lacks never sends it, only ad
      // chatter). Also honor real HTML5 media events some players forward.
      if (
        msg.includes("timeupdate") ||
        msg.includes("playing") ||
        msg.includes("mediaplay") ||
        msg === "play"
      ) {
        confirmedRef.current = true;
        setConfirmedPlaying(true);
        clearTimers();
        setStatus("loaded");
        return;
      }

      // Catalog-miss / hard errors — advance now.
      if (
        msg.includes("content not found") ||
        msg.includes("not available") ||
        msg.includes("no results") ||
        msg.includes("no source") ||
        msg.includes("no sources") ||
        msg.includes("nosource") ||
        msg.includes("not found") ||
        (msg.includes("404") && msg.includes("content")) ||
        msg.includes("mediaerror") ||
        msg.includes("fatal")
      ) {
        advanceToNextProvider();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [activeProvider, embedUrl, advanceToNextProvider, clearTimers]);

  const handleIframeLoad = useCallback(() => {
    if (loadTimerRef.current) {
      clearTimeout(loadTimerRef.current);
      loadTimerRef.current = null;
    }
    // Shell loaded — keep it. IMPORTANT: absence of a postMessage does NOT mean
    // failure. Many hosts that play perfectly are cross-origin and never
    // postMessage the parent (verified: Videasy/111Movies stream Korean films
    // via a <video> with no parent signal). Auto-advancing on "no positive
    // signal" was skipping these working providers and landing on a blank host.
    // We now advance ONLY on an explicit negative signal (handled in the
    // message listener) or a total no-load (the load-timeout effect). A play/
    // PLAYER_TITLE signal, when a host does send one, upgrades the badge to the
    // confirmed-playing state but is not required to keep the provider.
    setStatus("loaded");
    onProviderLoad?.(activeProvider.id);
    setTriedProviders((prev) =>
      prev.includes(activeProvider.id) ? prev : [...prev, activeProvider.id],
    );
  }, [activeProvider, onProviderLoad]);

  const handleIframeError = () => {
    advanceToNextProvider();
  };

  const switchTo = (index: number) => {
    if (index === activeIndex) return;
    clearTimers();
    skipLockRef.current = false;
    userPickedRef.current = true; // respect the manual choice — no auto-advance
    confirmedRef.current = false;
    setConfirmedPlaying(false);
    setActiveIndex(index);
    setStatus("loading");
    setResolvedUrl(null);
    setShowMenu(false);
  };

  const retry = () => {
    clearTimers();
    userPickedRef.current = true;
    confirmedRef.current = false;
    setConfirmedPlaying(false);
    setResolvedUrl(null);
    setStatus("loading");
  };

  const retryAll = () => {
    clearTimers();
    skipLockRef.current = false;
    userPickedRef.current = false; // resume automatic verification/advance
    confirmedRef.current = false;
    setConfirmedPlaying(false);
    setActiveIndex(0);
    setStatus("loading");
    setTriedProviders([]);
    setResolvedUrl(null);
  };

  // Use provider URL as-is. Do NOT inject autoplay/ads/rd — VidFast needs
  // autoPlay=true (camelCase) and junk params break Filipino / regional loads.
  const iframeSrc = embedUrl;

  return (
    <div className={cn("relative isolate", showMenu && "z-50", className)} data-cineverse-player>
      {/* Player frame — overflow clips any embed chrome that tries to spill out */}
      <div className="relative z-0 aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
        {status === "loading" && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/90 px-4">
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
          </div>
        )}

        {status === "all_failed" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-black/95 to-[var(--surface)]/90 p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--danger)]/15">
              <AlertTriangle className="h-8 w-8 text-[var(--danger)]" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-white">
                No playable source found
              </p>
              <p className="mt-1 max-w-sm text-sm text-[var(--text-secondary)]">
                We tried every streaming provider and none had a working stream
                for this title right now. This can happen with newer or regional
                releases. Try again later, or pick a server below to retry
                manually.
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
          </div>
        )}

        {iframeSrc && (
          <iframe
            ref={iframeRef}
            key={`${activeProvider?.id}-${tmdbId}-${anilistId}-${season}-${episode}-${iframeSrc}`}
            title={title}
            src={iframeSrc}
            className="absolute inset-0 h-full w-full border-0"
            allow={EMBED_ALLOW}
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            loading="eager"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            style={{
              opacity: status === "loading" ? 0 : 1,
              WebkitOverflowScrolling: "touch",
              // Keep iframe from eating the Servers controls outside this box
              pointerEvents: status === "all_failed" ? "none" : "auto",
            }}
          />
        )}
      </div>

      <p className="mt-2 text-xs text-[var(--text-muted)]">Subtitles are available in the player’s CC menu when supplied by the source. External players may show ads. If playback does not start, choose another server.</p>

      {/* Controls always above the iframe stacking context */}
      <div className="relative z-30 mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {status === "loaded" && activeProvider && (
            <Badge tone="primary">
              {confirmedPlaying ? (
                <Check className="mr-1 h-3 w-3" />
              ) : (
                <MonitorPlay className="mr-1 h-3 w-3" />
              )}
              {activeProvider.name}
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
          <Badge tone="muted">
            Audio {effectiveLanguage.toUpperCase()}
            {isFilipino && originLanguage !== effectiveLanguage
              ? ` · PH`
              : ""}
          </Badge>
        </div>

        <div className="relative" ref={menuRef}>
          <Button
            variant="secondary"
            size="sm"
            className="relative z-40"
            onClick={() => setShowMenu((v) => !v)}
            aria-expanded={showMenu}
          >
            <Server className="h-4 w-4" />
            Servers
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          {showMenu && (
            <div
              className="scroll-contain absolute right-0 z-50 mt-1 max-h-72 min-w-[14rem] rounded-xl border border-white/10 bg-[var(--surface)] py-1 shadow-2xl"
              data-lenis-prevent
              data-lenis-prevent-wheel
            >
              {availableProviders.map((p, i) => {
                const tried = triedProviders.includes(p.id);
                const active = i === activeIndex;
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors",
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

      <div
        role="note"
        className="mt-3 flex gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-left"
      >
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-muted)]"
          aria-hidden
        />
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-muted)]">
            Playback tip
          </p>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            If the current server does not work, switch with{" "}
            <span className="text-white/80">Servers</span>. Parent popups from
            this page are blocked — stay on this tab to watch.
          </p>
        </div>
      </div>
    </div>
  );
}

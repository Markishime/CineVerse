"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Film,
  Share2,
  SkipForward,
} from "lucide-react";
import {
  fetchContentBySlug,
  fetchEpisodes,
  fetchPlaybackEligibility,
  fetchRecommendations,
  fetchSeasons,
  fetchTrailers,
} from "@/lib/api/content";
import { MediaPlayer } from "@/components/content/media-player";
import { VideoPlayer } from "@/components/content/video-player";
import { ContentCard } from "@/components/content/content-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { displayTitle, primaryScore } from "@/lib/content/normalize";
import { formatScore } from "@/lib/utils";
import { getDeviceRegion } from "@/lib/user/region";
import { useAuthStore } from "@/stores/auth-store";
import { isMatureEnabledClient } from "@/lib/user/local-profile";
import { isRestrictedContentUser } from "@/lib/content/mature";
import {
  hasParentalPin,
  isMatureSessionUnlocked,
  setMatureSessionUnlocked,
  verifyParentalPin,
} from "@/lib/user/mature-pin";
import { PinGateModal } from "@/components/content/pin-gate";
import { pickOfficialTrailer } from "@/lib/content/trailers";
import { getWatchHref } from "@/lib/content/watch-href";
import {
  continueFromContent,
  saveContinueWatching,
} from "@/lib/content/watch-progress";

/**
 * Full-screen player page for movies / series / anime.
 * Official trailers + rights-approved full sources only.
 */
export function WatchPage({
  slug,
  season: seasonParam,
  episode: episodeParam,
  play,
}: {
  slug: string;
  season?: number;
  episode?: number;
  play?: string;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [deviceMature, setDeviceMature] = useState(false);
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [pinGateOpen, setPinGateOpen] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [embedSeason, setEmbedSeason] = useState<number | null>(null);
  const [embedEpisode, setEmbedEpisode] = useState<number | null>(null);

  useEffect(() => {
    if (isRestrictedContentUser(user?.email)) {
      setPinUnlocked(true);
      setPinGateOpen(false);
      return;
    }
    setDeviceMature(isMatureEnabledClient(user?.uid));
    const unlocked = isMatureSessionUnlocked();
    setPinUnlocked(unlocked);
    if (!unlocked) setPinGateOpen(true);
  }, [user?.uid, user?.email]);

  const matureOn = isRestrictedContentUser(user?.email);

  const { data: content, isLoading, isError } = useQuery({
    queryKey: ["watch-content", slug],
    queryFn: () => fetchContentBySlug(slug),
  });

  // Redirect to /watch/movie|tv/{tmdbId} only when TMDb identity is trusted.
  // Anime without explicit tmdbMediaType stays on slug page (correct embeds).
  useEffect(() => {
    if (!content) return;
    if (play === "trailer") return;
    const tmdbId = content.providerIds?.tmdb;
    if (!tmdbId || !Number.isFinite(tmdbId)) return;

    const mediaType = content.providerIds?.tmdbMediaType;
    const trusted =
      mediaType === "movie" ||
      mediaType === "tv" ||
      content.contentType === "movie" ||
      content.contentType === "series" ||
      content.contentType === "kdrama" ||
      content.contentType === "cdrama" ||
      content.contentType === "jdrama" ||
      content.contentType === "thaidrama";

    if (!trusted) return;

    if (
      mediaType === "movie" ||
      content.contentType === "movie" ||
      content.animeFormat === "MOVIE"
    ) {
      router.replace(`/watch/movie/${tmdbId}`);
      return;
    }

    const sn = seasonParam ?? 1;
    const en = episodeParam ?? 1;
    router.replace(`/watch/tv/${tmdbId}/${sn}/${en}`);
  }, [content, seasonParam, episodeParam, router, play]);

  // Continue watching for slug-based / legal full playback
  useEffect(() => {
    if (!content) return;
    // TV with TMDb is handled on /watch/tv — avoid double-write before redirect
    if (
      content.contentType !== "movie" &&
      content.providerIds?.tmdb
    ) {
      return;
    }
    saveContinueWatching(
      continueFromContent(content, {
        season: seasonParam,
        episode: episodeParam,
        percent: 30,
      }),
      user?.uid,
    );
  }, [content, seasonParam, episodeParam, user?.uid]);

  const contentId = content?.id;

  const { data: playback } = useQuery({
    queryKey: ["watch-playback", contentId],
    queryFn: () => fetchPlaybackEligibility(contentId!, getDeviceRegion("*")),
    enabled: Boolean(contentId),
  });

  const { data: trailersData } = useQuery({
    queryKey: ["watch-trailers", contentId],
    queryFn: () => fetchTrailers(contentId!),
    enabled: Boolean(contentId),
  });

  const { data: seasonsData } = useQuery({
    queryKey: ["watch-seasons", contentId],
    queryFn: () => fetchSeasons(contentId!),
    enabled: Boolean(contentId && content?.contentType !== "movie"),
  });

  const seasons = seasonsData?.seasons ?? [];
  const activeSeasonNum =
    seasonParam ??
    seasons[0]?.seasonNumber ??
    1;
  const activeSeason =
    seasons.find((s) => s.seasonNumber === activeSeasonNum) ?? seasons[0];

  const { data: episodesData } = useQuery({
    queryKey: ["watch-episodes", activeSeason?.id],
    queryFn: () => fetchEpisodes(activeSeason!.id),
    enabled: Boolean(activeSeason?.id),
  });

  const episodes = episodesData?.episodes ?? [];
  const activeEpisodeNum = episodeParam ?? episodes[0]?.episodeNumber ?? 1;
  const activeEpisode =
    episodes.find((e) => e.episodeNumber === activeEpisodeNum) ??
    episodes[0] ??
    null;

  const { data: recs } = useQuery({
    queryKey: ["watch-recs", contentId],
    queryFn: () => fetchRecommendations(contentId!),
    enabled: Boolean(contentId),
  });

  const trailer = useMemo(() => {
    const list = trailersData?.trailers ?? [];
    return (
      pickOfficialTrailer(list, content?.trailer ?? playback?.trailer ?? null) ??
      null
    );
  }, [trailersData, content?.trailer, playback?.trailer]);

  const isSeries = content && content.contentType !== "movie";
  const pathBase = content
    ? encodeURIComponent(content.slug || content.id)
    : "";

  const nextEpisode = useMemo(() => {
    if (!activeEpisode || !episodes.length) return null;
    const idx = episodes.findIndex((e) => e.id === activeEpisode.id);
    if (idx >= 0 && idx < episodes.length - 1) return episodes[idx + 1];
    // Next season episode 1
    const sIdx = seasons.findIndex((s) => s.seasonNumber === activeSeasonNum);
    const nextS = sIdx >= 0 ? seasons[sIdx + 1] : null;
    if (nextS) {
      return {
        seasonNumber: nextS.seasonNumber,
        episodeNumber: 1,
        crossSeason: true as const,
      };
    }
    return null;
  }, [activeEpisode, episodes, seasons, activeSeasonNum]);

  // Auto-play next episode countdown (series only, after full legal play finishes)
  useEffect(() => {
    if (countdown === null || !content) return;
    if (countdown <= 0) {
      if (nextEpisode && "episodeNumber" in nextEpisode) {
        const sn =
          "seasonNumber" in nextEpisode && nextEpisode.seasonNumber
            ? nextEpisode.seasonNumber
            : activeSeasonNum;
        const en =
          "episodeNumber" in nextEpisode
            ? nextEpisode.episodeNumber
            : 1;
        router.push(getWatchHref(content, { season: sn, episode: en }));
      }
      setCountdown(null);
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => (c == null ? null : c - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [countdown, nextEpisode, router, content, activeSeasonNum]);

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-[var(--background)] pt-20">
        <div className="mx-auto max-w-6xl space-y-4 px-4">
          <div className="aspect-video skeleton rounded-2xl" />
          <div className="h-24 skeleton rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !content) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-24 pt-32 text-center">
        <h1 className="font-display text-2xl font-bold text-white">
          Title not found
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          This title may have left the catalog, or the link was incomplete.
        </p>
        <Link href="/" className="mt-6 inline-block">
          <Button>Back home</Button>
        </Link>
      </div>
    );
  }

  // Email-gate: only allowed email may view 18+ content
  if (content.mature && !isRestrictedContentUser(user?.email)) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-24 pt-32 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--danger)]">
          18+ mature title
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold text-white">
          {displayTitle(content)}
        </h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          You do not have permission to view this content.
        </p>
        <div className="mt-6">
          <Link href="/">
            <Button variant="outline">Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  // 18+ gate when mature is off
  if (content.mature && !matureOn) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-24 pt-32 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--danger)]">
          18+ mature title
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold text-white">
          {displayTitle(content)}
        </h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          Turn on &quot;Show 18+ mature titles&quot; in Settings (parental PIN
          required). 18+ content is hidden when the toggle is off.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/settings">
            <Button>Open Settings</Button>
          </Link>
          <Link href="/">
            <Button variant="secondary">Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  // PIN unlock for mature titles (even when mature setting is on)
  if (content.mature && matureOn && !pinUnlocked) {
    return (
      <>
        <div className="mx-auto max-w-lg px-4 pb-24 pt-32 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--danger)]">
            18+ mature title
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold text-white">
            {displayTitle(content)}
          </h1>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            Enter your parental PIN to watch this mature title.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button
              onClick={() => setPinGateOpen(true)}
              disabled={!user || !hasParentalPin(user.uid)}
            >
              Enter PIN
            </Button>
            <Link href="/settings">
              <Button variant="secondary">Settings</Button>
            </Link>
            <Link href="/">
              <Button variant="outline">Home</Button>
            </Link>
          </div>
          {(!user || !hasParentalPin(user?.uid)) && (
            <p className="mt-3 text-xs text-[var(--danger)]">
              Sign in and create a parental PIN in Settings first.
            </p>
          )}
        </div>
        {user && hasParentalPin(user.uid) && (
          <PinGateModal
            open={pinGateOpen}
            mode="verify"
            title="Unlock playback"
            description="Enter your parental PIN to play this 18+ title."
            confirmLabel="Unlock"
            verifyPin={(pin) => verifyParentalPin(user.uid, pin)}
            onCancel={() => {
              setPinGateOpen(false);
              window.location.href = "/";
            }}
            onSuccess={() => {
              setMatureSessionUnlocked(true);
              setPinUnlocked(true);
              setPinGateOpen(false);
            }}
          />
        )}
      </>
    );
  }

  const title = displayTitle(content);
  const score = primaryScore(content);
  const poster = content.backdrop?.url || content.poster?.url;
  const legalFull = playback?.legalFull
    ? {
        ...playback.legalFull,
        downloadUrl: playback.legalFull.downloadUrl,
        downloadLabel: playback.legalFull.downloadLabel,
        type: playback.legalFull.type as
          | "archive"
          | "youtube"
          | "hls"
          | "mp4"
          | "vimeo"
          | "cloudflare",
      }
    : null;
  // Full playback requires sign-in — non-auth users only see trailers
  const canFull = Boolean(user && playback?.eligible && legalFull);
  // Watch Now (play=full / default) never auto-opens the trailer — only
  // explicit ?play=trailer does. Full legal sources still autoplay when present.
  const autoFull = (play === "full" || play == null) && canFull;
  const autoTrailer = play === "trailer" && !canFull;

  const goEpisode = (sn: number, en: number) => {
    // Always drive the in-page embed (hentai / anime often lack TMDB).
    setEmbedSeason(sn);
    setEmbedEpisode(en);
    document
      .getElementById("embed-player")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    // Keep URL shareable without full remount when possible
    if (content) {
      const href = getWatchHref(content, { season: sn, episode: en });
      if (typeof window !== "undefined" && href.startsWith("/watch/")) {
        window.history.replaceState(null, "", href);
      }
    }
  };

  const share = async () => {
    try {
      const url = window.location.href;
      await navigator.clipboard.writeText(url);
      setShareMsg("Link copied");
      window.setTimeout(() => setShareMsg(""), 2000);
    } catch {
      setShareMsg("Could not copy");
    }
  };

  return (
    <div className="relative min-h-dvh bg-[var(--background)] pb-24 pt-16">
      {/* Atmosphere */}
      {poster ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[50vh] overflow-hidden opacity-30">
          <Image
            src={poster}
            alt=""
            fill
            className="object-cover blur-2xl scale-110"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[var(--background)]" />
        </div>
      ) : null}

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        {/* Top bar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push(`/content/${pathBase}`)}
            >
              <ArrowLeft className="h-4 w-4" />
              Details
            </Button>
            <Badge tone="muted">{content.contentType}</Badge>
            {content.mature && <Badge tone="accent">18+</Badge>}
            {canFull && <Badge tone="gold">Watch Now</Badge>}
          </div>
          <div className="flex items-center gap-2">
            {shareMsg && (
              <span className="text-xs text-[var(--success)]">{shareMsg}</span>
            )}
            {canFull && legalFull?.downloadUrl ? (
              <a
                href={legalFull.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={legalFull.downloadLabel ?? "Download free"}
              >
                <Button variant="gold" size="sm" className="!text-black">
                  Download free
                </Button>
              </a>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => void share()}>
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        </div>

        {/* Player */}
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/60 shadow-2xl backdrop-blur-md">
          <MediaPlayer
            title={
              isSeries && activeEpisode
                ? `${title} · S${activeSeasonNum}E${activeEpisode.episodeNumber}`
                : title
            }
            trailer={trailer}
            legalFull={legalFull}
            eligible={canFull}
            autoOpenFull={autoFull}
            autoOpenTrailer={autoTrailer}
            providers={playback?.providers ?? content.watchProviders ?? []}
            onComplete={() => {
              if (isSeries && nextEpisode) setCountdown(10);
            }}
          />
        </div>

        {/* Sign-in prompt for non-auth users when full playback is available */}
        {!user && playback?.eligible && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/10 px-4 py-3">
            <p className="text-sm text-white">
              <strong>Sign in</strong> to watch the full movie or series.
            </p>
            <Link href="/login">
              <Button size="sm" variant="gold" className="!text-black">
                Sign in
              </Button>
            </Link>
          </div>
        )}
        {/* Always show embed player when any stream id exists (hentai = AniList/MAL) */}
        {(content.providerIds?.anilist ||
          content.providerIds?.mal ||
          content.providerIds?.tmdb ||
          content.contentType === "anime") && (
          <div id="embed-player" className="mt-4">
            <VideoPlayer
              tmdbId={content.providerIds?.tmdb}
              mediaType={
                content.animeFormat === "MOVIE" ||
                content.providerIds?.tmdbMediaType === "movie" ||
                content.contentType === "movie"
                  ? "movie"
                  : "tv"
              }
              season={
                content.animeFormat === "MOVIE"
                  ? 1
                  : embedSeason ?? seasonParam ?? 1
              }
              episode={
                content.animeFormat === "MOVIE"
                  ? 1
                  : embedEpisode ?? episodeParam ?? 1
              }
              title={
                content.animeFormat === "MOVIE" || content.contentType === "movie"
                  ? title
                  : `${title} · S${String(embedSeason ?? seasonParam ?? 1).padStart(2, "0")}E${String(embedEpisode ?? episodeParam ?? 1).padStart(2, "0")}`
              }
              originalLanguage={content.language ?? undefined}
              contentType={
                content.contentType === "anime" || content.mature
                  ? content.contentType === "anime"
                    ? "anime"
                    : content.contentType
                  : content.contentType
              }
              anilistId={content.providerIds?.anilist}
              malId={content.providerIds?.mal}
              animeFormat={content.animeFormat}
              year={content.year}
              autoPlay
            />
          </div>
        )}

        {countdown != null && nextEpisode && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-4 py-3 text-sm">
            <span className="text-white">
              Next episode in <strong>{countdown}s</strong>
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setCountdown(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setCountdown(0);
                }}
              >
                <SkipForward className="h-4 w-4" />
                Play now
              </Button>
            </div>
          </div>
        )}

        {/* Meta */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <h1 className="font-display text-3xl font-bold text-white sm:text-4xl">
              {title}
            </h1>
            {isSeries && activeEpisode && (
              <p className="text-sm text-[var(--primary-light)]">
                Season {activeSeasonNum} · Episode {activeEpisode.episodeNumber}
                {activeEpisode.name ? ` — ${activeEpisode.name}` : ""}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {content.year && <Badge tone="muted">{content.year}</Badge>}
              {score != null && (
                <Badge tone="gold">★ {formatScore(score)}</Badge>
              )}
              {content.runtime != null && (
                <Badge tone="muted">{content.runtime} min</Badge>
              )}
              {content.genres.map((g) => (
                <Badge key={g.id} tone="muted">
                  {g.name}
                </Badge>
              ))}
            </div>
            <p className="max-w-3xl text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
              {content.overview || "No overview available."}
            </p>

            {isSeries && content.animeFormat !== "MOVIE" && (
              <section className="space-y-3 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold text-white">
                    Episodes
                  </h2>
                  <div className="flex flex-wrap gap-1">
                    {(seasons.length > 0
                      ? seasons
                      : [
                          {
                            id: `${content.id}_s1`,
                            seasonNumber: 1,
                            name: "Season 1",
                          },
                        ]
                    ).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setEmbedSeason(s.seasonNumber);
                          setEmbedEpisode(1);
                          goEpisode(s.seasonNumber, 1);
                        }}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                          s.seasonNumber === activeSeasonNum
                            ? "bg-[var(--primary)] text-white"
                            : "bg-white/10 text-[var(--text-secondary)] hover:bg-white/15"
                        }`}
                      >
                        S{s.seasonNumber}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={(embedEpisode ?? activeEpisodeNum) <= 1}
                    onClick={() => {
                      const ep = Math.max(
                        1,
                        (embedEpisode ?? activeEpisodeNum) - 1,
                      );
                      setEmbedEpisode(ep);
                      goEpisode(activeSeasonNum, ep);
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (nextEpisode) {
                        const sn =
                          "seasonNumber" in nextEpisode &&
                          nextEpisode.seasonNumber
                            ? nextEpisode.seasonNumber
                            : activeSeasonNum;
                        goEpisode(sn, nextEpisode.episodeNumber);
                        setEmbedSeason(sn);
                        setEmbedEpisode(nextEpisode.episodeNumber);
                        return;
                      }
                      const ep = (embedEpisode ?? activeEpisodeNum) + 1;
                      setEmbedEpisode(ep);
                      goEpisode(activeSeasonNum, ep);
                    }}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div
                  className="scroll-contain max-h-72 space-y-1 rounded-xl border border-white/10 p-2"
                  data-lenis-prevent
                  data-lenis-prevent-wheel
                  data-lenis-prevent-touch
                  onWheel={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                >
                  {(episodes.length > 0
                    ? episodes
                    : Array.from(
                        {
                          length: Math.min(
                            content.episodeCount && content.episodeCount > 0
                              ? content.episodeCount
                              : 12,
                            48,
                          ),
                        },
                        (_, i) => ({
                          id: `syn_${i + 1}`,
                          episodeNumber: i + 1,
                          name: `Episode ${i + 1}`,
                          overview: "",
                        }),
                      )
                  ).map((ep) => (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => {
                        setEmbedSeason(activeSeasonNum);
                        setEmbedEpisode(ep.episodeNumber);
                        goEpisode(activeSeasonNum, ep.episodeNumber);
                      }}
                      className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                        ep.episodeNumber ===
                        (embedEpisode ?? activeEpisodeNum)
                          ? "bg-[var(--primary)]/20 text-white"
                          : "text-[var(--text-secondary)] hover:bg-white/5"
                      }`}
                    >
                      <span className="mt-0.5 font-mono text-xs text-[var(--text-muted)]">
                        E{ep.episodeNumber}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-white">
                          {ep.name || `Episode ${ep.episodeNumber}`}
                        </span>
                        {"overview" in ep && ep.overview ? (
                          <span className="mt-0.5 line-clamp-1 text-xs text-[var(--text-muted)]">
                            {ep.overview}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-4">
            {content.poster?.url && (
              <div className="relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10">
                <Image
                  src={content.poster.url}
                  alt={title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
            <Link href={`/content/${pathBase}`}>
              <Button variant="outline" className="w-full">
                <Film className="h-4 w-4" />
                Full details
              </Button>
            </Link>
          </aside>
        </div>

        {(recs?.items?.length ?? 0) > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 font-display text-xl font-semibold text-white">
              More like this
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {recs!.items.slice(0, 12).map((r) => (
                <ContentCard
                  key={r.content.id}
                  content={r.content}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

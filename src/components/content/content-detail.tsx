"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  Heart,
  Play,
  Share2,
  Star,
  CheckCircle2,
} from "lucide-react";
import {
  fetchContentBySlug,
  fetchCredits,
  fetchPlaybackEligibility,
  fetchProviders,
  fetchRecommendations,
  fetchSeasons,
  fetchTrailers,
} from "@/lib/api/content";
import { putFavorite, putLibrary, deleteFavorite } from "@/lib/api/user";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ContentRow } from "./content-row";
import { MediaPlayer } from "./media-player";
import { AuthGate } from "@/components/auth/auth-gate";
import { PinGateModal } from "@/components/content/pin-gate";
import { displayTitle, primaryScore } from "@/lib/content/normalize";
import { getTrailerHref, getWatchHref } from "@/lib/content/watch-href";
import { formatRuntime, formatScore } from "@/lib/utils";
import { isMatureEnabledClient } from "@/lib/user/local-profile";
import {
  hasParentalPin,
  isMatureSessionUnlocked,
  setMatureSessionUnlocked,
  verifyParentalPin,
} from "@/lib/user/mature-pin";
import { useAuthStore } from "@/stores/auth-store";
import { useGuestLibraryStore } from "@/stores/guest-library-store";
import { Reveal } from "@/components/motion/reveal";
import { useEffect, useState } from "react";

export function ContentDetail({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const playTrailer = searchParams.get("play") === "trailer";
  const playFull = searchParams.get("play") === "full";
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const guest = useGuestLibraryStore();
  const [spoilerOpen, setSpoilerOpen] = useState(false);
  const [activeTrailerKey, setActiveTrailerKey] = useState<string | null>(
    null,
  );
  const [matureUnlocked, setMatureUnlocked] = useState(false);
  const [pinGateOpen, setPinGateOpen] = useState(false);
  const settings = useAuthStore((s) => s.settings);
  const matureOn =
    Boolean(settings?.matureContent) || isMatureEnabledClient(user?.uid);

  useEffect(() => {
    const unlocked = isMatureSessionUnlocked();
    setMatureUnlocked(unlocked);
    if (!unlocked) setPinGateOpen(true);
  }, [user?.uid, settings?.matureContent]);

  const { data: content, isLoading, isError } = useQuery({
    queryKey: ["content", slug],
    queryFn: () => fetchContentBySlug(slug),
  });

  const contentId = content?.id;

  const { data: credits } = useQuery({
    queryKey: ["credits", contentId],
    queryFn: () => fetchCredits(contentId!),
    enabled: Boolean(contentId),
  });

  const { data: trailers } = useQuery({
    queryKey: ["trailers", contentId],
    queryFn: () => fetchTrailers(contentId!),
    enabled: Boolean(contentId),
  });

  const { data: providers } = useQuery({
    queryKey: ["providers", contentId],
    queryFn: () => fetchProviders(contentId!),
    enabled: Boolean(contentId),
  });

  const { data: recs } = useQuery({
    queryKey: ["recs", contentId],
    queryFn: () => fetchRecommendations(contentId!),
    enabled: Boolean(contentId),
  });

  const { data: seasons } = useQuery({
    queryKey: ["seasons", contentId],
    queryFn: () => fetchSeasons(contentId!),
    enabled: Boolean(contentId),
  });

  const { data: playback } = useQuery({
    queryKey: ["playback", contentId],
    queryFn: () => fetchPlaybackEligibility(contentId!),
    enabled: Boolean(contentId),
  });

  const watchlistMut = useMutation({
    mutationFn: async () => {
      if (!content) return;
      const { snapshotFromContent } = await import("@/lib/user/my-list");
      const {
        isInMyList,
        removeLocalLibrary,
        upsertLocalLibrary,
      } = await import("@/lib/user/local-library");
      const uid = user?.uid ?? null;
      const snap = snapshotFromContent(content);
      if (isInMyList(uid, content.id)) {
        removeLocalLibrary(uid, content.id);
        if (!user) guest.removeLibrary(content.id);
        if (user) {
          try {
            const { deleteLibrary } = await import("@/lib/api/user");
            await deleteLibrary(content.id);
          } catch {
            /* local removed */
          }
        }
      } else {
        upsertLocalLibrary(uid, {
          contentId: content.id,
          status: "plan_to_watch",
          snapshot: snap,
        });
        if (!user) guest.addLibrary(content.id, "plan_to_watch", snap);
        if (user) {
          try {
            await putLibrary(content.id, { status: "plan_to_watch" });
          } catch {
            /* local saved */
          }
        }
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cineverse-library-changed"));
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["library"] }),
  });

  const favoriteMut = useMutation({
    mutationFn: async () => {
      if (!content) return;
      if (user) {
        if (guest.isFavorite(content.id)) {
          await deleteFavorite(content.id);
          guest.toggleFavorite(content.id);
        } else {
          await putFavorite(content.id);
          if (!guest.isFavorite(content.id)) guest.toggleFavorite(content.id);
        }
      } else {
        guest.toggleFavorite(content.id);
      }
    },
  });

  const completeMut = useMutation({
    mutationFn: async () => {
      if (!content) return;
      const { snapshotFromContent } = await import("@/lib/user/my-list");
      const { upsertLocalLibrary } = await import("@/lib/user/local-library");
      const uid = user?.uid ?? null;
      const snap = snapshotFromContent(content);
      upsertLocalLibrary(uid, {
        contentId: content.id,
        status: "completed",
        snapshot: snap,
      });
      if (!user) guest.addLibrary(content.id, "completed", snap);
      if (user) {
        try {
          await putLibrary(content.id, { status: "completed" });
        } catch {
          /* local saved */
        }
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("cineverse-library-changed"));
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["library"] }),
  });

  if (isLoading) {
    return (
      <div className="pt-20">
        <div className="h-[50vh] skeleton" />
      </div>
    );
  }

  if (isError || !content) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-32 text-center">
        <h1 className="font-display text-2xl">Title not found</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          This title may have left the live catalog, or the link was incomplete.
          Mature titles need the 18+ library enabled to stay in the catalog.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/mature"
            className="text-[var(--primary-light)] underline-offset-2 hover:underline"
          >
            Back to 18+ mature
          </Link>
          <Link
            href="/discover"
            className="text-[var(--primary-light)] underline-offset-2 hover:underline"
          >
            Discover
          </Link>
          <Link
            href="/movies"
            className="text-[var(--primary-light)] underline-offset-2 hover:underline"
          >
            Movies
          </Link>
        </div>
      </div>
    );
  }

  const title = displayTitle(content);
  const score = primaryScore(content);
  // Official trailers only — never clips, featurettes, teasers, BTS
  const allTrailers = (() => {
    const raw =
      trailers?.trailers?.length
        ? trailers.trailers
        : content.trailer
          ? [content.trailer]
          : playback?.trailer
            ? [playback.trailer]
            : [];
    return raw.filter((t) => {
      if (!t?.key || t.site !== "youtube") return false;
      const type = (t.type ?? "").toLowerCase();
      if (type && type !== "trailer") return false;
      if (!type && !/\btrailer\b/i.test(t.name ?? "")) return false;
      if (/\b(teaser|clip|featurette|behind the scenes|bloopers)\b/i.test(t.name ?? "") &&
          !/\btrailer\b/i.test(t.name ?? "")) {
        return false;
      }
      return true;
    });
  })();
  // Prefer official
  const trailer =
    allTrailers.find((t) => t.official || /official/i.test(t.name)) ??
    allTrailers[0] ??
    null;
  const activeTrailer =
    allTrailers.find((t) => t.key === activeTrailerKey) ?? trailer;

  if (content.mature && !matureOn) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-24 pt-32 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--danger)]">
          18+ mature title
        </p>
        <h1 className="mt-2 font-display text-2xl font-bold text-white">
          {title}
        </h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          Enable &quot;Show 18+ mature titles&quot; in Settings (parental PIN
          required). The 18+ tab only appears when mature content is on.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/settings">
            <Button>Open Settings</Button>
          </Link>
          <Link href="/">
            <Button variant="outline">Go home</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (content.mature && matureOn && !matureUnlocked) {
    return (
      <>
        <div className="mx-auto max-w-lg px-4 pb-24 pt-32 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--danger)]">
            18+ mature title
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold text-white">
            {title}
          </h1>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            Enter your parental PIN to view this mature title. This keeps kids
            from opening 18+ pages.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
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
              <Button variant="outline">Go home</Button>
            </Link>
          </div>
          {user && !hasParentalPin(user.uid) && (
            <p className="mt-3 text-xs text-[var(--danger)]">
              No parental PIN on this device. Create one in Settings first.
            </p>
          )}
          {!user && (
            <p className="mt-3 text-xs text-[var(--text-muted)]">
              Sign in and configure a parental PIN in Settings.
            </p>
          )}
        </div>
        {user && hasParentalPin(user.uid) && (
          <PinGateModal
            open={pinGateOpen}
            mode="verify"
            title="Unlock mature title"
            description="Enter your parental PIN to open this 18+ title."
            confirmLabel="Unlock"
            verifyPin={(pin) => verifyParentalPin(user.uid, pin)}
            onCancel={() => {
              setPinGateOpen(false);
              window.location.href = "/";
            }}
            onSuccess={() => {
              setMatureSessionUnlocked(true);
              setMatureUnlocked(true);
              setPinGateOpen(false);
            }}
          />
        )}
      </>
    );
  }

  return (
    <article data-theme={content.contentType === "movie" ? "movies" : content.contentType === "series" ? "series" : content.contentType === "anime" ? "anime" : "kdrama"}>
      <div className="relative min-h-[50vh] pt-16">
        {(content.backdrop?.url || content.poster?.url) && (
          <Image
            src={content.backdrop?.url || content.poster!.url}
            alt=""
            fill
            className="object-cover opacity-40"
            priority
            unoptimized
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/80 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto -mt-40 max-w-7xl px-4 pb-24 sm:px-6">
        <Reveal inView={false} className="flex flex-col gap-8 md:flex-row">
          <div className="relative mx-auto h-[320px] w-[210px] shrink-0 overflow-hidden rounded-xl shadow-2xl sm:mx-0">
            {content.poster?.url ? (
              <Image
                src={content.poster.url}
                alt={title}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="poster-fallback absolute inset-0">{title}</div>
            )}
          </div>

          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge
                tone={
                  content.contentType === "movie"
                    ? "primary"
                    : content.contentType === "series"
                      ? "cyan"
                      : content.contentType === "anime"
                        ? "accent"
                        : "gold"
                }
              >
                {content.contentType}
              </Badge>
              {content.animeFormat && (
                <Badge tone="muted">{content.animeFormat}</Badge>
              )}
              {content.ageRating && (
                <Badge tone="muted">{content.ageRating}</Badge>
              )}
            </div>

            <h1 className="font-display text-3xl font-bold sm:text-4xl md:text-5xl">
              {title}
            </h1>
            {(content.originalTitle ||
              content.romajiTitle ||
              content.nativeTitle) && (
              <p className="font-editorial text-lg text-[var(--text-secondary)]">
                {[content.originalTitle, content.romajiTitle, content.nativeTitle]
                  .filter(Boolean)
                  .filter((t, i, a) => a.indexOf(t) === i && t !== title)
                  .join(" · ")}
              </p>
            )}

            <div className="flex flex-wrap gap-3 text-sm text-[var(--text-secondary)]">
              {content.year && <span>{content.year}</span>}
              {content.runtime != null && (
                <span>{formatRuntime(content.runtime)}</span>
              )}
              {score != null && (
                <span className="inline-flex items-center gap-1 text-[var(--gold)]">
                  <Star className="h-4 w-4 fill-current" />
                  {formatScore(score)}
                </span>
              )}
              {content.status && (
                <span className="capitalize">{content.status.replace(/_/g, " ")}</span>
              )}
              {content.language && <span>{content.language.toUpperCase()}</span>}
              {content.countries?.length > 0 && (
                <span>{content.countries.join(", ")}</span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {content.genres.map((g) => (
                <Badge key={g.id} tone="muted">
                  {g.name}
                </Badge>
              ))}
            </div>

            <p className="max-w-2xl text-[var(--text-secondary)] leading-relaxed">
              {content.overview || "No overview available."}
            </p>

            <div className="flex flex-wrap gap-2">
              <Link href={getWatchHref(content)} className="watch-now-cta">
                <Button variant="gold" className="watch-now-cta !text-black">
                  <Play className="h-4 w-4 !text-black" />
                  Watch Now
                </Button>
              </Link>
              {trailer?.site === "youtube" && trailer.key ? (
                <Link href={getTrailerHref(content)}>
                  <Button variant="secondary">
                    <Play className="h-4 w-4" />
                    Watch Trailer
                  </Button>
                </Link>
              ) : null}
              <Button
                variant="secondary"
                onClick={() => watchlistMut.mutate()}
                disabled={watchlistMut.isPending}
              >
                <Bookmark className="h-4 w-4" />
                My List
              </Button>
              <Button
                variant="outline"
                onClick={() => favoriteMut.mutate()}
                disabled={favoriteMut.isPending}
              >
                <Heart className="h-4 w-4" />
                Favorite
              </Button>
              <Button
                variant="ghost"
                onClick={() => completeMut.mutate()}
                disabled={completeMut.isPending}
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark watched
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (navigator.share) {
                    void navigator.share({
                      title,
                      url: window.location.href,
                    });
                  } else {
                    void navigator.clipboard.writeText(window.location.href);
                  }
                }}
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>

            {/* Legal free AVOD — removed; all streaming via embed player */}

            {/* Other legal providers (Netflix, etc.) */}
            <div className="surface-card p-4">
              <h2 className="font-display text-lg font-semibold">
                Other legal providers
              </h2>
              {playback?.eligible ? (
                <p className="mt-2 text-sm text-[var(--success)]">
                  Verified rights allow full playback in your region after sign-in.
                </p>
              ) : (
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  {playback?.reason ??
                    "Subscription and rental services for this title."}
                </p>
              )}
              <AuthGate
                className="mt-3"
                title="Sign in for legal watch links"
                description="Free unlimited account unlocks provider deep-links, trailers, and season guides for every title."
              >
                <ul className="flex flex-wrap gap-2">
                  {(providers?.providers ?? content.watchProviders).map((p) => (
                    <li key={`${p.id}-${p.type}`}>
                      {p.link ? (
                        <a
                          href={p.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block"
                        >
                          <Badge
                            tone={
                              p.type === "free"
                                ? "primary"
                                : p.type === "flatrate"
                                  ? "cyan"
                                  : "muted"
                            }
                          >
                            {p.name} · {p.type} ↗
                          </Badge>
                        </a>
                      ) : (
                        <Badge
                          tone={
                            p.type === "free"
                              ? "primary"
                              : p.type === "flatrate"
                                ? "cyan"
                                : "muted"
                          }
                        >
                          {p.name} · {p.type}
                        </Badge>
                      )}
                    </li>
                  ))}
                  {(providers?.providers ?? content.watchProviders).length ===
                    0 && (
                    <li className="text-sm text-[var(--text-muted)]">
                      No other providers listed for this region yet. Use Tubi /
                      Pluto / Freevee search above, or try another region.
                    </li>
                  )}
                </ul>
              </AuthGate>
            </div>
          </div>
        </Reveal>

        <div id="cineverse-player" className="mt-10 max-w-5xl">
          <h2 className="mb-3 font-display text-xl font-semibold text-white">
            Watch
          </h2>
          <MediaPlayer
            title={title}
            trailer={activeTrailer}
            legalFull={playback?.legalFull}
            eligible={playback?.eligible}
            autoOpenTrailer={playTrailer && !playFull}
            autoOpenFull={playFull || Boolean(playback?.eligible)}
            providers={providers?.providers ?? content.watchProviders}
            keepInApp
          />
          {content.playable || playback?.eligible ? (
            <p className="mt-2 text-xs text-[var(--success)]">
              Free full stream available in-app.
            </p>
          ) : null}
        </div>

        {allTrailers.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 font-display text-xl font-semibold text-white">
              Official trailers
            </h2>
            <AuthGate title="Sign in to browse trailers">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {allTrailers.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setActiveTrailerKey(t.key);
                      document
                        .getElementById("cineverse-player")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                    }}
                    className="group overflow-hidden rounded-xl surface-card text-left transition hover:ring-1 hover:ring-[var(--primary)]/50"
                  >
                    <div className="relative aspect-video bg-[var(--surface-elevated)]">
                      <Image
                        src={`https://img.youtube.com/vi/${t.key}/hqdefault.jpg`}
                        alt={t.name}
                        fill
                        className="object-cover transition group-hover:scale-105"
                        unoptimized
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/35">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-lg">
                          <Play className="h-5 w-5 fill-current" />
                        </span>
                      </div>
                    </div>
                    <div className="p-3">
                      <p className="line-clamp-2 text-sm font-medium text-white">
                        {t.name}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                        {[t.type, t.official ? "Official" : null]
                          .filter(Boolean)
                          .join(" · ") || "YouTube"}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </AuthGate>
          </section>
        )}

        {credits && credits.cast.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 font-display text-xl font-semibold text-white">
              Cast
            </h2>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
              {credits.cast.map((c, idx) => (
                <Link
                  key={`${c.id}-${idx}`}
                  href={`/person/${c.personId}`}
                  className="min-w-[128px] max-w-[128px] rounded-xl surface-card p-2.5 text-center transition hover:ring-1 hover:ring-white/15"
                >
                  <div className="relative mx-auto mb-2 h-24 w-24 overflow-hidden rounded-full bg-[var(--surface-elevated)]">
                    {c.profilePath ? (
                      <Image
                        src={c.profilePath}
                        alt={c.personName}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-[var(--text-secondary)]">
                        {c.personName.slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <p className="line-clamp-2 text-sm font-medium text-white">
                    {c.personName}
                  </p>
                  {c.character && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-[var(--text-secondary)]">
                      {c.character}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}

        {credits && credits.crew.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-4 font-display text-xl font-semibold text-white">
              Crew
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {credits.crew.map((c, idx) => (
                <div
                  key={`${c.id}-${idx}`}
                  className="flex items-center gap-3 rounded-xl surface-card p-3"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-[var(--surface-elevated)]">
                    {c.profilePath ? (
                      <Image
                        src={c.profilePath}
                        alt={c.personName}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-[var(--text-secondary)]">
                        {c.personName.slice(0, 1)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {c.personName}
                    </p>
                    <p className="truncate text-xs text-[var(--text-secondary)]">
                      {c.job}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {content.contentType !== "movie" && (
          <section className="mt-12">
            <h2 className="mb-1 font-display text-xl font-semibold text-white">
              Seasons & episodes
            </h2>
            <p className="mb-4 text-sm text-[var(--text-secondary)]">
              {seasons?.seasons?.length
                ? `${seasons.seasons.length} season${seasons.seasons.length === 1 ? "" : "s"} · open a season to see every full episode (not trailers)`
                : "Loading seasons…"}
            </p>
            {seasons && seasons.seasons.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {seasons.seasons.map((s) => (
                  <Link
                    key={s.id}
                    href={`/content/${encodeURIComponent(content.slug || content.id)}/season/${s.seasonNumber}`}
                    className="flex gap-3 rounded-xl border border-white/10 bg-[var(--surface)] p-3 transition hover:ring-1 hover:ring-[var(--primary)]/40"
                  >
                    <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-elevated)]">
                      {(s.poster?.url || content.poster?.url) && (
                        <Image
                          src={s.poster?.url || content.poster!.url}
                          alt={s.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-display font-semibold text-white">
                        {s.name}
                      </p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">
                        {s.episodeCount > 0
                          ? `${s.episodeCount} episodes`
                          : "Episodes"}
                        {s.airDate ? ` · ${s.airDate.slice(0, 4)}` : ""}
                      </p>
                      {s.overview ? (
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--text-muted)]">
                          {s.overview}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">
                Season list will appear when live episode data is available.
              </p>
            )}
          </section>
        )}

        <section className="mt-12">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold text-white">
              Reviews
            </h2>
            <button
              type="button"
              className="text-xs text-[var(--text-secondary)]"
              onClick={() => setSpoilerOpen((v) => !v)}
            >
              Spoilers: {spoilerOpen ? "shown" : "hidden"}
            </button>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Sign in to write a review. Spoiler protection is on by default.
          </p>
        </section>

        {recs && recs.items.length > 0 && (
          <div className="mt-12">
            <ContentRow
              title="Similar & recommended"
              subtitle={recs.items[0]?.reason}
              items={recs.items.map((r) => r.content)}
            />
          </div>
        )}
      </div>
    </article>
  );
}

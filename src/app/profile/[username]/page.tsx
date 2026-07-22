"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  Clapperboard,
  Heart,
  History,
  Pencil,
  Settings,
  Shield,
  Sparkles,
  Star,
  UserRound,
} from "lucide-react";
import {
  fetchFavorites,
  fetchLibrary,
  fetchProfile,
  updateMe,
} from "@/lib/api/user";
import { fetchContentById } from "@/lib/api/content";
import { useAuthStore } from "@/stores/auth-store";
import { useGuestLibraryStore } from "@/stores/guest-library-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  defaultProfileFromUser,
  mergeProfile,
  readLocalProfile,
  writeLocalProfile,
} from "@/lib/user/local-profile";
import type { Content, LibraryStatus, UserProfile } from "@/types/content";
import { displayTitle } from "@/lib/content/normalize";
import { cn } from "@/lib/utils";

type TabId = "overview" | "library" | "favorites";

/** Profile chrome uses shared product tokens; tab chips mirror site Chip pattern. */
export default function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: rawUsername } = use(params);
  const username = decodeURIComponent(rawUsername);
  const queryClient = useQueryClient();
  const { user, profile: myProfile, setProfile, settings } = useAuthStore();
  const guest = useGuestLibraryStore();

  const localOwn = useMemo(() => {
    if (!user) return null;
    return (
      readLocalProfile(user.uid) ?? myProfile ?? defaultProfileFromUser(user)
    );
  }, [user, myProfile]);

  const isOwnByUsername = Boolean(
    user &&
      localOwn &&
      localOwn.username.toLowerCase() === username.toLowerCase(),
  );
  const isOwnByUid = Boolean(
    user && (username === "me" || username === user.uid),
  );
  const isOwn = isOwnByUsername || isOwnByUid;

  const {
    data,
    isLoading,
    isError,
    refetch,
    dataUpdatedAt,
    isFetching,
  } = useQuery({
    queryKey: ["profile", username],
    queryFn: () => fetchProfile(username),
    enabled: !isOwn,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const libraryQuery = useQuery({
    queryKey: ["library", user?.uid ?? "guest"],
    queryFn: async () => {
      if (user) {
        try {
          return await fetchLibrary();
        } catch {
          return { items: [] as Awaited<ReturnType<typeof fetchLibrary>>["items"] };
        }
      }
      return {
        items: guest.library.map((g) => ({
          id: g.contentId,
          uid: "guest",
          contentId: g.contentId,
          status: g.status,
          rating: g.rating ?? null,
          progress: { episode: 0, season: 0, percent: 0 },
          notes: "",
          updatedAt: g.addedAt,
          createdAt: g.addedAt,
        })),
      };
    },
    enabled: isOwn,
    staleTime: 15_000,
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
  });

  const favoritesQuery = useQuery({
    queryKey: ["favorites", user?.uid ?? "guest"],
    queryFn: async () => {
      if (user) {
        try {
          return await fetchFavorites();
        } catch {
          return { items: [] as Awaited<ReturnType<typeof fetchFavorites>>["items"] };
        }
      }
      return {
        items: guest.favorites.map((contentId) => ({
          id: contentId,
          uid: "guest",
          contentId,
          createdAt: new Date().toISOString(),
        })),
      };
    },
    enabled: isOwn,
    staleTime: 15_000,
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
  });

  const profile: UserProfile | null = useMemo(() => {
    if (isOwn && user) {
      const base = mergeProfile(data?.profile ?? null, localOwn, user);
      const lib = libraryQuery.data?.items ?? [];
      const favs = favoritesQuery.data?.items ?? [];
      return {
        ...base,
        stats: {
          watched: lib.filter((i) => i.status === "completed").length,
          watching: lib.filter((i) => i.status === "watching").length,
          planToWatch: lib.filter((i) => i.status === "plan_to_watch").length,
          favorites: favs.length,
          reviews: base.stats?.reviews ?? 0,
        },
      };
    }
    return data?.profile ?? null;
  }, [isOwn, user, data, localOwn, libraryQuery.data, favoritesQuery.data]);

  const contentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const i of libraryQuery.data?.items ?? []) ids.add(i.contentId);
    for (const i of favoritesQuery.data?.items ?? []) ids.add(i.contentId);
    return Array.from(ids).slice(0, 40);
  }, [libraryQuery.data, favoritesQuery.data]);

  const postersQuery = useQuery({
    queryKey: ["profile-posters", contentIds.join(",")],
    queryFn: async () => {
      const map: Record<string, Content | null> = {};
      await Promise.all(
        contentIds.map(async (id) => {
          try {
            map[id] = await fetchContentById(id);
          } catch {
            map[id] = null;
          }
        }),
      );
      return map;
    },
    enabled: isOwn && contentIds.length > 0,
    staleTime: 60_000,
  });

  const [tab, setTab] = useState<TabId>("overview");
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setBio(profile.bio ?? "");
    }
  }, [profile]);

  if (!isOwn && isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-24 pt-24">
        <div className="h-48 skeleton rounded-3xl" />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-32 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary)]/20 text-[var(--primary-light)]">
          <UserRound className="h-8 w-8" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold">Profile not found</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          This profile is private or does not exist.
        </p>
        {user ? (
          <Link
            href={`/profile/${localOwn?.username ?? "me"}`}
            className="mt-6 inline-block"
          >
            <Button>Open my profile</Button>
          </Link>
        ) : (
          <Link href="/signup" className="mt-6 inline-block">
            <Button>Create a free profile</Button>
          </Link>
        )}
      </div>
    );
  }

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    const next: UserProfile = {
      ...profile,
      displayName: displayName.trim() || profile.displayName,
      bio: bio.slice(0, 280),
      updatedAt: new Date().toISOString(),
    };
    setProfile(next);
    writeLocalProfile(user.uid, next);
    try {
      await user.getIdToken(true);
      const res = await updateMe({
        displayName: next.displayName,
        bio: next.bio,
        username: next.username,
      });
      setProfile(res.profile);
      writeLocalProfile(user.uid, res.profile);
      setEditing(false);
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      if (!isOwn) await refetch();
    } catch {
      setEditing(false);
      setError(null);
    } finally {
      setSaving(false);
    }
  };

  const stats = [
    {
      label: "Watched",
      value: profile.stats?.watched ?? 0,
      icon: Clapperboard,
      tone: "text-[var(--gold)]",
    },
    {
      label: "Watching",
      value: profile.stats?.watching ?? 0,
      icon: Sparkles,
      tone: "text-[var(--secondary)]",
    },
    {
      label: "Plan",
      value: profile.stats?.planToWatch ?? 0,
      icon: Bookmark,
      tone: "text-[var(--primary-light)]",
    },
    {
      label: "Favorites",
      value: profile.stats?.favorites ?? 0,
      icon: Heart,
      tone: "text-[var(--accent)]",
    },
    {
      label: "Reviews",
      value: profile.stats?.reviews ?? 0,
      icon: Star,
      tone: "text-[var(--gold)]",
    },
  ] as const;

  const matureOn =
    Boolean(settings?.matureContent) || isMatureFromProfile(user?.uid);
  const updatedLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : "";

  const libraryByStatus = (status: LibraryStatus) =>
    (libraryQuery.data?.items ?? []).filter((i) => i.status === status);

  return (
    <div className="relative min-h-dvh overflow-hidden pb-28 pt-20">
      {/* Premium atmospheric header */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(139,124,255,0.28),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-24 h-64 bg-[radial-gradient(ellipse_50%_40%_at_80%_20%,rgba(92,228,255,0.12),transparent_55%)]" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6">
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[var(--surface)] p-6 shadow-[0_24px_64px_-20px_rgba(0,0,0,0.55)] sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="relative mx-auto sm:mx-0">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--primary)] text-3xl font-bold text-white shadow-xl ring-4 ring-white/10 sm:h-28 sm:w-28">
                {(profile.displayName || "?").slice(0, 1).toUpperCase()}
              </div>
              {isOwn && (
                <span className="absolute -bottom-1 -right-1 rounded-full border border-white/20 bg-[var(--surface)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--success)]">
                  Live
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                  {profile.displayName}
                </h1>
                {isOwn && (
                  <Badge tone="primary">You</Badge>
                )}
                {matureOn && isOwn && (
                  <Badge tone="accent">18+</Badge>
                )}
              </div>
              <p className="mt-1 text-[var(--text-muted)]">@{profile.username}</p>
              <p className="mt-2 flex flex-wrap items-center justify-center gap-2 text-xs text-[var(--text-secondary)] sm:justify-start">
                <span className="inline-flex items-center gap-1 text-[var(--success)]">
                  <Shield className="h-3.5 w-3.5" />
                  Free unlimited member
                </span>
                <span>· United States</span>
                {isOwn && (isFetching || libraryQuery.isFetching) && (
                  <span className="text-[var(--primary-light)]">· syncing…</span>
                )}
                {isOwn && updatedLabel && !isFetching && (
                  <span className="text-[var(--text-muted)]">
                    · updated {updatedLabel}
                  </span>
                )}
              </p>

              {!editing && profile.bio ? (
                <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">
                  {profile.bio}
                </p>
              ) : !editing && isOwn ? (
                <p className="mt-4 text-sm text-[var(--text-muted)]">
                  Add a bio so your cosmos feels like home.
                </p>
              ) : null}
            </div>

            {isOwn && (
              <div className="flex flex-wrap justify-center gap-2 sm:justify-end">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditing((v) => !v)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {editing ? "Cancel" : "Edit"}
                </Button>
                <Link href="/settings">
                  <Button size="sm" variant="outline">
                    <Settings className="h-3.5 w-3.5" />
                    Settings
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {editing && isOwn && (
            <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-black/30 p-5">
              <label className="block text-sm text-[var(--text-secondary)]">
                Display name
                <Input
                  className="mt-1"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </label>
              <label className="block text-sm text-[var(--text-secondary)]">
                Bio
                <textarea
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[var(--primary)]"
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 280))}
                  placeholder="What are you watching this season?"
                />
              </label>
              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save profile"}
              </Button>
            </div>
          )}
        </section>

        {/* Stats */}
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stats.map(({ label, value, icon: Icon, tone }) => (
            <div
              key={label}
              className="group rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center transition hover:border-[var(--primary)]/40 hover:bg-white/[0.07]"
            >
              <dt className="flex items-center justify-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
                <Icon className={cn("h-3.5 w-3.5", tone)} />
                {label}
              </dt>
              <dd className="mt-1 font-display text-2xl font-bold text-white">
                {value}
              </dd>
            </div>
          ))}
        </dl>

        {/* Tabs */}
        {isOwn && (
          <>
            <div className="mt-8 flex flex-wrap gap-2">
              {(
                [
                  ["overview", "Overview"],
                  ["library", "Library"],
                  ["favorites", "Favorites"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  aria-pressed={tab === id}
                  className={cn(
                    "inline-flex min-h-9 items-center rounded-full px-4 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                    tab === id
                      ? "bg-[var(--primary)] text-white"
                      : "bg-white/5 text-[var(--text-secondary)] hover:bg-white/10 hover:text-white",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "overview" && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <QuickLink
                  href="/watchlist"
                  title="Watchlist"
                  desc="Titles you plan to watch"
                  icon={Bookmark}
                />
                <QuickLink
                  href="/favorites"
                  title="Favorites"
                  desc="Your celestial picks"
                  icon={Heart}
                />
                <QuickLink
                  href="/history"
                  title="History"
                  desc="Continue where you left off"
                  icon={History}
                />
                <QuickLink
                  href="/settings"
                  title="Preferences"
                  desc="18+ · anime titles · account"
                  icon={Settings}
                />
              </div>
            )}

            {tab === "library" && (
              <div className="mt-6 space-y-8">
                <LibrarySection
                  title="Watching"
                  items={libraryByStatus("watching")}
                  posters={postersQuery.data}
                />
                <LibrarySection
                  title="Plan to watch"
                  items={libraryByStatus("plan_to_watch")}
                  posters={postersQuery.data}
                />
                <LibrarySection
                  title="Completed"
                  items={libraryByStatus("completed")}
                  posters={postersQuery.data}
                />
                {(libraryQuery.data?.items.length ?? 0) === 0 && (
                  <EmptyState
                    title="Your library is empty"
                    href="/movies"
                    cta="Browse popular movies"
                  />
                )}
              </div>
            )}

            {tab === "favorites" && (
              <div className="mt-6">
                {(favoritesQuery.data?.items.length ?? 0) === 0 ? (
                  <EmptyState
                    title="No favorites yet"
                    href="/discover"
                    cta="Discover titles"
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {favoritesQuery.data!.items.map((f) => (
                      <PosterCard
                        key={f.contentId}
                        contentId={f.contentId}
                        content={postersQuery.data?.[f.contentId]}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!isOwn && (
          <p className="mt-10 text-center text-sm text-[var(--text-muted)]">
            Public profile · library stays private unless shared collections are
            enabled.
          </p>
        )}
      </div>
    </div>
  );
}

function QuickLink({
  href,
  title,
  desc,
  icon: Icon,
}: {
  href: string;
  title: string;
  desc: string;
  icon: typeof Heart;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-[var(--primary)]/40 hover:bg-white/[0.07]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/20 text-[var(--primary-light)] transition group-hover:bg-[var(--primary)]/30">
        <Icon className="h-5 w-5" />
      </span>
      <span>
        <span className="block font-display text-lg font-semibold text-white">
          {title}
        </span>
        <span className="mt-0.5 block text-sm text-[var(--text-muted)]">
          {desc}
        </span>
      </span>
    </Link>
  );
}

function LibrarySection({
  title,
  items,
  posters,
}: {
  title: string;
  items: Array<{ contentId: string; status: string }>;
  posters?: Record<string, Content | null>;
}) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-semibold text-white">
        {title}{" "}
        <span className="text-sm font-normal text-[var(--text-muted)]">
          ({items.length})
        </span>
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.slice(0, 10).map((i) => (
          <PosterCard
            key={i.contentId}
            contentId={i.contentId}
            content={posters?.[i.contentId]}
          />
        ))}
      </div>
    </section>
  );
}

function PosterCard({
  contentId,
  content,
}: {
  contentId: string;
  content?: Content | null;
}) {
  const title = content ? displayTitle(content) : contentId;
  const href = content?.slug
    ? `/content/${encodeURIComponent(content.slug)}`
    : `/content/${encodeURIComponent(contentId)}`;
  const src = content?.poster?.url;

  return (
    <Link
      href={href}
      className="group relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-[var(--surface)] transition hover:-translate-y-0.5 hover:border-[var(--primary)]/40"
    >
      {src ? (
        <Image
          src={src}
          alt={title}
          fill
          className="object-cover transition duration-500 group-hover:scale-105"
          unoptimized
        />
      ) : (
        <div className="flex h-full items-center justify-center p-3 text-center text-xs text-[var(--text-muted)]">
          {title}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2.5">
        <p className="line-clamp-2 text-xs font-medium text-white">{title}</p>
      </div>
    </Link>
  );
}

function EmptyState({
  title,
  href,
  cta,
}: {
  title: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-12 text-center">
      <p className="font-display text-lg text-white">{title}</p>
      <Link href={href} className="mt-4 inline-block">
        <Button variant="secondary" size="sm">
          {cta}
        </Button>
      </Link>
    </div>
  );
}

function isMatureFromProfile(uid?: string) {
  if (!uid || typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(`cineverse_settings_${uid}`);
    if (!raw)
      return window.localStorage.getItem("cineverse_mature_flag") === "1";
    return Boolean(
      (JSON.parse(raw) as { matureContent?: boolean }).matureContent,
    );
  } catch {
    return false;
  }
}

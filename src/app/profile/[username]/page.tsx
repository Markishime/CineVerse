"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Bookmark,
  Heart,
  History,
  Pencil,
  RefreshCw,
  Settings,
  Sparkles,
  UserRound,
  Film,
  Tv,
  Compass,
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
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  defaultProfileFromUser,
  mergeProfile,
  readLocalProfile,
  writeLocalProfile,
} from "@/lib/user/local-profile";
import { readLocalLibrary } from "@/lib/user/local-library";
import type { Content, LibraryStatus, UserProfile } from "@/types/content";
import { displayTitle } from "@/lib/content/normalize";
import { getDetailsHref } from "@/lib/content/watch-href";
import { cn } from "@/lib/utils";
import { staggerContainer, staggerItem, fadeUp } from "@/lib/motion";

type TabId = "overview" | "library" | "favorites" | "activity";

const REFETCH_MS = 12_000;

function greetingForHour(h: number) {
  if (h < 5) return "Still up?";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Late night";
}

function relativeTime(iso?: string | null) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const sec = Math.round((Date.now() - t) / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function statusLabel(status: string) {
  switch (status) {
    case "watching":
      return "Watching";
    case "completed":
      return "Completed";
    case "plan_to_watch":
      return "Plan to watch";
    case "on_hold":
      return "On hold";
    case "dropped":
      return "Dropped";
    default:
      return status;
  }
}

export default function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: rawUsername } = use(params);
  const username = rawUsername;
  const queryClient = useQueryClient();
  const reduce = useReducedMotion();
  const {
    user,
    profile: myProfile,
    setProfile,
    loading: authLoading,
  } = useAuthStore();
  const guestLibrary = useGuestLibraryStore((s) => s.library);
  const guestFavorites = useGuestLibraryStore((s) => s.favorites);

  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState<TabId>("overview");
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refresh relative timestamps periodically.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

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
    refetch: refetchProfile,
    dataUpdatedAt,
    isFetching: profileFetching,
    error: profileError,
  } = useQuery({
    queryKey: ["profile", username],
    queryFn: () => fetchProfile(username),
    enabled: !authLoading && !isOwn,
    retry: false,
    staleTime: 10_000,
    refetchInterval: isOwn ? false : REFETCH_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const libraryQuery = useQuery({
    queryKey: ["library", user?.uid ?? "guest"],
    queryFn: async () => {
      if (user) {
        // Merge server + local so UI updates instantly after list changes
        let serverItems: Awaited<ReturnType<typeof fetchLibrary>>["items"] = [];
        try {
          const res = await fetchLibrary();
          serverItems = res.items ?? [];
        } catch (error) {
          if (!readLocalLibrary(user.uid).length) throw error;
          serverItems =
            queryClient.getQueryData<Awaited<ReturnType<typeof fetchLibrary>>>([
              "library",
              user.uid,
            ])?.items ?? [];
        }
        const local = readLocalLibrary(user.uid);
        const byId = new Map<
          string,
          {
            id: string;
            uid: string;
            contentId: string;
            status: LibraryStatus;
            rating: number | null;
            progress: { episode: number; season: number; percent: number };
            notes: string;
            updatedAt: string;
            createdAt: string;
          }
        >();
        for (const i of serverItems) {
          byId.set(i.contentId, {
            id: i.id,
            uid: i.uid,
            contentId: i.contentId,
            status: i.status,
            rating: i.rating ?? null,
            progress: i.progress ?? { episode: 0, season: 0, percent: 0 },
            notes: i.notes ?? "",
            updatedAt: i.updatedAt,
            createdAt: i.createdAt,
          });
        }
        for (const i of local) {
          const prev = byId.get(i.contentId);
          const localTs = new Date(i.updatedAt).getTime();
          const prevTs = prev ? new Date(prev.updatedAt).getTime() : 0;
          if (!prev || localTs >= prevTs) {
            byId.set(i.contentId, {
              id: prev?.id ?? i.contentId,
              uid: user.uid,
              contentId: i.contentId,
              status: i.status,
              rating: i.rating ?? null,
              progress: i.progress ?? { episode: 0, season: 0, percent: 0 },
              notes: i.notes ?? "",
              updatedAt: i.updatedAt,
              createdAt: i.createdAt,
            });
          }
        }
        return {
          items: Array.from(byId.values()).sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
          ),
        };
      }
      return {
        items: guestLibrary.map((g) => ({
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
    staleTime: 5_000,
    refetchInterval: REFETCH_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const favoritesQuery = useQuery({
    queryKey: ["favorites", user?.uid ?? "guest"],
    queryFn: async () => {
      if (user) {
        return await fetchFavorites();
      }
      return {
        items: guestFavorites.map((contentId) => ({
          id: contentId,
          uid: "guest",
          contentId,
          createdAt: new Date().toISOString(),
        })),
      };
    },
    enabled: isOwn,
    staleTime: 5_000,
    refetchInterval: REFETCH_MS,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Guest store + multi-tab storage → instant profile stats
  useEffect(() => {
    if (!isOwn) return;
    const onStorage = (e: StorageEvent) => {
      if (
        !e.key ||
        e.key.includes("library") ||
        e.key.includes("favorite") ||
        e.key.includes("profile")
      ) {
        void queryClient.invalidateQueries({ queryKey: ["library"] });
        void queryClient.invalidateQueries({ queryKey: ["favorites"] });
      }
    };
    const onFocus = () => {
      void libraryQuery.refetch();
      void favoritesQuery.refetch();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only wire listeners once per isOwn
  }, [isOwn, queryClient]);

  const profile: UserProfile | null = useMemo(() => {
    if (isOwn && user) {
      const base = mergeProfile(data?.profile ?? null, localOwn, user);
      const lib = libraryQuery.data?.items ?? [];
      const favs = favoritesQuery.data?.items ?? [];
      return {
        ...base,
        avatarUrl: base.avatarUrl ?? user.photoURL ?? null,
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
    return Array.from(ids);
  }, [libraryQuery.data, favoritesQuery.data]);

  const postersQuery = useQuery({
    queryKey: ["profile-posters", contentIds.join(",")],
    queryFn: async () => {
      const map: Record<string, Content | null> = {};
      const remaining = [...contentIds];
      await Promise.all(
        Array.from({ length: Math.min(6, remaining.length) }, async () => {
          while (remaining.length) {
            const id = remaining.shift()!;
            try {
              map[id] = await fetchContentById(id);
            } catch {
              map[id] = null;
            }
          }
        }),
      );
      return map;
    },
    enabled: isOwn && contentIds.length > 0,
    staleTime: 90_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!profile || editing) return;
    const t = window.setTimeout(() => {
      setDisplayName(profile.displayName);
      setBio(profile.bio ?? "");
    }, 0);
    return () => window.clearTimeout(t);
  }, [profile, editing]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      isOwn ? libraryQuery.refetch() : refetchProfile(),
      isOwn ? favoritesQuery.refetch() : Promise.resolve(),
    ]);
  }, [isOwn, libraryQuery, favoritesQuery, refetchProfile]);

  const isSyncing =
    profileFetching || libraryQuery.isFetching || favoritesQuery.isFetching;

  const lastSyncIso = useMemo(() => {
    const times = [
      dataUpdatedAt || 0,
      libraryQuery.dataUpdatedAt || 0,
      favoritesQuery.dataUpdatedAt || 0,
    ].filter(Boolean);
    if (!times.length) return null;
    return new Date(Math.max(...times)).toISOString();
  }, [dataUpdatedAt, libraryQuery.dataUpdatedAt, favoritesQuery.dataUpdatedAt]);

  if (authLoading || (!isOwn && isLoading)) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-24 pt-24">
        <div className="h-56 skeleton rounded-3xl" />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 skeleton rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-32 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--primary)]/20 text-[var(--primary-light)] ring-4 ring-[var(--primary)]/10">
          <UserRound className="h-8 w-8" />
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold">
          {profileError &&
          (!(profileError instanceof ApiError) || profileError.status !== 404)
            ? "Unable to load profile"
            : "Profile not found"}
        </h1>
        <p className="mt-2 text-[var(--text-muted)]">
          {profileError &&
          (!(profileError instanceof ApiError) || profileError.status !== 404)
            ? "Check your connection and try again."
            : "This profile is private or does not exist."}
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
      if (!isOwn) await refetchProfile();
    } catch {
      setError("Your changes could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const stats = [
    {
      label: "Watched",
      value: profile.stats?.watched ?? 0,
    },
    {
      label: "Watching",
      value: profile.stats?.watching ?? 0,
    },
    {
      label: "Plan",
      value: profile.stats?.planToWatch ?? 0,
    },
    {
      label: "Favorites",
      value: profile.stats?.favorites ?? 0,
    },
    {
      label: "Reviews",
      value: profile.stats?.reviews ?? 0,
    },
  ] as const;

  const libraryItems = libraryQuery.data?.items ?? [];
  const libraryByStatus = (status: LibraryStatus) =>
    libraryItems.filter((i) => i.status === status);

  const recentActivity = libraryItems.slice(0, 12);
  const hour = new Date(now).getHours();
  const greeting = greetingForHour(hour);
  const initial = (profile.displayName || "?").slice(0, 1).toUpperCase();
  const avatarUrl =
    profile.avatarUrl ?? (isOwn ? user?.photoURL : null) ?? null;

  const tabs: Array<{ id: TabId; label: string; icon: typeof Activity }> = [
    { id: "overview", label: "Overview", icon: Compass },
    { id: "library", label: "Library", icon: Film },
    { id: "favorites", label: "Favorites", icon: Heart },
    { id: "activity", label: "Activity", icon: Activity },
  ];

  return (
    <div className="relative min-h-dvh overflow-hidden pb-28 pt-20">
      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6">
        {/* Hero card */}
        <motion.section
          variants={reduce ? undefined : fadeUp}
          initial={reduce ? false : "hidden"}
          animate={reduce ? undefined : "visible"}
          className="overflow-hidden rounded-2xl bg-[var(--surface)]"
        >
          <div className="flex min-h-16 items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <p className="text-sm text-[var(--text-secondary)]">
              {isOwn ? "Your life in film" : "Life in film"}
            </p>
            {isOwn && (
              <button
                type="button"
                onClick={() => void refreshAll()}
                disabled={isSyncing}
                className="flex min-h-11 items-center gap-2 rounded-full px-3 text-sm text-[var(--text-secondary)] hover:bg-white/10 disabled:opacity-50"
                aria-label="Refresh profile"
              >
                <RefreshCw
                  className={cn("h-4 w-4", isSyncing && "animate-spin")}
                />
                {isSyncing ? "Refreshing" : "Refresh"}
              </button>
            )}
          </div>
          <div className="relative px-5 pb-6 pt-0 sm:px-8 sm:pb-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-6">
              {/* Avatar overlapping banner */}
              <div className="relative mx-auto sm:mx-0">
                <div className="relative h-24 w-24 overflow-hidden rounded-full bg-[var(--surface-elevated)] sm:h-28 sm:w-28">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={profile.displayName}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-white sm:text-4xl">
                      {initial}
                    </div>
                  )}
                </div>
              </div>

              <div className="min-w-0 flex-1 text-center sm:pb-1 sm:text-left">
                {isOwn && (
                  <p className="text-xs font-medium text-[var(--primary-light)]">
                    {greeting}
                  </p>
                )}
                <div className="mt-0.5 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <h1 className="break-words [overflow-wrap:anywhere] font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    {profile.displayName}
                  </h1>
                  {isOwn && <Badge tone="primary">You</Badge>}
                </div>
                <p className="mt-1 text-[var(--text-muted)]">
                  @{profile.username}
                </p>
                <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-[var(--text-secondary)] sm:justify-start">
                  {isOwn && isSyncing && (
                    <span className="text-[var(--primary-light)]">
                      · syncing…
                    </span>
                  )}
                  {isOwn && lastSyncIso && !isSyncing && (
                    <span className="text-[var(--text-muted)]">
                      · updated {relativeTime(lastSyncIso)}
                    </span>
                  )}
                </p>

                {!editing && profile.bio ? (
                  <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">
                    {profile.bio}
                  </p>
                ) : !editing && isOwn ? (
                  <p className="mt-3 text-sm text-[var(--text-muted)]">
                    Add a bio — what are you watching this season?
                  </p>
                ) : null}
              </div>

              {isOwn && (
                <div className="flex flex-wrap justify-center gap-2 sm:justify-end sm:pb-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={saving}
                    onClick={() => {
                      setDisplayName(profile.displayName);
                      setBio(profile.bio ?? "");
                      setError(null);
                      setEditing((v) => !v);
                    }}
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

            <AnimatePresence>
              {editing && isOwn && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: 6 }}
                  className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-black/35 p-5"
                >
                  <label className="block text-sm text-[var(--text-secondary)]">
                    Display name
                    <Input
                      className="mt-1"
                      maxLength={80}
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
                    <span className="mt-1 block text-right text-[10px] text-[var(--text-muted)]">
                      {bio.length}/280
                    </span>
                  </label>
                  {error && (
                    <p role="alert" className="text-sm text-[var(--danger)]">
                      {error}
                    </p>
                  )}
                  <Button onClick={save} disabled={saving}>
                    {saving ? "Saving…" : "Save profile"}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.section>

        {/* Account stats */}
        <motion.dl
          className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5"
          variants={reduce ? undefined : staggerContainer}
          initial={reduce ? false : "hidden"}
          animate={reduce ? undefined : "visible"}
        >
          {stats.map(({ label, value }) => (
            <motion.div
              key={label}
              variants={reduce ? undefined : staggerItem}
              className="px-4 py-3"
            >
              <dt className="text-sm text-[var(--text-muted)]">{label}</dt>
              <dd className="mt-1 font-display text-3xl font-semibold tabular-nums text-white">
                {isOwn &&
                label !== "Reviews" &&
                (label === "Favorites"
                  ? !favoritesQuery.data
                  : !libraryQuery.data)
                  ? "\u2014"
                  : value}
              </dd>
            </motion.div>
          ))}
        </motion.dl>

        {isOwn && (
          <>
            {(libraryQuery.isError || favoritesQuery.isError) && (
              <p
                role="alert"
                className="mt-6 rounded-xl bg-[var(--surface)] p-4 text-sm"
              >
                Some library data could not be refreshed. Use Refresh to try
                again.
              </p>
            )}
            {/* Tabs */}
            <div className="mt-8 flex flex-wrap gap-2">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  aria-pressed={tab === id}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                    tab === id
                      ? "bg-white text-black"
                      : "bg-white/5 text-[var(--text-secondary)] hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 opacity-80" />
                  {label}
                  {id === "library" && libraryItems.length > 0 && (
                    <span className="ml-0.5 rounded-full bg-white/15 px-1.5 text-[10px] tabular-nums">
                      {libraryItems.length}
                    </span>
                  )}
                  {id === "favorites" &&
                    (favoritesQuery.data?.items.length ?? 0) > 0 && (
                      <span className="ml-0.5 rounded-full bg-white/15 px-1.5 text-[10px] tabular-nums">
                        {favoritesQuery.data!.items.length}
                      </span>
                    )}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: 4 }}
                transition={{ duration: 0.18 }}
              >
                {tab === "overview" && (
                  <div className="mt-6 space-y-6">
                    {libraryItems.length > 0 && (
                      <section className="rounded-2xl bg-[var(--surface)] p-5">
                        <div className="flex items-center justify-between gap-3">
                          <h2 className="font-display text-lg font-semibold">
                            Your library
                          </h2>
                          <button
                            type="button"
                            onClick={() => setTab("library")}
                            className="min-h-11 rounded-lg px-3 text-sm hover:bg-white/10"
                          >
                            View all {libraryItems.length} titles
                          </button>
                        </div>
                        <dl className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-5">
                          {(
                            [
                              "watching",
                              "plan_to_watch",
                              "completed",
                              "on_hold",
                              "dropped",
                            ] as const
                          ).map((status) => (
                            <div key={status}>
                              <dt className="text-sm text-[var(--text-muted)]">
                                {statusLabel(status)}
                              </dt>
                              <dd className="mt-1 text-xl tabular-nums">
                                {libraryByStatus(status).length}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </section>
                    )}

                    {/* Recent watching strip */}
                    {libraryByStatus("watching").length > 0 && (
                      <section>
                        <div className="mb-3 flex items-center justify-between">
                          <h2 className="font-display text-lg font-semibold text-white">
                            Currently watching
                          </h2>
                          <button
                            type="button"
                            onClick={() => setTab("library")}
                            className="text-xs font-medium text-[var(--primary-light)] hover:underline"
                          >
                            View all
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                          {libraryByStatus("watching")
                            .slice(0, 5)
                            .map((i) => (
                              <PosterCard
                                key={i.contentId}
                                contentId={i.contentId}
                                content={postersQuery.data?.[i.contentId]}
                                badge="Watching"
                              />
                            ))}
                        </div>
                      </section>
                    )}

                    <div className="grid gap-4 sm:grid-cols-2">
                      <QuickLink
                        href="/watchlist"
                        title="Watchlist"
                        desc="Titles you plan to watch"
                        icon={Bookmark}
                      />
                      <QuickLink
                        href="/favorites"
                        title="Favorites"
                        desc="Your top picks"
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
                        desc="Account · anime titles · audio"
                        icon={Settings}
                      />
                      <QuickLink
                        href="/discover"
                        title="Discover"
                        desc="Find something new to watch"
                        icon={Compass}
                      />
                      <QuickLink
                        href="/anime"
                        title="Anime"
                        desc="Series, movies & more"
                        icon={Tv}
                      />
                    </div>
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
                    <LibrarySection
                      title="On hold"
                      items={libraryByStatus("on_hold")}
                      posters={postersQuery.data}
                    />
                    <LibrarySection
                      title="Dropped"
                      items={libraryByStatus("dropped")}
                      posters={postersQuery.data}
                    />
                    {libraryQuery.isPending && (
                      <p role="status">Loading your library...</p>
                    )}
                    {libraryItems.length === 0 &&
                      !libraryQuery.isPending &&
                      !libraryQuery.isError && (
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
                    {favoritesQuery.isPending ? (
                      <p role="status">Loading your favorites...</p>
                    ) : favoritesQuery.isError ? (
                      <p>Favorites are temporarily unavailable.</p>
                    ) : (favoritesQuery.data?.items.length ?? 0) === 0 ? (
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
                            badge="Favorite"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {tab === "activity" && (
                  <div className="mt-6">
                    {recentActivity.length === 0 ? (
                      <EmptyState
                        title="No activity yet"
                        href="/discover"
                        cta="Start watching"
                      />
                    ) : (
                      <ul className="space-y-2">
                        {recentActivity.map((item) => {
                          const content =
                            postersQuery.data?.[item.contentId] ?? null;
                          const title = content
                            ? displayTitle(content)
                            : item.contentId;
                          const href = content
                            ? getDetailsHref(content)
                            : `/content/${encodeURIComponent(item.contentId)}`;
                          return (
                            <li key={`${item.contentId}-${item.updatedAt}`}>
                              <Link
                                href={href}
                                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-[var(--primary)]/35 hover:bg-white/[0.06]"
                              >
                                <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--surface)]">
                                  {content?.poster?.url ? (
                                    <Image
                                      src={content.poster.url}
                                      alt=""
                                      fill
                                      className="object-cover"
                                      unoptimized
                                    />
                                  ) : (
                                    <div className="flex h-full items-center justify-center">
                                      <Film className="h-4 w-4 text-[var(--text-muted)]" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-white">
                                    {title}
                                  </p>
                                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                                    {statusLabel(item.status)}
                                    {item.updatedAt
                                      ? ` · ${relativeTime(item.updatedAt)}`
                                      : ""}
                                  </p>
                                </div>
                                <Badge tone="muted">
                                  {statusLabel(item.status)}
                                </Badge>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
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
      className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-0.5 hover:border-[var(--primary)]/40 hover:bg-white/[0.07]"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/20 text-[var(--primary-light)] transition group-hover:bg-[var(--primary)]/30 group-hover:scale-105">
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
  const [visibleCount, setVisibleCount] = useState(15);
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
        {items.slice(0, visibleCount).map((i) => (
          <PosterCard
            key={i.contentId}
            contentId={i.contentId}
            content={posters?.[i.contentId]}
          />
        ))}
      </div>
      {items.length > visibleCount && (
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => setVisibleCount((count) => count + 15)}
        >
          Show more ({items.length - visibleCount} remaining)
        </Button>
      )}
    </section>
  );
}

function PosterCard({
  contentId,
  content,
  badge,
}: {
  contentId: string;
  content?: Content | null;
  badge?: string;
}) {
  const title = content ? displayTitle(content) : contentId;
  const href = content
    ? getDetailsHref(content)
    : `/content/${encodeURIComponent(contentId)}`;
  const src = content?.poster?.url;

  return (
    <Link
      href={href}
      aria-label={title}
      className="group relative aspect-[2/3] overflow-hidden rounded-xl border border-white/10 bg-[var(--surface)] transition hover:-translate-y-1 hover:border-[var(--primary)]/45"
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
      {badge && (
        <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
          {badge}
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent p-2.5 pt-8">
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
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-14 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)]/15 text-[var(--primary-light)]">
        <Sparkles className="h-5 w-5" />
      </div>
      <p className="font-display text-lg text-white">{title}</p>
      <Link href={href} className="mt-4 inline-block">
        <Button variant="secondary" size="sm">
          {cta}
        </Button>
      </Link>
    </div>
  );
}

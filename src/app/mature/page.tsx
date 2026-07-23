"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Shield } from "lucide-react";
import { fetchMatureLibrary } from "@/lib/api/content";
import { ContentCard } from "@/components/content/content-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { PinGateModal } from "@/components/content/pin-gate";
import { isMatureEnabledClient } from "@/lib/user/local-profile";
import {
  hasParentalPin,
  isMatureSessionUnlocked,
  setMatureSessionUnlocked,
  verifyParentalPin,
} from "@/lib/user/mature-pin";
import { useAuthStore } from "@/stores/auth-store";
import { staggerContainer, staggerItem } from "@/lib/motion";

type Tab = "all" | "movie" | "series" | "anime" | "kdrama" | "cdrama" | "jdrama" | "thaidrama";

export default function MaturePage() {
  const user = useAuthStore((s) => s.user);
  const settings = useAuthStore((s) => s.settings);
  const loading = useAuthStore((s) => s.loading);
  const reduce = useReducedMotion();
  const [unlocked, setUnlocked] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(1);
  const [hydrated, setHydrated] = useState(false);

  const matureEnabled =
    Boolean(settings?.matureContent) || isMatureEnabledClient(user?.uid);
  const pinReady = hasParentalPin(user?.uid);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setHydrated(true);
      if (isMatureSessionUnlocked()) {
        setUnlocked(true);
        setGateOpen(false);
      } else {
        setUnlocked(false);
        setGateOpen(true);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [user?.uid, matureEnabled]);

  const typeForApi = tab === "all" ? undefined : tab;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mature-library", tab, page],
    queryFn: () =>
      fetchMatureLibrary({
        page,
        pageSize: 48,
        type: typeForApi,
      }),
    enabled: unlocked && matureEnabled,
    staleTime: 60_000,
  });

  if (loading || !hydrated) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-24 pt-32 text-center">
        <div className="mx-auto h-10 w-10 skeleton rounded-full" />
        <p className="mt-4 text-sm text-[var(--text-muted)]">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-24 pt-32 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-[var(--danger)]" />
        <h1 className="mt-4 font-display text-3xl font-bold text-white">
          18+ Mature library
        </h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          Sign in, set a parental PIN in Settings, and enable 18+ mature content
          to open this library.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/login">
            <Button>Sign in</Button>
          </Link>
          <Link href="/">
            <Button variant="outline">Leave</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!matureEnabled || !pinReady) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-24 pt-32 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-[var(--danger)]" />
        <h1 className="mt-4 font-display text-3xl font-bold text-white">
          18+ Mature library locked
        </h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          {!pinReady
            ? "Create a parental PIN in Settings, then enable “Show 18+ mature titles” (PIN required)."
            : "18+ mature is off in your profile settings. Turn it on under Settings → 18+ mature content (requires your PIN). The 18+ tab only appears when enabled."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/settings">
            <Button>Open Settings</Button>
          </Link>
          <Link href="/">
            <Button variant="outline">Leave</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <>
        <div className="mx-auto max-w-lg px-4 pb-24 pt-32 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-[var(--danger)]" />
          <h1 className="mt-4 font-display text-3xl font-bold text-white">
            18+ Mature library
          </h1>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            Enter your parental PIN to unlock mature movies, series, and anime
            for this session.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={() => setGateOpen(true)}>Enter PIN</Button>
            <Link href="/">
              <Button variant="outline">Leave</Button>
            </Link>
          </div>
        </div>
        <PinGateModal
          open={gateOpen}
          mode="verify"
          title="Unlock 18+ library"
          description="Enter your parental PIN. This stops kids from browsing mature titles."
          confirmLabel="Unlock 18+"
          verifyPin={(pin) => verifyParentalPin(user.uid, pin)}
          onCancel={() => {
            window.location.href = "/";
          }}
          onSuccess={() => {
            setMatureSessionUnlocked(true);
            setUnlocked(true);
            setGateOpen(false);
          }}
        />
      </>
    );
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "all", label: "All 18+" },
    { id: "movie", label: "Movies" },
    { id: "series", label: "Series" },
    { id: "anime", label: "Anime" },
    { id: "kdrama", label: "K-Drama" },
    { id: "cdrama", label: "C-Drama" },
    { id: "jdrama", label: "J-Drama" },
    { id: "thaidrama", label: "Thai Drama" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-24 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--danger)]">
            Age-restricted · 18+ · PIN unlocked
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-white sm:text-4xl">
            Mature library
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
            Adults-only titles (18+ / R18 / NC-17 / provider-adult / explicit).
            These never appear on Home or regular Movies · Series · Anime · Drama
            catalogs — only here when 18+ is enabled.
          </p>
        </div>
        <Badge tone="primary" className="gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          PIN verified
        </Badge>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Chip
            key={t.id}
            active={tab === t.id}
            onClick={() => {
              setTab(t.id);
              setPage(1);
            }}
            className={
              tab === t.id
                ? "!bg-[var(--danger)] text-white"
                : undefined
            }
          >
            {t.label}
          </Chip>
        ))}
      </div>

      {isLoading && (
        <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] skeleton rounded-xl" />
          ))}
        </div>
      )}

      {isError && (
        <p className="mt-10 text-center text-[var(--text-secondary)]">
          Could not load the mature catalog. Try again shortly.
        </p>
      )}

      {data && data.items.length === 0 && (
        <p className="mt-10 text-center text-[var(--text-secondary)]">
          No titles in this tab yet. Try another category.
        </p>
      )}

      {data && data.items.length > 0 && (
        <>
          <motion.div
            className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
            variants={reduce ? undefined : staggerContainer}
            initial={reduce ? false : "hidden"}
            animate={reduce ? undefined : "visible"}
          >
            {data.items.map((c) => (
              <motion.div
                key={c.id}
                variants={reduce ? undefined : staggerItem}
                className="will-change-transform"
              >
                {/* publicSafe not needed — ContentCard is raw; library is already adult-only */}
                <ContentCard content={c} className="!w-full !min-w-0" />
              </motion.div>
            ))}
          </motion.div>
          {data.totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-3">
              <Button
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-[var(--text-muted)]">
                Page {data.page} of {data.totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

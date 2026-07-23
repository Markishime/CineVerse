"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { fetchMatureLibrary } from "@/lib/api/content";
import { ContentCard } from "@/components/content/content-card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { isRestrictedContentUser } from "@/lib/content/mature";
import { useAuthStore } from "@/stores/auth-store";
import { staggerContainer, staggerItem } from "@/lib/motion";

type Tab = "all" | "movie" | "series" | "anime" | "kdrama" | "cdrama" | "jdrama" | "thaidrama";

export default function MaturePage() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(1);

  const allowed = isRestrictedContentUser(user?.email);

  const typeForApi = tab === "all" ? undefined : tab;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mature-library", tab, page],
    queryFn: () =>
      fetchMatureLibrary({
        page,
        pageSize: 48,
        type: typeForApi,
      }),
    enabled: allowed,
    staleTime: 60_000,
  });

  if (loading) {
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
          Sign in to view this library.
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

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg px-4 pb-24 pt-32 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-[var(--danger)]" />
        <h1 className="mt-4 font-display text-3xl font-bold text-white">
          Access restricted
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
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--danger)]">
          18+ · Mature content
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-white sm:text-4xl">
          Mature library
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
          Adults-only titles (18+ / R18 / NC-17 / provider-adult / explicit).
        </p>
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

"use client";

import Link from "next/link";
import Image from "next/image";
import { Bookmark, Compass, Play } from "lucide-react";
import type { Content } from "@/types/content";
import { Button } from "@/components/ui/button";
import { displayTitle, primaryScore } from "@/lib/content/normalize";
import { formatScore } from "@/lib/utils";

export function HeroStatic({ featured }: { featured: Content | null }) {
  const title = featured
    ? displayTitle(featured)
    : "Discover stories across the cosmos";
  const score = featured ? primaryScore(featured) : null;

  return (
    <section className="relative flex min-h-[88dvh] items-end overflow-hidden pb-16 pt-28 sm:items-center sm:pb-24">
      {featured?.backdrop?.url || featured?.poster?.url ? (
        <Image
          src={featured.backdrop?.url || featured.poster!.url}
          alt=""
          fill
          priority
          className="object-cover object-top opacity-50"
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(120,103,255,0.35),transparent_50%),radial-gradient(ellipse_at_80%_60%,rgba(49,215,245,0.15),transparent_45%),#05060A]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-[var(--background)]/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[var(--background)] via-transparent to-transparent" />

      {/* Orbital rings CSS fallback */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 hidden h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 sm:block"
        aria-hidden
      >
        <div className="absolute inset-0 animate-[spin_40s_linear_infinite] rounded-full border border-[var(--primary)]/20" />
        <div className="absolute inset-8 animate-[spin_55s_linear_infinite_reverse] rounded-full border border-[var(--secondary)]/15" />
        <div className="absolute inset-16 animate-[spin_70s_linear_infinite] rounded-full border border-[var(--accent)]/10" />
        <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] opacity-80 blur-[1px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-[var(--primary-light)]">
          CineVerse · Celestial Noir
        </p>
        <h1 className="max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
          {title}
        </h1>
        {featured?.overview && (
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base line-clamp-3">
            {featured.overview}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--text-muted)]">
          {featured?.year && <span>{featured.year}</span>}
          {score != null && (
            <span className="text-[var(--gold)]">★ {formatScore(score)}</span>
          )}
          {featured?.contentType && (
            <span className="capitalize">{featured.contentType}</span>
          )}
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          {featured?.trailer && (
            <Link
              href={`/content/${featured.slug}?play=trailer`}
              className="inline-flex"
            >
              <Button size="lg">
                <Play className="h-4 w-4" />
                Trailer
              </Button>
            </Link>
          )}
          <Link href="/discover">
            <Button size="lg" variant="secondary">
              <Compass className="h-4 w-4" />
              Explore
            </Button>
          </Link>
          {featured && (
            <Link href={`/content/${featured.slug}`}>
              <Button size="lg" variant="outline">
                <Bookmark className="h-4 w-4" />
                Details
              </Button>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

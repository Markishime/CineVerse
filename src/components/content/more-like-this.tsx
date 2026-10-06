"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Play, Star } from "lucide-react";
import { apiFetch, buildQuery } from "@/lib/api/client";
import type { SimilarTitle } from "@/lib/embed/similar";
import { cn } from "@/lib/utils";

interface MoreLikeThisProps {
  tmdbId: number;
  mediaType: "movie" | "tv";
  className?: string;
}

/** Related titles by TMDB recommendations, similarity and shared genres. */
export function MoreLikeThis({
  tmdbId,
  mediaType,
  className,
}: MoreLikeThisProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["similar", mediaType, tmdbId],
    queryFn: () =>
      apiFetch<{ items: SimilarTitle[] }>(
        `/similar${buildQuery({ tmdbId, type: mediaType })}`,
        { auth: false },
      ),
    staleTime: 10 * 60_000,
  });

  const items = data?.items ?? [];
  if (!isLoading && items.length === 0) return null;

  return (
    <section
      id="more-like-this"
      aria-labelledby="more-like-this-heading"
      className={cn("scroll-mt-24", className)}
    >
      <h2
        id="more-like-this-heading"
        className="mb-5 flex items-center gap-3 font-display text-xl font-bold text-white sm:text-2xl"
      >
        <span
          className="h-7 w-1 rounded-full bg-[var(--primary)] shadow-[var(--glow-primary)]"
          aria-hidden
        />
        More like this
      </h2>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <li key={i}>
                <div className="aspect-video skeleton rounded-xl" />
                <div className="mt-3 h-4 w-3/4 skeleton rounded" />
              </li>
            ))
          : items.map((item) => <SimilarCard key={item.tmdbId} item={item} />)}
      </ul>
    </section>
  );
}

function SimilarCard({ item }: { item: SimilarTitle }) {
  const image = item.backdrop ?? item.poster;
  return (
    <li>
      <Link
        href={item.href}
        className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <div className="relative aspect-video overflow-hidden rounded-xl bg-[var(--surface-elevated)] ring-1 ring-white/10 transition duration-300 group-hover:ring-[var(--primary)]/60 group-hover:shadow-[var(--glow-primary)]">
          {image && (
            <Image
              src={image}
              alt={item.title}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover transition duration-500 group-hover:scale-105"
              unoptimized
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition duration-300 group-hover:bg-black/45 group-hover:opacity-100">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black">
              <Play className="h-5 w-5 fill-current" aria-hidden />
            </span>
          </div>
        </div>
        <h3 className="c-primary mt-3 line-clamp-1 text-sm font-semibold transition-colors group-hover:!text-[var(--primary-light)] sm:text-base">
          {item.title}
        </h3>
        <p className="c-muted mt-1 flex items-center gap-2 text-xs">
          {item.rating != null && item.rating > 0 && (
            <span className="c-gold inline-flex items-center gap-1 font-medium">
              <Star className="h-3 w-3 fill-current" aria-hidden />
              {item.rating.toFixed(1)}
            </span>
          )}
          {item.year && <span>{item.year}</span>}
          <span>{item.mediaType === "movie" ? "Movie" : "TV Show"}</span>
        </p>
      </Link>
    </li>
  );
}

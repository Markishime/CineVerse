"use client";

import useEmblaCarousel from "embla-carousel-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import {
  listContinueWatching,
  removeContinueWatching,
  type ContinueWatchingItem,
} from "@/lib/content/watch-progress";
import { useAuthStore } from "@/stores/auth-store";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { easeOutExpo, inViewOnce } from "@/lib/motion";

const typeLabel: Record<string, string> = {
  movie: "Movie",
  series: "Series",
  anime: "Anime",
  kdrama: "K-Drama",
};

/**
 * Netflix-style Continue Watching row (per signed-in user or guest device).
 */
export function ContinueWatchingRow({
  className,
  title = "Continue watching",
}: {
  className?: string;
  title?: string;
}) {
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState<ContinueWatchingItem[]>([]);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    dragFree: true,
    containScroll: "trimSnaps",
  });

  const refresh = useCallback(() => {
    setItems(listContinueWatching(user?.uid));
  }, [user?.uid]);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key?.includes("continue_watching")) refresh();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    const id = window.setInterval(refresh, 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      window.clearInterval(id);
    };
  }, [refresh]);

  const reduce = useReducedMotion();

  if (!items.length) return null;

  return (
    <motion.section
      className={cn("relative space-y-3", className)}
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={inViewOnce}
      transition={{ duration: 0.5, ease: easeOutExpo }}
    >
      <div className="flex items-end justify-between gap-4 px-1">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
            Pick up where you left off · movies · series · anime · K-drama
          </p>
        </div>
        <div className="hidden gap-1 sm:flex">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Scroll left"
            onClick={() => emblaApi?.scrollPrev()}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Scroll right"
            onClick={() => emblaApi?.scrollNext()}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-3">
          {items.map((item) => (
            <ContinueCard
              key={item.contentId}
              item={item}
              uid={user?.uid}
              onRemove={() => {
                removeContinueWatching(item.contentId, user?.uid);
                refresh();
              }}
            />
          ))}
        </div>
      </div>
    </motion.section>
  );
}

function ContinueCard({
  item,
  onRemove,
}: {
  item: ContinueWatchingItem;
  uid?: string | null;
  onRemove: () => void;
}) {
  const img = item.backdropUrl || item.posterUrl;
  const epLabel =
    item.contentType !== "movie" && item.season != null && item.episode != null
      ? `S${item.season} · E${item.episode}`
      : null;
  const percent = Math.min(100, Math.max(0, item.percent ?? 35));

  return (
    <div className="group relative w-[220px] shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[var(--surface)] sm:w-[260px]">
      <Link href={item.href} className="block">
        <div className="relative aspect-video bg-[#0c0c12]">
          {img ? (
            <Image
              src={img}
              alt={item.title}
              fill
              className="object-cover transition group-hover:scale-105"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#1a1a28] to-[#2a2040] p-3 text-center text-sm font-semibold text-white">
              {item.title}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--gold)] text-[#1a1408] shadow-xl">
              <Play className="h-5 w-5 fill-current" />
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/15">
            <div
              className="h-full bg-[var(--primary)]"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="absolute left-2 top-2">
            <Badge tone="muted">{typeLabel[item.contentType] ?? item.contentType}</Badge>
          </div>
        </div>
        <div className="space-y-0.5 p-2.5">
          <h3 className="line-clamp-1 font-display text-sm font-semibold text-white">
            {item.title}
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            {epLabel ? `Resume ${epLabel}` : "Resume"}
            {item.year ? ` · ${item.year}` : ""}
          </p>
        </div>
      </Link>
      <button
        type="button"
        aria-label="Remove from Continue watching"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

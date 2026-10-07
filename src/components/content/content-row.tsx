"use client";

import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Content } from "@/types/content";
import { ContentCard } from "./content-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { inViewOnce, rowEnter } from "@/lib/motion";
import { filterPublicCatalog } from "@/lib/content/mature";
import { ensureContentPoster } from "@/lib/content/posters";

/** Placeholder row shown while data loads or before a row nears the viewport. */
export function ContentRowSkeleton({
  title,
  wide,
  className,
}: {
  title?: string;
  wide?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("space-y-3", className)}
      aria-busy="true"
      aria-label={title ? `Loading ${title}` : "Loading"}
    >
      {title ? (
        <h2 className="px-1 font-display text-xl font-semibold tracking-tight text-white sm:text-2xl">
          {title}
        </h2>
      ) : (
        <div className="h-7 w-48 skeleton rounded" />
      )}
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex-none">
            <div
              className={cn(
                "skeleton rounded-lg",
                wide
                  ? "aspect-video w-[220px] sm:w-[280px]"
                  : "aspect-[2/3] w-[140px] sm:w-[160px]",
              )}
            />
            <div className="mt-2 h-3.5 w-3/4 skeleton rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ContentRow({
  title,
  subtitle,
  items,
  wide,
  className,
  showRank,
  /** When true (default), strip 18+ so rows never leak adult titles on public surfaces */
  publicSafe = true,
  /** Mount immediately (above-the-fold rows); others mount when scrolled near */
  eager = false,
}: {
  title: string;
  subtitle?: string;
  items: Content[];
  wide?: boolean;
  className?: string;
  showRank?: boolean;
  publicSafe?: boolean;
  eager?: boolean;
}) {
  const reduce = useReducedMotion() ?? false;
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    dragFree: true,
    containScroll: "trimSnaps",
  });
  const hostRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(eager);

  const uniqueItems = useMemo(() => {
    const source = publicSafe ? filterPublicCatalog(items ?? []) : (items ?? []);
    const seen = new Set<string>();
    const out: Content[] = [];
    for (const item of source) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      // Guarantee every card has a poster (fixes blank K-drama / seed art)
      out.push(ensureContentPoster(item));
    }
    return out;
  }, [items, publicSafe]);

  const hasItems = uniqueItems.length > 0;
  useEffect(() => {
    if (near || !hasItems) return;
    const el = hostRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      const t = window.setTimeout(() => setNear(true), 0);
      return () => window.clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "700px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near, hasItems]);

  // Never render an empty section
  if (!hasItems) return null;

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: wide ? "auto 260px" : "auto 360px",
      }}
    >
      {near ? (
        <ContentRowInner
          title={title}
          subtitle={subtitle}
          items={uniqueItems}
          wide={wide}
          showRank={showRank}
          reduce={reduce}
          emblaRef={emblaRef}
          emblaApi={emblaApi}
          eager={eager}
        />
      ) : (
        <ContentRowSkeleton title={title} wide={wide} />
      )}
    </div>
  );
}

function ContentRowInner({
  title,
  subtitle,
  items,
  wide,
  showRank,
  reduce,
  emblaRef,
  emblaApi,
  eager,
}: {
  title: string;
  subtitle?: string;
  items: Content[];
  wide?: boolean;
  showRank?: boolean;
  reduce: boolean;
  emblaRef: (node: HTMLElement | null) => void;
  emblaApi: ReturnType<typeof useEmblaCarousel>[1];
  eager: boolean;
}) {
  return (
    <motion.section
      className="relative space-y-3"
      initial={false}
      whileInView={reduce ? undefined : rowEnter.animate}
      viewport={inViewOnce}
      transition={rowEnter.transition}
      aria-label={title}
    >
      <div className="flex items-end justify-between gap-4 px-1">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-sm text-[var(--text-muted)]">{subtitle}</p>
          )}
        </div>
        <div className="hidden shrink-0 gap-1 sm:flex">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Scroll ${title} left`}
            className="h-9 w-9 border border-white/10 bg-[var(--surface)] hover:bg-white/8"
            onClick={() => emblaApi?.scrollPrev()}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Scroll ${title} right`}
            className="h-9 w-9 border border-white/10 bg-[var(--surface)] hover:bg-white/8"
            onClick={() => emblaApi?.scrollNext()}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
      <div className="-my-4 overflow-hidden py-4" ref={emblaRef}>
        <div className="flex gap-3 pb-1">
          {items.map((item, i) => (
            <ContentCard
              key={`${title}-${item.id}`}
              content={item}
              wide={wide}
              rank={showRank ? i + 1 : undefined}
              priority={eager && i < 6}
            />
          ))}
        </div>
      </div>
    </motion.section>
  );
}

"use client";

import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import type { Content } from "@/types/content";
import { ContentCard } from "./content-card";
import { Button } from "@/components/ui/button";
import { inViewOnce, rowEnter } from "@/lib/motion";
import { filterPublicCatalog } from "@/lib/content/mature";
import { ensureContentPoster } from "@/lib/content/posters";

export function ContentRow({
  title,
  subtitle,
  items,
  wide,
  className,
  showRank,
  /** When true (default), strip 18+ so rows never leak adult titles on public surfaces */
  publicSafe = true,
}: {
  title: string;
  subtitle?: string;
  items: Content[];
  wide?: boolean;
  className?: string;
  showRank?: boolean;
  publicSafe?: boolean;
}) {
  const reduce = useReducedMotion() ?? false;
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    dragFree: true,
    containScroll: "trimSnaps",
  });

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

  if (!uniqueItems.length) return null;

  return (
    <div className={className} style={{ contentVisibility: "auto", containIntrinsicSize: wide ? "auto 260px" : "auto 360px" }}>
      <ContentRowInner
        title={title}
        subtitle={subtitle}
        items={uniqueItems}
        wide={wide}
        showRank={showRank}
        reduce={reduce}
        emblaRef={emblaRef}
        emblaApi={emblaApi}
      />
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
}: {
  title: string;
  subtitle?: string;
  items: Content[];
  wide?: boolean;
  showRank?: boolean;
  reduce: boolean;
  emblaRef: (node: HTMLElement | null) => void;
  emblaApi: ReturnType<typeof useEmblaCarousel>[1];
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
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-3 pb-1">
          {items.map((item, i) => (
            <ContentCard
              key={`${title}-${item.id}`}
              content={item}
              wide={wide}
              rank={showRank ? i + 1 : undefined}
            />
          ))}
        </div>
      </div>
    </motion.section>
  );
}

"use client";

import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import type { Content } from "@/types/content";
import { ContentCard } from "./content-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { easeOutExpo, inViewOnce } from "@/lib/motion";

export function ContentRow({
  title,
  subtitle,
  items,
  wide,
  className,
  showRank,
}: {
  title: string;
  subtitle?: string;
  items: Content[];
  wide?: boolean;
  className?: string;
  showRank?: boolean;
}) {
  const reduce = useReducedMotion();
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    dragFree: true,
    containScroll: "trimSnaps",
  });

  // Guard against duplicate ids from live catalog merges (React key warnings)
  const uniqueItems = (() => {
    const seen = new Set<string>();
    const out: Content[] = [];
    for (const item of items ?? []) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
    return out;
  })();

  if (!uniqueItems.length) return null;

  return (
    <motion.section
      className={cn("relative space-y-3", className)}
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={inViewOnce}
      transition={{ duration: 0.5, ease: easeOutExpo }}
    >
      <div className="flex items-end justify-between gap-4 px-1">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
              {subtitle}
            </p>
          )}
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
          {uniqueItems.map((item, i) => (
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

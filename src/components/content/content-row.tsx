"use client";

import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useRef, useState, useEffect, useMemo, type ReactNode } from "react";
import type { Content } from "@/types/content";
import { ContentCard } from "./content-card";
import { Button } from "@/components/ui/button";
import { easeOutExpo, inViewOnce } from "@/lib/motion";

function LazyRender({
  children,
  className,
  rootMargin = "400px 0px",
}: {
  children: ReactNode;
  className?: string;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className={className}>
      {visible ? children : <div className="h-48" />}
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
}: {
  title: string;
  subtitle?: string;
  items: Content[];
  wide?: boolean;
  className?: string;
  showRank?: boolean;
}) {
  const reduce = useReducedMotion() ?? false;
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    dragFree: true,
    containScroll: "trimSnaps",
  });

  const uniqueItems = useMemo(() => {
    const seen = new Set<string>();
    const out: Content[] = [];
    for (const item of items ?? []) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
    return out;
  }, [items]);

  if (!uniqueItems.length) return null;

  return (
    <LazyRender className={className}>
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
    </LazyRender>
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
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={inViewOnce}
      transition={{ duration: 0.4, ease: easeOutExpo }}
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

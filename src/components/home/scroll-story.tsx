"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { SCROLL_CHAPTERS } from "@/data/scroll-chapters";
import { ScrollVideoBg } from "./scroll-video-bg";
import { usePerformanceStore } from "@/stores/performance-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ScrollDepthCanvas = dynamic(
  () => import("./scroll-depth-canvas").then((m) => m.ScrollDepthCanvas),
  { ssr: false, loading: () => null },
);

/**
 * Seamless cinematic 3D scroll — no section borders.
 * Always cinematic when WebGL + motion allowed.
 */
export function ScrollStory() {
  const root = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [progresses, setProgresses] = useState<number[]>(() =>
    SCROLL_CHAPTERS.map(() => 0),
  );
  const effective = usePerformanceStore((s) => s.effective);
  const reducedMotion = usePerformanceStore((s) => s.reducedMotion);

  const isDesktop = useCallback(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 768px)").matches;
  }, []);

  useEffect(() => {
    const rootEl = root.current;
    if (!rootEl) return;
    const sections = Array.from(
      rootEl.querySelectorAll<HTMLElement>("[data-chapter]"),
    );
    const io = new IntersectionObserver(
      (entries) => {
        let best = 0;
        let bestRatio = 0;
        for (const e of entries) {
          if (e.intersectionRatio > bestRatio) {
            bestRatio = e.intersectionRatio;
            best = Number(e.target.getAttribute("data-index") ?? 0);
          }
        }
        if (bestRatio > 0.15) setActiveIndex(best);
      },
      { threshold: [0, 0.15, 0.35, 0.55, 0.75, 1] },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reducedMotion || effective === "performance") return;
    if (!isDesktop()) return;

    let ctx: { revert: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const gsap = (await import("gsap")).default;
        const { ScrollTrigger } = await import("gsap/ScrollTrigger");
        if (cancelled) return;
        gsap.registerPlugin(ScrollTrigger);

        ctx = gsap.context(() => {
          const panels = gsap.utils.toArray<HTMLElement>("[data-chapter]");

          panels.forEach((panel, i) => {
            const inner = panel.querySelector<HTMLElement>(
              "[data-chapter-inner]",
            );
            const media = panel.querySelector<HTMLElement>(
              "[data-chapter-media]",
            );
            const glow = panel.querySelector<HTMLElement>(
              "[data-chapter-glow]",
            );
            const veil = panel.querySelector<HTMLElement>(
              "[data-chapter-veil]",
            );

            ScrollTrigger.create({
              trigger: panel,
              start: "top top",
              end: "+=120%",
              pin: true,
              pinSpacing: true,
              scrub: 1,
              anticipatePin: 1,
              onUpdate: (self) => {
                if (Math.abs((progresses[i] ?? 0) - self.progress) > 0.025) {
                  setProgresses((prev) => {
                    const next = [...prev];
                    next[i] = self.progress;
                    return next;
                  });
                }
              },
            });

            if (inner) {
              gsap.fromTo(
                inner,
                {
                  y: 100,
                  opacity: 0,
                  scale: 0.9,
                  rotateX: 8,
                  filter: "blur(10px)",
                },
                {
                  y: 0,
                  opacity: 1,
                  scale: 1,
                  rotateX: 0,
                  filter: "blur(0px)",
                  ease: "none",
                  scrollTrigger: {
                    trigger: panel,
                    start: "top top",
                    end: "+=60%",
                    scrub: 1,
                  },
                },
              );
              gsap.to(inner, {
                y: -60,
                opacity: 0,
                scale: 1.04,
                ease: "none",
                scrollTrigger: {
                  trigger: panel,
                  start: "top+=60% top",
                  end: "+=40%",
                  scrub: 1,
                },
              });
            }

            if (media) {
              gsap.fromTo(
                media,
                { scale: 1.25, y: 40 },
                {
                  scale: 1,
                  y: -50,
                  ease: "none",
                  scrollTrigger: {
                    trigger: panel,
                    start: "top top",
                    end: "+=120%",
                    scrub: true,
                  },
                },
              );
            }

            if (veil) {
              gsap.fromTo(
                veil,
                { opacity: 0.35 },
                {
                  opacity: 0.75,
                  ease: "none",
                  scrollTrigger: {
                    trigger: panel,
                    start: "top top",
                    end: "+=120%",
                    scrub: true,
                  },
                },
              );
            }

            if (glow) {
              gsap.fromTo(
                glow,
                { opacity: 0.1, scale: 0.7 },
                {
                  opacity: 0.65,
                  scale: 1.25,
                  ease: "none",
                  scrollTrigger: {
                    trigger: panel,
                    start: "top top",
                    end: "+=120%",
                    scrub: true,
                  },
                },
              );
            }
          });
        }, root);
      } catch {
        /* optional */
      }
    })();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effective, reducedMotion, isDesktop]);

  const useVideo = !reducedMotion && effective !== "performance";
  const use3d =
    !reducedMotion &&
    effective === "cinematic" &&
    isDesktop();

  return (
    <div ref={root} className="relative bg-[var(--background)]">
      <div
        className="pointer-events-none fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-2.5 md:flex"
        aria-hidden
      >
        {SCROLL_CHAPTERS.map((ch, i) => (
          <div
            key={ch.id}
            className={cn(
              "w-1 rounded-full transition-all duration-300",
              i === activeIndex
                ? "h-8 bg-[var(--primary-light)] shadow-[0_0_16px_var(--primary)]"
                : "h-1.5 bg-white/20",
            )}
          />
        ))}
      </div>

      {SCROLL_CHAPTERS.map((ch, i) => {
        const isActive = i === activeIndex;
        const progress = progresses[i] ?? 0;

        return (
          <section
            key={ch.id}
            data-chapter
            data-index={i}
            className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden"
          >
            <div
              data-chapter-media
              className="absolute inset-0 will-change-transform"
            >
              <ScrollVideoBg
                src={ch.video}
                poster={ch.poster}
                active={isActive && useVideo}
                reduced={!useVideo}
              />
              <div
                data-chapter-veil
                className={cn("absolute inset-0 bg-gradient-to-b", ch.veil)}
              />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_10%,rgba(5,6,10,0.65)_100%)]" />
            </div>

            <div
              data-chapter-glow
              className="pointer-events-none absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
              style={{
                background: `radial-gradient(circle, ${ch.accent}40 0%, transparent 68%)`,
              }}
            />

            {use3d && (isActive || Math.abs(activeIndex - i) <= 1) && (
              <div
                className={cn(
                  "transition-opacity duration-500",
                  isActive ? "opacity-100" : "opacity-0",
                )}
              >
                <ScrollDepthCanvas accent={ch.accent} progress={progress} />
              </div>
            )}

            <div
              className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
              }}
              aria-hidden
            />

            <div
              data-chapter-inner
              className="relative z-10 mx-auto max-w-3xl px-5 py-24 text-center sm:px-8"
              style={{ perspective: "1000px" }}
            >
              <div className="text-scrim mx-auto max-w-2xl rounded-2xl px-5 py-8 sm:px-10 sm:py-10">
                <p
                  className="text-xs font-semibold uppercase tracking-[0.28em]"
                  style={{ color: ch.accent }}
                >
                  {ch.kicker}
                </p>
                <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
                  {ch.title}
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base md:text-lg">
                  {ch.body}
                </p>

                {i === 0 && (
                  <div className="mt-10 flex flex-col items-center gap-2 text-[var(--text-secondary)]">
                    <span className="text-[10px] uppercase tracking-[0.2em]">
                      Scroll to enter the orbit
                    </span>
                    <ChevronDown className="h-5 w-5 animate-bounce" />
                  </div>
                )}

                {i === SCROLL_CHAPTERS.length - 1 && (
                  <div className="mt-10 flex flex-wrap justify-center gap-3">
                    <Link href="/discover">
                      <Button size="lg">Explore catalog</Button>
                    </Link>
                    <Link href="/movies">
                      <Button size="lg" variant="secondary">
                        Movies
                      </Button>
                    </Link>
                    <Link href="/anime">
                      <Button size="lg" variant="outline">
                        Anime
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

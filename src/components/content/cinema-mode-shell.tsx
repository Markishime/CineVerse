"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Clapperboard, Maximize, Minimize, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CinemaModeShellProps {
  active: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

const CHROME_IDLE_MS = 3500;

/**
 * A shared, accessible theater surface for every CineVerse player.
 * The player node stays mounted while the layout expands, so switching modes
 * does not restart an iframe or lose native video progress.
 */
export function CinemaModeShell({
  active,
  title,
  onClose,
  children,
  className,
}: CinemaModeShellProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void rootRef.current?.requestFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!active) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.classList.add("cineverse-cinema-mode");

    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    // The top bar fades out while you watch; pointer or key activity brings it back.
    const wake = () => {
      setChromeVisible(true);
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setChromeVisible(false), CHROME_IDLE_MS);
    };
    wake();

    const onKeyDown = (event: KeyboardEvent) => {
      wake();
      if (event.key === "Escape" && !document.fullscreenElement) onClose();
      else if (
        event.key.toLowerCase() === "f" &&
        !event.metaKey &&
        !event.ctrlKey
      ) {
        toggleFullscreen();
      }
    };
    const onFullscreenChange = () =>
      setFullscreen(Boolean(document.fullscreenElement));

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.classList.remove("cineverse-cinema-mode");
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => {});
      }
    };
  }, [active, onClose, toggleFullscreen]);

  return (
    <div
      ref={rootRef}
      className={cn(
        active
          ? "fixed inset-0 z-[120] overflow-y-auto bg-[#02040a] bg-[radial-gradient(ellipse_70%_55%_at_50%_42%,rgba(34,211,238,0.10),transparent_70%)] px-3 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6"
          : "relative",
        className,
      )}
      data-cinema-mode={active ? "active" : "inactive"}
      data-lenis-prevent={active ? "true" : undefined}
      role={active ? "dialog" : undefined}
      aria-modal={active || undefined}
      aria-label={active ? `Movie mode: ${title}` : undefined}
    >
      {active && (
        <div
          className={cn(
            "mx-auto mb-3 flex w-full max-w-[1800px] items-center justify-between gap-4 border-b border-white/10 pb-3 transition-opacity duration-500",
            chromeVisible ? "opacity-100" : "opacity-0 hover:opacity-100",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-black shadow-[0_0_30px_rgba(34,211,238,0.35)]">
              <Clapperboard className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--primary-light)]">
                Movie mode
              </p>
              <p className="truncate text-sm font-semibold text-white sm:text-base">
                {title}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              aria-pressed={fullscreen}
              aria-label={fullscreen ? "Exit full screen" : "Enter full screen"}
              title="Full screen (F)"
            >
              {fullscreen ? (
                <Minimize className="h-4 w-4" aria-hidden />
              ) : (
                <Maximize className="h-4 w-4" aria-hidden />
              )}
              <span className="hidden sm:inline">
                {fullscreen ? "Exit full screen" : "Full screen"}
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
              aria-label="Exit movie mode"
              title="Exit (Esc)"
            >
              <Minimize2 className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Exit movie mode</span>
              <span className="sm:hidden">Exit</span>
            </button>
          </div>
        </div>
      )}
      <div className={cn(active && "mx-auto w-full max-w-[1800px]")}>
        {children}
      </div>
    </div>
  );
}

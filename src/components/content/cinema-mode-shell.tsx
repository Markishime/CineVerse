"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { Clapperboard, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CinemaModeShellProps {
  active: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

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
  useEffect(() => {
    if (!active) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.classList.add("cineverse-cinema-mode");

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.classList.remove("cineverse-cinema-mode");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active, onClose]);

  return (
    <div
      className={cn(
        active
          ? "fixed inset-0 z-[120] overflow-y-auto bg-[#030405] px-3 pb-6 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6"
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
        <div className="mx-auto mb-3 flex w-full max-w-[1800px] items-center justify-between gap-4 border-b border-white/10 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-[0_0_30px_rgba(229,9,20,0.3)]">
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
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            aria-label="Exit movie mode"
          >
            <Minimize2 className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Exit movie mode</span>
            <span className="sm:hidden">Exit</span>
          </button>
        </div>
      )}
      <div className={cn(active && "mx-auto w-full max-w-[1800px]")}>
        {children}
      </div>
    </div>
  );
}

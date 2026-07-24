"use client";

import { useEffect } from "react";

/**
 * Hardens the page against embed-driven ads while a player is mounted:
 * - nulls window.open (parent-origin popups / some bridge scripts)
 * - restores focus if a popunder blurs the tab after an iframe click
 * - blocks auxiliary clicks that try to open new tabs from the shell
 */
export function useEmbedAdShield(enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const originalOpen = window.open.bind(window);
    window.open = function blockedOpen(
      ..._args: Parameters<typeof window.open>
    ): Window | null {
      // Block all new windows/tabs while the player is active
      console.info("[CineVerse] Blocked popup from embed context");
      return null;
    } as typeof window.open;

    let lastIframeInteract = 0;
    const markIframe = (e: Event) => {
      const t = e.target;
      if (t instanceof Element && t.closest("[data-cineverse-player]")) {
        lastIframeInteract = Date.now();
      }
    };
    document.addEventListener("pointerdown", markIframe, true);
    document.addEventListener("focusin", markIframe, true);

    const onBlur = () => {
      // Popunder pattern: iframe click → window.blur → ad tab focused
      if (Date.now() - lastIframeInteract > 1500) return;
      window.setTimeout(() => {
        try {
          window.focus();
        } catch {
          /* ignore */
        }
      }, 0);
    };
    window.addEventListener("blur", onBlur);

    const onAuxClick = (e: MouseEvent) => {
      // Middle-click / modified click opening new tabs near player
      if (e.button === 1 || e.ctrlKey || e.metaKey) {
        const t = e.target;
        if (t instanceof Element && t.closest("[data-cineverse-player]")) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    document.addEventListener("auxclick", onAuxClick, true);

    const onClickCapture = (e: MouseEvent) => {
      // Kill target=_blank anchors that some hosts inject into the parent (rare)
      const a = e.target instanceof Element ? e.target.closest("a") : null;
      if (!a) return;
      if (
        a.target === "_blank" &&
        a.closest("[data-cineverse-player]")
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", onClickCapture, true);

    return () => {
      window.open = originalOpen;
      document.removeEventListener("pointerdown", markIframe, true);
      document.removeEventListener("focusin", markIframe, true);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("auxclick", onAuxClick, true);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [enabled]);
}

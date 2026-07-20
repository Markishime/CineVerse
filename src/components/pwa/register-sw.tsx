"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function RegisterServiceWorker() {
  const [updateReady, setUpdateReady] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    if (process.env.NODE_ENV !== "production") return;

    void navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setWaiting(worker);
              setUpdateReady(true);
            }
          });
        });
      })
      .catch(() => {
        /* SW optional in some environments */
      });
  }, []);

  if (!updateReady) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-[60] w-[min(420px,92vw)] -translate-x-1/2 rounded-xl glass-strong p-3 shadow-xl md:bottom-6">
      <p className="text-sm">A new version of CineVerse is ready.</p>
      <Button
        size="sm"
        className="mt-2"
        onClick={() => {
          waiting?.postMessage("SKIP_WAITING");
          window.location.reload();
        }}
      >
        Update now
      </Button>
    </div>
  );
}

"use client";

import { useEffect, type ReactNode } from "react";
import { getClientAnalytics } from "@/lib/firebase/client";

/** Initializes Firebase Analytics in the browser only. */
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void getClientAnalytics().catch(() => {
      /* analytics optional */
    });
  }, []);
  return <>{children}</>;
}

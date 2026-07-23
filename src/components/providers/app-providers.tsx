"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LazyMotion, domAnimation, MotionConfig } from "framer-motion";
import { useState, type ReactNode } from "react";
import { AuthProvider } from "./auth-provider";
import { PerformanceProvider } from "./performance-provider";
import { SmoothScrollProvider } from "./smooth-scroll-provider";
import { AnalyticsProvider } from "./analytics-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AnalyticsProvider>
        <AuthProvider>
          <PerformanceProvider>
            {/*
              LazyMotion + reduced-motion transition skip keeps scroll/home at 60fps.
              Only load the DOM animation feature set (no layout/drag plugins).
            */}
            <LazyMotion features={domAnimation} strict={false}>
              <MotionConfig reducedMotion="user">
                <SmoothScrollProvider>{children}</SmoothScrollProvider>
              </MotionConfig>
            </LazyMotion>
          </PerformanceProvider>
        </AuthProvider>
      </AnalyticsProvider>
    </QueryClientProvider>
  );
}

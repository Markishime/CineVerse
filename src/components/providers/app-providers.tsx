"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
            <SmoothScrollProvider>{children}</SmoothScrollProvider>
          </PerformanceProvider>
        </AuthProvider>
      </AnalyticsProvider>
    </QueryClientProvider>
  );
}

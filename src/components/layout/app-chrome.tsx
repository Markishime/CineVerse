"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PageTransition } from "@/components/motion/page-transition";

const AUTH_PATHS = new Set(["/login", "/signup", "/forgot-password"]);

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = AUTH_PATHS.has(pathname);
  // Full-screen player: hide bottom nav so mobile can use the full viewport
  const watchPlayer =
    pathname.startsWith("/watch/movie/") ||
    pathname.startsWith("/watch/tv/") ||
    (pathname.startsWith("/watch/") && !pathname.startsWith("/watchlist"));

  if (bare) {
    return (
      <main className="relative z-[1]">
        <PageTransition>{children}</PageTransition>
      </main>
    );
  }

  return (
    <>
      <Header />
      <main
        className={
          watchPlayer
            ? "relative z-[1] pb-safe"
            : "relative z-[1] main-with-mobile-nav"
        }
      >
        <PageTransition>{children}</PageTransition>
      </main>
      {!watchPlayer && <MobileNav />}
    </>
  );
}

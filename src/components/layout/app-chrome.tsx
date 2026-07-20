"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PageTransition } from "@/components/motion/page-transition";

const AUTH_PATHS = new Set(["/login", "/signup", "/forgot-password"]);

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = AUTH_PATHS.has(pathname);

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
      <main className="relative z-[1] main-with-mobile-nav">
        <PageTransition>{children}</PageTransition>
      </main>
      <MobileNav />
    </>
  );
}

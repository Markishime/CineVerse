"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bell,
  Clapperboard,
  Compass,
  Home,
  Menu,
  Search,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";

const baseNav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/movies", label: "Movies", icon: Clapperboard },
  { href: "/series", label: "Series", icon: Sparkles },
  { href: "/anime", label: "Anime", icon: Sparkles },
  { href: "/kdrama", label: "K-Drama", icon: Sparkles },
  { href: "/mature", label: "18+", icon: Sparkles, matureOnly: true as const },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/search", label: "Search", icon: Search },
  { href: "/watchlist", label: "My List", icon: Clapperboard },
];

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { user, profile, settings } = useAuthStore();
  const isHome = pathname === "/";
  const matureEnabled = Boolean(settings?.matureContent);
  const nav = baseNav.filter((item) => !("matureOnly" in item && item.matureOnly) || matureEnabled);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMenu = () => setOpen(false);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 pt-safe transition-all duration-300",
        scrolled || !isHome
          ? "glass-strong shadow-lg shadow-black/20"
          : "bg-transparent border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            onClick={closeMenu}
            className="font-display text-lg font-bold tracking-tight sm:text-xl"
          >
            <span className="bg-gradient-to-r from-[var(--primary-light)] via-[var(--secondary)] to-[var(--accent)] bg-clip-text text-transparent">
              CineVerse
            </span>
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {nav.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-white/10 text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/search"
            className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Link>
          <Link
            href="/notifications"
            className="hidden rounded-lg p-2 text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)] sm:inline-flex"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </Link>
          {user ? (
            <Link
              href={
                profile?.username
                  ? `/profile/${encodeURIComponent(profile.username)}`
                  : "/profile/me"
              }
              className="hidden items-center gap-2 rounded-full border border-[var(--border)] bg-white/5 px-3 py-1.5 text-sm text-white sm:flex"
            >
              <User className="h-4 w-4 text-[var(--primary-light)]" />
              <span className="max-w-[100px] truncate">
                {profile?.displayName ?? "Profile"}
              </span>
            </Link>
          ) : (
            <Link href="/login" className="hidden sm:block">
              <Button size="sm">Sign in</Button>
            </Link>
          )}
          <button
            type="button"
            className="rounded-lg p-2 text-[var(--text-secondary)] hover:bg-white/5 lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
      {open && (
        <motion.nav
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          className="overflow-hidden border-t border-[var(--border)] bg-[var(--background)]/95 px-4 py-3 lg:hidden"
        >
          <ul className="grid gap-1">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={closeMenu}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-white/5"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={user ? "/settings" : "/login"}
                onClick={closeMenu}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-white/5"
              >
                <User className="h-4 w-4" />
                {user ? "Settings" : "Sign in"}
              </Link>
            </li>
          </ul>
        </motion.nav>
      )}
      </AnimatePresence>
    </header>
  );
}

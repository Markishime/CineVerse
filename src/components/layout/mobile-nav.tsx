"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, Compass, Home, Search, User } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/search", label: "Search", icon: Search },
  { href: "/watchlist", label: "My List", icon: Bookmark },
  { href: "/profile", label: "Profile", icon: User },
];

export function MobileNav() {
  const pathname = usePathname();
  const { profile, user } = useAuthStore();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)] glass-strong pb-safe md:hidden"
      aria-label="Primary"
    >
      <ul className="mx-auto flex h-14 max-w-lg items-stretch justify-around">
        {items.map((item) => {
          const href =
            item.href === "/profile"
              ? user && profile?.username
                ? `/profile/${profile.username}`
                : user
                  ? "/settings"
                  : "/login"
              : item.href;
          const active =
            item.href === "/"
              ? pathname === "/"
              : item.href === "/profile"
                ? pathname.startsWith("/profile") ||
                  pathname.startsWith("/settings") ||
                  pathname.startsWith("/login")
                : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="relative flex-1">
              <Link
                href={href}
                className={cn(
                  "relative flex h-full flex-col items-center justify-center gap-0.5 text-[10px] transition-colors",
                  active
                    ? "text-[var(--primary-light)]"
                    : "text-[var(--text-muted)]",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="mobile-nav-indicator"
                    className="absolute inset-x-3 top-1 h-0.5 rounded-full bg-[var(--primary-light)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

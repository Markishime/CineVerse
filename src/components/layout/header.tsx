"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Bell,
  ChevronDown,
  Clapperboard,
  Compass,
  Film,
  Home,
  ListVideo,
  Menu,
  Search,
  Sparkles,
  Tv,
  User,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { isRestrictedContentUser } from "@/lib/content/mature";
import { Button } from "@/components/ui/button";

interface NavChild {
  href: string;
  label: string;
  /** Only visible to the restricted-content allowlist email. */
  restrictedOnly?: true;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof Film;
  /** When true, `children` only appear (as a dropdown) if restricted user;
   *  otherwise the item renders as a plain link. */
  matureChildren?: true;
  children?: NavChild[];
}

const baseNav: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  {
    href: "/movies",
    label: "Movies",
    icon: Film,
    // Country movie catalogs are restricted — the dropdown appears only for
    // the allowlisted email; otherwise Movies is a plain link.
    matureChildren: true,
    children: [
      { href: "/movies", label: "All Movies" },
      { href: "/movies/korean", label: "Korean Movies" },
      { href: "/movies/japanese", label: "Japanese Movies" },
      { href: "/movies/chinese", label: "Chinese Movies" },
      { href: "/movies/thai", label: "Thai Movies" },
      { href: "/movies/filipino", label: "Filipino Movies" },
    ],
  },
  { href: "/series", label: "Series", icon: Tv },
  {
    href: "/anime",
    label: "Anime",
    icon: Sparkles,
    children: [
      { href: "/anime", label: "All Anime" },
      { href: "/anime/series", label: "Anime Series" },
      { href: "/anime/movies", label: "Anime Movies" },
      { href: "/anime/hentai", label: "Hentai", restrictedOnly: true },
    ],
  },
  {
    href: "/kdrama",
    label: "Dramas",
    icon: Clapperboard,
    children: [
      { href: "/kdrama", label: "K-Drama" },
      { href: "/jdrama", label: "J-Drama" },
      { href: "/cdrama", label: "C-Drama" },
      { href: "/thaidrama", label: "Thai Drama" },
      { href: "/series/filipino", label: "Filipino Drama" },
    ],
  },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/search", label: "Search", icon: Search },
  { href: "/watchlist", label: "My List", icon: ListVideo },
];

function NavDropdown({
  item,
  active,
  onEnter,
  onLeave,
  isOpen,
}: {
  item: NavItem;
  active: boolean;
  onEnter: () => void;
  onLeave: () => void;
  isOpen: boolean;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const handleEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    onEnter();
  };

  const handleLeave = () => {
    leaveTimer.current = setTimeout(() => {
      onLeave();
    }, 150);
  };

  return (
    <div
      ref={dropdownRef}
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
          active
            ? "bg-white/10 text-white"
            : "text-[var(--text-secondary)] hover:bg-white/5 hover:text-white",
        )}
        aria-current={active ? "page" : undefined}
        onClick={(e) => {
          // Allow direct navigation to parent href
          if (!isOpen) return;
          // If dropdown is open, prevent default and let the user click a child
          if (dropdownRef.current?.contains(document.activeElement)) {
            e.preventDefault();
          }
        }}
      >
        {item.label}
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </Link>
      <AnimatePresence>
        {isOpen && item.children && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-white/10 bg-[var(--surface)] shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
          >
            <div className="py-1">
              {item.children.map((child) => {
                const childActive = child.href === "/"
                  ? false
                  : child.href === item.href
                    ? false
                    : false; // children are never "active" in the parent sense
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      "block px-4 py-2 text-sm transition-colors",
                      "text-[var(--text-secondary)] hover:bg-white/5 hover:text-white",
                    )}
                  >
                    {child.label}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const { user, profile } = useAuthStore();
  const isHome = pathname === "/";

  const restrictedUser = isRestrictedContentUser(user?.email);
  const nav = baseNav.map((item) => {
    // Country movie catalogs: dropdown only for the allowlisted email.
    if (item.matureChildren && !restrictedUser) {
      return { ...item, children: undefined };
    }
    // Hentai (and any restrictedOnly child): only for allowlisted email.
    if (item.children?.some((c) => c.restrictedOnly)) {
      return {
        ...item,
        children: item.children.filter(
          (c) => !c.restrictedOnly || restrictedUser,
        ),
      };
    }
    return item;
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setOpen(false);
    setOpenDropdown(null);
  }, [pathname]);

  const closeMenu = () => setOpen(false);
  const solid = scrolled || !isHome || open;

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 pt-safe transition-[background-color,border-color,box-shadow] duration-200",
        solid
          ? "border-b border-white/10 bg-[var(--background)]/95 shadow-[0_8px_32px_rgba(0,0,0,0.35)]"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-5">
          <Link
            href="/"
            onClick={closeMenu}
            className="shrink-0 flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <svg
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-7 w-7 sm:h-8 sm:w-8"
              aria-hidden
            >
              <circle cx="16" cy="16" r="15" stroke="var(--primary-light)" strokeWidth="1.5" opacity="0.6" />
              <circle cx="16" cy="16" r="5" fill="var(--primary-light)" />
              <path
                d="M11 16a5 5 0 0 1 10 0"
                stroke="var(--primary-light)"
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity="0.45"
              />
              <path
                d="M11 16a5 5 0 0 0 10 0"
                stroke="var(--primary-light)"
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity="0.45"
              />
              <circle cx="16" cy="6.5" r="1.5" fill="var(--primary-light)" opacity="0.5" />
              <circle cx="16" cy="25.5" r="1.5" fill="var(--primary-light)" opacity="0.5" />
              <circle cx="6.5" cy="16" r="1.5" fill="var(--primary-light)" opacity="0.5" />
              <circle cx="25.5" cy="16" r="1.5" fill="var(--primary-light)" opacity="0.5" />
            </svg>
            <span className="font-display text-lg font-bold tracking-tight text-[var(--primary-light)] transition-colors hover:text-white sm:text-xl">
              CineVerse
            </span>
          </Link>
          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Main">
            {nav.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const hasDropdown = item.children && item.children.length > 0;
              const isDropdownOpen = openDropdown === item.href;

              if (hasDropdown) {
                return (
                  <NavDropdown
                    key={item.href}
                    item={item}
                    active={active}
                    isOpen={isDropdownOpen}
                    onEnter={() => setOpenDropdown(item.href)}
                    onLeave={() => setOpenDropdown(null)}
                  />
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                    active
                      ? "bg-white/10 text-white"
                      : "text-[var(--text-secondary)] hover:bg-white/5 hover:text-white",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1">
          <Link
            href="/search"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Link>
          <Link
            href="/notifications"
            className="hidden h-10 w-10 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:inline-flex"
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
              className="hidden items-center gap-2 rounded-full border border-white/10 bg-[var(--surface)] px-3 py-1.5 text-sm text-white transition-colors hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] sm:flex"
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
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--text-secondary)] transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] lg:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-white/10 bg-[var(--background)] px-4 py-3 lg:hidden"
            aria-label="Mobile"
          >
            <ul className="grid gap-0.5">
              {nav.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                const hasDropdown = item.children && item.children.length > 0;
                const isMobileOpen = openDropdown === item.href;

                return (
                  <li key={item.href}>
                    {hasDropdown ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenDropdown(isMobileOpen ? null : item.href)
                          }
                          className={cn(
                            "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                            active
                              ? "bg-white/10 text-white"
                              : "text-[var(--text-secondary)] hover:bg-white/5 hover:text-white",
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                          {item.label}
                          <ChevronDown
                            className={cn(
                              "ml-auto h-4 w-4 transition-transform duration-200",
                              isMobileOpen && "rotate-180",
                            )}
                          />
                        </button>
                        <AnimatePresence>
                          {isMobileOpen && (
                            <motion.ul
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden pl-7"
                            >
                              {item.children!.map((child) => (
                                <li key={child.href}>
                                  <Link
                                    href={child.href}
                                    onClick={closeMenu}
                                    className={cn(
                                      "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                                      pathname === child.href
                                        ? "bg-white/10 text-white"
                                        : "text-[var(--text-muted)] hover:bg-white/5 hover:text-white",
                                    )}
                                  >
                                    {child.label}
                                  </Link>
                                </li>
                              ))}
                            </motion.ul>
                          )}
                        </AnimatePresence>
                      </>
                    ) : (
                      <Link
                        href={item.href}
                        onClick={closeMenu}
                        className={cn(
                          "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                          active
                            ? "bg-white/10 text-white"
                            : "text-[var(--text-secondary)] hover:bg-white/5 hover:text-white",
                        )}
                        aria-current={active ? "page" : undefined}
                      >
                        <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                        {item.label}
                      </Link>
                    )}
                  </li>
                );
              })}
              <li>
                <Link
                  href={user ? "/settings" : "/login"}
                  onClick={closeMenu}
                  className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:bg-white/5 hover:text-white"
                >
                  <User className="h-4 w-4" aria-hidden />
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

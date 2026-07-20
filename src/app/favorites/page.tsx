"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { fetchFavorites } from "@/lib/api/user";
import { catalog } from "@/data/seed-content-client";
import { ContentCard } from "@/components/content/content-card";
import { useAuthStore } from "@/stores/auth-store";
import { useGuestLibraryStore } from "@/stores/guest-library-store";

export default function FavoritesPage() {
  const user = useAuthStore((s) => s.user);
  const guest = useGuestLibraryStore();

  const { data, isLoading } = useQuery({
    queryKey: ["favorites"],
    queryFn: fetchFavorites,
    enabled: Boolean(user),
  });

  const ids = user
    ? (data?.items ?? []).map((f) => f.contentId)
    : guest.favorites;

  const items = ids
    .map((id) => catalog.find((c) => c.id === id))
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-24 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Favorites</h1>
      {isLoading && user && (
        <p className="mt-4 text-sm text-[var(--text-muted)]">Loading…</p>
      )}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map(
          (c) =>
            c && (
              <ContentCard key={c.id} content={c} className="w-full min-w-0" />
            ),
        )}
      </div>
      {items.length === 0 && (
        <p className="mt-8 text-[var(--text-muted)]">
          No favorites yet.{" "}
          <Link href="/" className="text-[var(--primary-light)]">
            Explore CineVerse
          </Link>
        </p>
      )}
    </div>
  );
}

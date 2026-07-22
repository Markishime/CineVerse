"use client";

import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { fetchFavorites } from "@/lib/api/user";
import { catalog } from "@/data/seed-content-client";
import { ContentCard } from "@/components/content/content-card";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
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
    <div className="page-shell">
      <PageHeader
        eyebrow="Your picks"
        title="Favorites"
        description="Titles you hearted across movies, series, anime, and K-drama."
      />

      {isLoading && user && (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] skeleton rounded-xl" />
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {items.map(
            (c) =>
              c && (
                <ContentCard
                  key={c.id}
                  content={c}
                  className="w-full min-w-0"
                />
              ),
          )}
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <EmptyState
          className="mt-10"
          icon={Heart}
          title="No favorites yet"
          description="Tap Favorite on any title page to collect it here."
          actions={[
            { href: "/", label: "Explore home" },
            { href: "/discover", label: "Discover", variant: "secondary" },
          ]}
        />
      )}
    </div>
  );
}

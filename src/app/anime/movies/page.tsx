import type { Metadata } from "next";
import { CatalogPage } from "@/components/content/catalog-page";

export const metadata: Metadata = {
  title: "Anime Movies — Neon Celestial",
};

export default function AnimeMoviesPage() {
  return (
    <CatalogPage
      type="anime"
      animeFormat="movie"
      title="Anime Movies"
      subtitle="Theatrical anime films — from Ghibli to the latest features"
    />
  );
}

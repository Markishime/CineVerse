import type { Metadata } from "next";
import { CatalogPage } from "@/components/content/catalog-page";

export const metadata: Metadata = {
  title: "Anime Series — Neon Celestial",
};

export default function AnimeSeriesPage() {
  return (
    <CatalogPage
      type="anime"
      animeFormat="series"
      title="Anime Series"
      subtitle="TV anime, OVAs & ONAs — binge full seasons"
    />
  );
}

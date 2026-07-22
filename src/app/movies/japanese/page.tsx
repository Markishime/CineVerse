import type { Metadata } from "next";
import { CatalogPage } from "@/components/content/catalog-page";

export const metadata: Metadata = {
  title: "Japanese Movies — CineVerse",
};

export default function JapaneseMoviesPage() {
  return (
    <CatalogPage
      type="movie"
      country="JP"
      title="Japanese Movies"
      subtitle="Explore Japanese cinema — anime, drama, and classics"
    />
  );
}

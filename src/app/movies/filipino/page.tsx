import type { Metadata } from "next";
import { CatalogPage } from "@/components/content/catalog-page";

export const metadata: Metadata = {
  title: "Filipino Movies — CineVerse",
};

export default function FilipinoMoviesPage() {
  return (
    <CatalogPage
      type="movie"
      country="PH"
      title="Filipino Movies"
      subtitle="Explore Filipino cinema — drama, comedy, and indie films"
    />
  );
}

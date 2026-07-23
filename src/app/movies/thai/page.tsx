import type { Metadata } from "next";
import { CatalogPage } from "@/components/content/catalog-page";

export const metadata: Metadata = {
  title: "Thai Movies — CineVerse",
};

export default function ThaiMoviesPage() {
  return (
    <CatalogPage
      type="movie"
      country="TH"
      matureOnly
      title="Thai Movies"
      subtitle="Discover Thai cinema — action, horror, and comedy"
    />
  );
}

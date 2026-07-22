import type { Metadata } from "next";
import { CatalogPage } from "@/components/content/catalog-page";

export const metadata: Metadata = {
  title: "Japanese Series — CineVerse",
};

export default function JapaneseSeriesPage() {
  return (
    <CatalogPage
      type="series"
      country="JP"
      title="Japanese Series"
      subtitle="Explore Japanese TV — drama, variety, and cult classics"
    />
  );
}

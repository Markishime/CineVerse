import type { Metadata } from "next";
import { CatalogPage } from "@/components/content/catalog-page";

export const metadata: Metadata = {
  title: "Filipino Series — CineVerse",
};

export default function FilipinoSeriesPage() {
  return (
    <CatalogPage
      type="series"
      country="PH"
      title="Filipino Series"
      subtitle="Discover Filipino TV — teleseryes, dramas, and comedies"
    />
  );
}

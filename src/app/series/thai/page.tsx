import type { Metadata } from "next";
import { CatalogPage } from "@/components/content/catalog-page";

export const metadata: Metadata = {
  title: "Thai Series — CineVerse",
};

export default function ThaiSeriesPage() {
  return (
    <CatalogPage
      type="series"
      country="TH"
      title="Thai Series"
      subtitle="Explore Thai TV — dramas, BL series, and comedies"
    />
  );
}

import type { Metadata } from "next";
import { CatalogPage } from "@/components/content/catalog-page";

export const metadata: Metadata = {
  title: "Korean Series — CineVerse",
};

export default function KoreanSeriesPage() {
  return (
    <CatalogPage
      type="series"
      country="KR"
      title="Korean Series"
      subtitle="Binge Korean TV — dramas, thrillers, and more"
    />
  );
}

import type { Metadata } from "next";
import { CatalogPage } from "@/components/content/catalog-page";

export const metadata: Metadata = {
  title: "Chinese Series — CineVerse",
};

export default function ChineseSeriesPage() {
  return (
    <CatalogPage
      type="series"
      country="CN"
      title="Chinese Series"
      subtitle="Discover Chinese TV — historical epics, modern dramas, and more"
    />
  );
}

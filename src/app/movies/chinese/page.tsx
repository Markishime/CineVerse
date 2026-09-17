import type { Metadata } from "next";
import { CatalogPage } from "@/components/content/catalog-page";

export const metadata: Metadata = {
  title: "Chinese Movies — CineVerse",
};

export default function ChineseMoviesPage() {
  return (
    <CatalogPage
      type="movie"
      country="CN"
      title="Chinese Movies"
      subtitle="Explore Chinese cinema — blockbusters, wuxia, and art house"
    />
  );
}

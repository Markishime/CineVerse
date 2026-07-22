import type { Metadata } from "next";
import { CatalogPage } from "@/components/content/catalog-page";

export const metadata: Metadata = {
  title: "Korean Movies — CineVerse",
};

export default function KoreanMoviesPage() {
  return (
    <CatalogPage
      type="movie"
      country="KR"
      title="Korean Movies"
      subtitle="Discover Korean cinema — from blockbusters to indie gems"
    />
  );
}

import type { Metadata } from "next";
import { CatalogPage } from "@/components/content/catalog-page";

export const metadata: Metadata = {
  title: "Movies — Cosmic Premiere",
};

export default function MoviesPage() {
  return <CatalogPage type="movie" />;
}

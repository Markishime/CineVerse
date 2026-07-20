import type { Metadata } from "next";
import { CatalogPage } from "@/components/content/catalog-page";

export const metadata: Metadata = {
  title: "Series — Infinite Chapters",
};

export default function SeriesPage() {
  return <CatalogPage type="series" />;
}

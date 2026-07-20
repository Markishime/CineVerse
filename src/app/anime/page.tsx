import type { Metadata } from "next";
import { CatalogPage } from "@/components/content/catalog-page";

export const metadata: Metadata = {
  title: "Anime — Neon Celestial",
};

export default function AnimePage() {
  return <CatalogPage type="anime" />;
}

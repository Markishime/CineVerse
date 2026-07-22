import type { Metadata } from "next";
import { CatalogPage } from "@/components/content/catalog-page";

export const metadata: Metadata = {
  title: "Thai Drama — Bangkok Heat",
};

export default function ThaidramaPage() {
  return <CatalogPage type="thaidrama" />;
}

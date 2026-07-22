import type { Metadata } from "next";
import { CatalogPage } from "@/components/content/catalog-page";

export const metadata: Metadata = {
  title: "C-Drama — Mainland & Beyond",
};

export default function CdramaPage() {
  return <CatalogPage type="cdrama" />;
}

import type { Metadata } from "next";
import { CatalogPage } from "@/components/content/catalog-page";

export const metadata: Metadata = {
  title: "K-Drama — Seoul After Dark",
};

export default function KdramaPage() {
  return <CatalogPage type="kdrama" />;
}

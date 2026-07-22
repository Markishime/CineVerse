import type { Metadata } from "next";
import { CatalogPage } from "@/components/content/catalog-page";

export const metadata: Metadata = {
  title: "J-Drama — Tokyo Nights",
};

export default function JdramaPage() {
  return <CatalogPage type="jdrama" />;
}

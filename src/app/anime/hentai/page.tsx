import type { Metadata } from "next";
import { CatalogPage } from "@/components/content/catalog-page";

export const metadata: Metadata = {
  title: "Hentai — 18+ — CineVerse",
  robots: { index: false, follow: false },
};

/**
 * Anime → Hentai. Restricted to the allowlisted 18+ account and gated behind
 * the parental PIN. Serves AniList isAdult / Jikan Rx hentai plus the TMDB
 * adult-animation (hentai & 3D hentai) slice of the mature catalog.
 */
export default function HentaiPage() {
  return (
    <CatalogPage
      type="anime"
      title="Hentai"
      subtitle="18+ adult animation — hentai series, films and 3D releases. Metadata from TMDB, AniList and MAL."
      genre="mature"
      matureOnly
      hideGenres
    />
  );
}

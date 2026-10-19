import { redirect } from "next/navigation";

/**
 * Preserve old bookmarks; adult anime now shares the Anime Series catalog.
 */
export default function HentaiPage() {
  redirect("/anime/series");
}

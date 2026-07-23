import { redirect } from "next/navigation";

/** Legacy 18+ tab — moved under Anime → Hentai. */
export default function MaturePage() {
  redirect("/anime/hentai");
}

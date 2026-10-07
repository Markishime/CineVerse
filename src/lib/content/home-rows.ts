import type { Content } from "@/types/content";
import { filterPublicCatalog } from "@/lib/content/mature";

export interface GenreRowDef {
  id: string;
  title: string;
  subtitle: string;
  match: RegExp;
}

export const HOME_GENRE_ROWS: GenreRowDef[] = [
  { id: "action", title: "Action", subtitle: "Big, loud and fast", match: /action/i },
  { id: "comedy", title: "Comedy", subtitle: "Laugh-out-loud picks", match: /comedy/i },
  { id: "horror", title: "Horror", subtitle: "Not for the faint of heart", match: /horror/i },
  { id: "scifi", title: "Sci-Fi", subtitle: "Other worlds and future shocks", match: /sci(ence)?[\s-]?fi/i },
  { id: "romance", title: "Romance", subtitle: "Love stories worth the watch", match: /romance/i },
  { id: "animation", title: "Animation", subtitle: "Animated films and series", match: /animation|animated/i },
];

/** Merge several catalog lists into one de-duplicated, public-safe pool (first occurrence wins). */
export function buildCatalogPool(
  lists: Array<Content[] | null | undefined>,
): Content[] {
  const seen = new Set<string>();
  const out: Content[] = [];
  for (const list of lists) {
    for (const item of filterPublicCatalog(list ?? [])) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

/**
 * Derive genre rows from titles already on the page — no extra API calls.
 * Rows with fewer than `minItems` matches are dropped so no section is thin.
 */
export function pickGenreRows(
  pool: Content[],
  defs: GenreRowDef[] = HOME_GENRE_ROWS,
  { minItems = 6, limit = 20 }: { minItems?: number; limit?: number } = {},
): Array<GenreRowDef & { items: Content[] }> {
  const rows: Array<GenreRowDef & { items: Content[] }> = [];
  for (const def of defs) {
    const items = pool
      .filter((c) => c.genres?.some((g) => def.match.test(g.name)))
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, limit);
    if (items.length >= minItems) rows.push({ ...def, items });
  }
  return rows;
}

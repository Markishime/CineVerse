import { describe, expect, it } from "vitest";
import { ContentSchema } from "@/types/content";
import { buildCatalogPool, pickGenreRows } from "../home-rows";

const item = (id: string, genres: string[], popularity = 0) =>
  ContentSchema.parse({
    id,
    slug: id,
    title: id,
    contentType: "movie",
    popularity,
    genres: genres.map((name, i) => ({ id: String(i), name })),
  });

describe("home genre rows", () => {
  it("de-duplicates the pool across lists", () => {
    const a = item("a", ["Action"]);
    const pool = buildCatalogPool([[a, item("b", [])], [a], undefined]);
    expect(pool.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("only returns genre rows that have enough titles, most popular first", () => {
    const pool = [
      ...Array.from({ length: 6 }, (_, i) => item(`act${i}`, ["Action"], i)),
      ...Array.from({ length: 3 }, (_, i) => item(`com${i}`, ["Comedy"])),
      item("scifi", ["Sci-Fi & Fantasy"]),
    ];
    const rows = pickGenreRows(pool);
    expect(rows.map((r) => r.id)).toEqual(["action"]);
    expect(rows[0]?.items[0]?.id).toBe("act5");
  });
});

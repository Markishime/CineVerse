import { describe, expect, it } from "vitest";
import { ContentSchema } from "@/types/content";
import { latestReleased, latestRows } from "../latest";

const item = (id: string, releaseDate: string | null, extra = {}) => ContentSchema.parse({ id, slug: id, title: id, contentType: "movie", releaseDate, status: "released", ...extra });
const now = new Date("2026-09-17T12:00:00Z");

describe("latest releases", () => {
  it("orders by exact release date and excludes announcements and unknown dates", () => {
    const result = latestReleased([
      item("older", "2026-01-01", { popularity: 999 }), item("today", "2026-09-17"),
      item("future", "2026-09-18"), item("unknown", null), item("bad", "invalid"),
      item("planned", "2026-09-01", { status: "planned" }), item("today", "2026-09-17"),
    ], now);
    expect(result.map((c) => c.id)).toEqual(["today", "older"]);
  });
  it("keeps all four dashboard categories independently populated", () => {
    const rows = latestRows([
      item("film", "2026-09-01"), item("tv", "2026-09-02", { contentType: "series" }),
      item("anime", "2026-09-03", { contentType: "anime" }),
      item("drama", "2026-09-04", { contentType: "kdrama" }),
    ], now);
    expect(Object.values(rows).map((row) => row.length)).toEqual([1, 1, 1, 1]);
  });
});

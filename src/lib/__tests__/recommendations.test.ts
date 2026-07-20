import { describe, expect, it } from "vitest";
import { buildRecommendations } from "../recommendations";
import { SEED_CONTENT } from "@/data/seed-content";

describe("buildRecommendations", () => {
  it("returns diverse recommendations with reasons", () => {
    const recs = buildRecommendations({
      catalog: SEED_CONTENT,
      favoriteGenres: ["Drama", "Science Fiction"],
      highlyRated: [SEED_CONTENT[0]!],
      history: [SEED_CONTENT[0]!],
      preferredTypes: ["movie", "anime"],
      preferredLanguages: ["en", "ja"],
      preferredProviders: [],
      limit: 6,
    });
    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0]!.reason).toBeTruthy();
    const ids = new Set(recs.map((r) => r.content.id));
    expect(ids.has(SEED_CONTENT[0]!.id)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  applyMatureFlag,
  filterByMatureFlag,
  filterExplicitMatureLibrary,
  isExplicitSexualContent,
  isMatureContent,
} from "@/lib/content/mature";
import type { Content } from "@/types/content";

const base = {
  id: "t1",
  slug: "t1",
  contentType: "movie" as const,
  title: "Test",
  overview: "",
  status: "released" as const,
  countries: [] as string[],
  genres: [],
  scores: [],
  popularity: 1,
  trailer: null,
  watchProviders: [],
  providerIds: {},
  studios: [],
  tags: [] as string[],
  alternateTitles: [],
  approved: true,
  mature: false,
  lastSyncedAt: new Date().toISOString(),
} as Content;

describe("explicit sexual mature library", () => {
  it("accepts nudity / explicit / hentai", () => {
    expect(
      isExplicitSexualContent({
        ...base,
        tags: ["nudity", "18+"],
        mature: true,
      }),
    ).toBe(true);
    expect(
      isExplicitSexualContent({
        ...base,
        contentType: "anime",
        tags: ["anilist-adult", "hentai"],
        mature: true,
      }),
    ).toBe(true);
    expect(
      isExplicitSexualContent({
        ...base,
        overview: "Contains graphic sex and nudity throughout.",
        mature: true,
        tags: ["18+"],
      }),
    ).toBe(true);
  });

  it("rejects violence-only and soft R / TV-MA without sex", () => {
    expect(
      isExplicitSexualContent({
        ...base,
        mature: true,
        tags: ["violence", "dark fantasy"],
        ageRating: "R",
      }),
    ).toBe(false);
    expect(
      isExplicitSexualContent({
        ...base,
        contentType: "anime",
        mature: true,
        tags: ["violence", "18+", "mature", "adult-themes"],
        overview: "Extreme violence and gore.",
      }),
    ).toBe(false);
    expect(
      isExplicitSexualContent({
        ...base,
        tags: ["ecchi"],
        mature: false,
      }),
    ).toBe(false);
    expect(
      isExplicitSexualContent({
        ...base,
        ageRating: "TV-MA",
        tags: ["crime", "violence"],
        mature: true,
      }),
    ).toBe(false);
  });

  it("filterExplicitMatureLibrary keeps only sexual titles", () => {
    const list = [
      base,
      {
        ...base,
        id: "sex1",
        mature: true,
        tags: ["nudity", "explicit", "18+"],
      },
      {
        ...base,
        id: "vio1",
        mature: true,
        tags: ["violence", "18+"],
        overview: "Brutal action.",
      },
      {
        ...base,
        id: "hentai1",
        contentType: "anime" as const,
        mature: true,
        tags: ["jikan-rx", "hentai"],
      },
    ] as Content[];
    const out = filterExplicitMatureLibrary(list);
    expect(out.map((c) => c.id).sort()).toEqual(["hentai1", "sex1"]);
  });

  it("isMatureContent matches explicit filter for gate", () => {
    expect(
      isMatureContent({
        ...base,
        tags: ["nudity"],
        mature: true,
      }),
    ).toBe(true);
    expect(
      isMatureContent({
        ...base,
        tags: ["violence"],
        mature: true,
      }),
    ).toBe(false);
  });

  it("applyMatureFlag strips false positives", () => {
    const next = applyMatureFlag({
      ...base,
      mature: true,
      tags: ["violence", "18+", "mature"],
      overview: "War film with graphic combat.",
    });
    expect(next.mature).toBe(false);
    expect(next.tags).not.toContain("18+");
  });

  it("filterByMatureFlag hides explicit when mature off", () => {
    const list = [
      base,
      { ...base, id: "x", tags: ["nudity", "explicit"], mature: true },
    ] as Content[];
    expect(filterByMatureFlag(list, false)).toHaveLength(1);
    expect(filterByMatureFlag(list, true)).toHaveLength(2);
  });
});

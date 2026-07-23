import { describe, expect, it } from "vitest";
import {
  applyMatureFlag,
  filterAdultLibrary,
  filterByMatureFlag,
  filterExplicitMatureLibrary,
  filterPublicCatalog,
  isAdultRestricted,
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

  it("applyMatureFlag strips false positives (violence-only, no adult rating)", () => {
    // Violence-only R-rated war film with no 18+/R18/adult tag → not adult.
    const next = applyMatureFlag({
      ...base,
      mature: true,
      ageRating: "R",
      tags: ["violence", "war"],
      overview: "War film with graphic combat.",
    });
    expect(next.mature).toBe(false);
    expect(next.tags).not.toContain("18+");
  });

  it("applyMatureFlag keeps an explicit 18+ tag as adult (hides when off)", () => {
    // Per product rule: an 18+ tag counts as adult regardless of sexual content.
    const next = applyMatureFlag({
      ...base,
      mature: true,
      tags: ["18+", "mature"],
    });
    expect(next.mature).toBe(true);
    expect(next.tags).toContain("18+");
  });

  it("filterByMatureFlag hides explicit when mature off", () => {
    const list = [
      base,
      { ...base, id: "x", tags: ["nudity", "explicit"], mature: true },
    ] as Content[];
    expect(filterByMatureFlag(list, false)).toHaveLength(1);
    expect(filterByMatureFlag(list, true)).toHaveLength(2);
  });

  it("filterPublicCatalog always strips 18+ (home/catalogs never mix adult)", () => {
    const list = [
      base,
      {
        ...base,
        id: "adult",
        tags: ["18+", "nudity"],
        mature: true,
        ageRating: "18+",
      },
    ] as Content[];
    expect(filterPublicCatalog(list).map((c) => c.id)).toEqual(["t1"]);
  });

  it("filterAdultLibrary keeps only adults-only titles for the 18+ tab", () => {
    const list = [
      base,
      {
        ...base,
        id: "adult",
        tags: ["18+", "nudity"],
        mature: true,
        ageRating: "18+",
      },
      {
        ...base,
        id: "r18-anime",
        contentType: "anime" as const,
        ageRating: "R18+",
        tags: ["r18+", "mature"],
        mature: true,
      },
    ] as Content[];
    expect(filterAdultLibrary(list).map((c) => c.id).sort()).toEqual([
      "adult",
      "r18-anime",
    ]);
  });
});

describe("adult-restricted gate (18+ toggle OFF hides ALL adult content)", () => {
  it("hides adults-only ecchi anime like Overflow (R18+, not hentai)", () => {
    // Overflow: AniList isAdult=false, Ecchi genre → tagged as adult-oriented.
    const overflow = {
      ...base,
      id: "overflow",
      contentType: "anime" as const,
      title: "Overflow",
      ageRating: "R+",
      tags: ["r+", "mature", "adults-only", "anime-adult-genre", "anime"],
      mature: true,
    } as Content;
    expect(isAdultRestricted(overflow)).toBe(true);
    expect(isMatureContent(overflow)).toBe(true);
    // Not curated into the *sexual* 18+ library (it's ecchi, not hentai).
    expect(isExplicitSexualContent(overflow)).toBe(false);
    expect(filterByMatureFlag([overflow], false)).toHaveLength(0);
    expect(filterByMatureFlag([overflow], true)).toHaveLength(1);
  });

  it("hides adult age ratings across all types (18+/R18/R+/NC-17)", () => {
    for (const rating of ["18+", "R18", "R18+", "R+", "NC-17", "Rx"]) {
      expect(
        isAdultRestricted({ ...base, ageRating: rating, mature: true }),
      ).toBe(true);
    }
  });

  it("hides provider adult flags (AniList isAdult, hentai, jikan-rx)", () => {
    expect(
      isAdultRestricted({
        ...base,
        contentType: "anime",
        tags: ["anilist-adult", "adult-anime"],
      }),
    ).toBe(true);
    expect(
      isAdultRestricted({
        ...base,
        contentType: "anime",
        tags: ["jikan-rx", "hentai"],
      }),
    ).toBe(true);
  });

  it("keeps non-adult content visible when toggle is off", () => {
    // Violence-only R / TV-14 action / plain series must NOT be hidden.
    expect(
      isAdultRestricted({
        ...base,
        ageRating: "R",
        tags: ["violence", "action"],
      }),
    ).toBe(false);
    expect(
      isAdultRestricted({
        ...base,
        ageRating: "TV-14",
        tags: ["ecchi"], // ecchi tag alone (TV-14) is not adults-only
      }),
    ).toBe(false);
    expect(isAdultRestricted(base)).toBe(false);
  });

  it("hides 18+ country movies/series & dramas across all types (full pipeline)", () => {
    // Mirror loadLive: applyMatureFlag then filterByMatureFlag(false).
    const types = [
      "movie",
      "series",
      "kdrama",
      "cdrama",
      "jdrama",
      "thaidrama",
      "anime",
    ] as const;
    for (const t of types) {
      const adult = applyMatureFlag({
        ...base,
        id: `adult-${t}`,
        contentType: t,
        ageRating: "18+",
        tags: t === "anime" ? ["anilist-adult"] : ["18+"],
        mature: true,
      } as Content);
      const safe = applyMatureFlag({
        ...base,
        id: `safe-${t}`,
        contentType: t,
        ageRating: t === "movie" ? "PG-13" : "TV-14",
        tags: [],
        mature: false,
      } as Content);
      const list = [adult, safe];
      const shownWhenOff = filterByMatureFlag(list, false);
      expect(shownWhenOff.map((c) => c.id)).toEqual([`safe-${t}`]);
      expect(filterByMatureFlag(list, true)).toHaveLength(2);
    }
  });

  it("hides TMDB adult-flagged titles (adult:true → 18+)", () => {
    // mapTmdbMovie sets mature + ageRating '18+' for raw.adult; the gate hides.
    const tmdbAdult = applyMatureFlag({
      ...base,
      id: "tmdb-adult",
      ageRating: "18+",
      mature: true,
    } as Content);
    expect(filterByMatureFlag([tmdbAdult], false)).toHaveLength(0);
  });
});

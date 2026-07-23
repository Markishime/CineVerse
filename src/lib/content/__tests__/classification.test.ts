import { describe, expect, it } from "vitest";
import {
  classifyDrama,
  isAnimeLikeContent,
  isGeneralSeriesOnly,
  isKDrama,
  isValidAnime,
  normalizeAnimeFormat,
  resolveContentType,
} from "../classification";

describe("isKDrama", () => {
  it("accepts Korean scripted drama series", () => {
    expect(
      isKDrama({
        isTv: true,
        originalLanguage: "ko",
        originCountries: ["KR"],
        genres: [{ name: "Drama" }, { name: "Romance" }],
      }),
    ).toBe(true);
  });

  it("rejects Korean reality / variety", () => {
    expect(
      isKDrama({
        isTv: true,
        originalLanguage: "ko",
        originCountries: ["KR"],
        genres: [{ name: "Reality" }],
      }),
    ).toBe(false);
  });

  it("rejects non-Korean series", () => {
    expect(
      isKDrama({
        isTv: true,
        originalLanguage: "en",
        originCountries: ["US"],
        genres: [{ name: "Drama" }],
      }),
    ).toBe(false);
  });

  it("honors admin override", () => {
    expect(
      isKDrama({
        isTv: true,
        originalLanguage: "en",
        override: "kdrama",
      }),
    ).toBe(true);
  });
});

describe("classifyDrama (K/C/J/Thai)", () => {
  const drama = [{ name: "Drama" }, { name: "Romance" }];
  it("classifies Chinese drama", () => {
    expect(
      classifyDrama({
        isTv: true,
        originalLanguage: "zh",
        originCountries: ["CN"],
        genres: drama,
      }),
    ).toBe("cdrama");
    // Taiwan / Hong Kong also map to C-drama
    expect(
      classifyDrama({
        isTv: true,
        originalLanguage: "zh",
        originCountries: ["TW"],
        genres: drama,
      }),
    ).toBe("cdrama");
  });

  it("classifies Japanese live-action drama", () => {
    expect(
      classifyDrama({
        isTv: true,
        originalLanguage: "ja",
        originCountries: ["JP"],
        genres: drama,
      }),
    ).toBe("jdrama");
  });

  it("classifies Thai drama", () => {
    expect(
      classifyDrama({
        isTv: true,
        originalLanguage: "th",
        originCountries: ["TH"],
        genres: drama,
      }),
    ).toBe("thaidrama");
  });

  it("classifies Korean drama and returns null for non-Asian", () => {
    expect(
      classifyDrama({
        isTv: true,
        originalLanguage: "ko",
        originCountries: ["KR"],
        genres: drama,
      }),
    ).toBe("kdrama");
    expect(
      classifyDrama({
        isTv: true,
        originalLanguage: "en",
        originCountries: ["US"],
        genres: drama,
      }),
    ).toBeNull();
  });

  it("honors a drama override and rejects reality/variety", () => {
    expect(
      classifyDrama({ isTv: true, originalLanguage: "en", override: "cdrama" }),
    ).toBe("cdrama");
    expect(
      classifyDrama({
        isTv: true,
        originalLanguage: "th",
        originCountries: ["TH"],
        genres: [{ name: "Reality" }],
      }),
    ).toBeNull();
  });
});

describe("isValidAnime", () => {
  it("accepts TV anime with metadata", () => {
    expect(
      isValidAnime({
        format: "TV",
        isAdult: false,
        hasTitle: true,
        hasCover: true,
        mediaType: "ANIME",
      }),
    ).toBe(true);
  });

  it("rejects adult-only and manga", () => {
    expect(
      isValidAnime({
        format: "TV",
        isAdult: true,
        hasTitle: true,
        hasCover: true,
        mediaType: "ANIME",
      }),
    ).toBe(false);
    expect(
      isValidAnime({
        format: "NOVEL",
        isAdult: false,
        hasTitle: true,
        hasCover: true,
        mediaType: "MANGA",
      }),
    ).toBe(false);
  });

  it("rejects empty metadata", () => {
    expect(
      isValidAnime({
        format: "TV",
        hasTitle: false,
        hasCover: true,
      }),
    ).toBe(false);
  });
});

describe("normalizeAnimeFormat", () => {
  it("maps TV_SHORT to SHORT", () => {
    expect(normalizeAnimeFormat("TV_SHORT")).toBe("SHORT");
  });
});

describe("resolveContentType", () => {
  it("prefers override then anime then dramaType then kdrama", () => {
    expect(resolveContentType({ isAnime: true, isKDrama: true })).toBe(
      "anime",
    );
    expect(resolveContentType({ isKDrama: true, isTv: true })).toBe("kdrama");
    expect(resolveContentType({ dramaType: "cdrama", isTv: true })).toBe(
      "cdrama",
    );
    expect(resolveContentType({ dramaType: "jdrama", isTv: true })).toBe(
      "jdrama",
    );
    // anime still wins over a drama type (Japanese animation)
    expect(
      resolveContentType({ isAnime: true, dramaType: "jdrama" }),
    ).toBe("anime");
    expect(resolveContentType({ override: "series", isMovie: true })).toBe(
      "series",
    );
  });
});

describe("isAnimeLikeContent", () => {
  it("flags contentType anime and animation genres", () => {
    expect(
      isAnimeLikeContent({
        contentType: "anime",
        genres: [],
        tags: [],
      }),
    ).toBe(true);
    expect(
      isAnimeLikeContent({
        contentType: "jdrama",
        genres: [{ id: "16", name: "Animation" }],
        tags: [],
      }),
    ).toBe(true);
  });

  it("does not flag live-action jdrama", () => {
    expect(
      isAnimeLikeContent({
        contentType: "jdrama",
        genres: [{ id: "18", name: "Drama" }],
        tags: ["japanese", "popular"],
      }),
    ).toBe(false);
  });
});

describe("isGeneralSeriesOnly", () => {
  const base = {
    contentType: "series" as const,
    language: "en",
    countries: ["US"],
    genres: [] as Array<{ id: string; name: string }>,
    tags: [] as string[],
  };

  it("keeps pure Western/global series", () => {
    expect(isGeneralSeriesOnly(base)).toBe(true);
  });

  it("rejects anime and Asian dramas", () => {
    expect(
      isGeneralSeriesOnly({ ...base, contentType: "anime" as const }),
    ).toBe(false);
    expect(
      isGeneralSeriesOnly({ ...base, contentType: "kdrama" as const }),
    ).toBe(false);
    expect(
      isGeneralSeriesOnly({
        ...base,
        language: "ko",
        countries: ["KR"],
      }),
    ).toBe(false);
    expect(
      isGeneralSeriesOnly({
        ...base,
        genres: [{ id: "16", name: "Animation" }],
      }),
    ).toBe(false);
  });
});

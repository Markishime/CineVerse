import { describe, expect, it } from "vitest";
import {
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
  it("prefers override then anime then kdrama", () => {
    expect(resolveContentType({ isAnime: true, isKDrama: true })).toBe(
      "anime",
    );
    expect(resolveContentType({ isKDrama: true, isTv: true })).toBe("kdrama");
    expect(resolveContentType({ override: "series", isMovie: true })).toBe(
      "series",
    );
  });
});

import { describe, expect, it } from "vitest";
import { tmdbLooksAdult } from "../live-catalog";

describe("tmdbLooksAdult — hide regional 18+ films TMDB doesn't flag", () => {
  it("flags TMDB adult:true regardless of text", () => {
    expect(tmdbLooksAdult("Anything", "", true)).toBe(true);
  });

  it("flags erotic / softcore overviews (Filipino Vivamax-style, etc.)", () => {
    expect(
      tmdbLooksAdult(
        "Init",
        "A steamy affair unfolds as an erotic tale of lust and infidelity.",
        false,
      ),
    ).toBe(true);
    expect(
      tmdbLooksAdult(
        "Silip",
        "A sensual, explicit sex drama about seduction and desire.",
        false,
      ),
    ).toBe(true);
    expect(
      tmdbLooksAdult(
        "Some Film",
        "The story explores sexual obsession and nudity.",
        false,
      ),
    ).toBe(true);
  });

  it("flags an adult title corroborated by a suggestive overview", () => {
    expect(
      tmdbLooksAdult(
        "Bold Nights",
        "A married woman's affair with her lover reignites her desire.",
        false,
      ),
    ).toBe(true);
  });

  it("does NOT flag mainstream titles", () => {
    expect(
      tmdbLooksAdult(
        "The Avengers",
        "Earth's mightiest heroes team up to stop Loki.",
        false,
      ),
    ).toBe(false);
    // "Sex Education" — title hits but overview is not sexual/suggestive.
    expect(
      tmdbLooksAdult(
        "Sex Education",
        "A teenage boy sets up an underground therapy clinic at school.",
        false,
      ),
    ).toBe(false);
    expect(
      tmdbLooksAdult(
        "A Family Drama",
        "A heartfelt story about a family reuniting after years apart.",
        false,
      ),
    ).toBe(false);
  });
});

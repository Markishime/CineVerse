import { describe, expect, it } from "vitest";
import {
  normalizeTitleKey,
  titleTokenSimilarity,
  titlesLikelySame,
} from "../live-catalog";

describe("anime title matching", () => {
  it("matches Demon Slayer variants", () => {
    expect(
      titlesLikelySame(
        "Demon Slayer: Kimetsu no Yaiba",
        "Demon Slayer: Kimetsu no Yaiba",
      ),
    ).toBe(true);
    expect(
      titlesLikelySame("Demon Slayer: Kimetsu no Yaiba", "鬼滅の刃", [
        "Kimetsu no Yaiba",
        "鬼滅の刃",
      ]),
    ).toBe(true);
    expect(
      titleTokenSimilarity(
        "Demon Slayer Kimetsu no Yaiba",
        "Demon Slayer Kimetsu no Yaiba Swordsmith Village",
      ),
    ).toBeGreaterThan(0.5);
  });

  it("rejects TallBoyz for Demon Slayer", () => {
    expect(
      titlesLikelySame("Demon Slayer: Kimetsu no Yaiba", "TallBoyz"),
    ).toBe(false);
    expect(
      titleTokenSimilarity("Demon Slayer Kimetsu no Yaiba", "TallBoyz"),
    ).toBe(0);
  });

  it("rejects Attack on Titan vs random shows", () => {
    expect(titlesLikelySame("Attack on Titan", "Friends")).toBe(false);
    expect(titlesLikelySame("Attack on Titan", "Attack on Titan")).toBe(true);
  });

  it("normalizes season suffixes", () => {
    expect(normalizeTitleKey("Demon Slayer Season 2")).toContain("demon");
    expect(normalizeTitleKey("Demon Slayer: Kimetsu no Yaiba")).not.toContain(
      ":",
    );
  });
});

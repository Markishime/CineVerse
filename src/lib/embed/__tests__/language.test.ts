import { describe, expect, it } from "vitest";
import {
  normalizeLangCode,
  resolveEmbedLanguage,
  languageFromContentType,
  toStreamHostLanguage,
  isFilipinoLocale,
} from "../language";

describe("embed language", () => {
  it("normalizes TMDB-style tags", () => {
    expect(normalizeLangCode("ko-KR")).toBe("ko");
    expect(normalizeLangCode("zh-CN")).toBe("zh");
    expect(normalizeLangCode("ja")).toBe("ja");
    expect(normalizeLangCode("fil")).toBe("tl");
  });

  it("defaults by content type", () => {
    expect(languageFromContentType("anime")).toBe("ja");
    expect(languageFromContentType("kdrama")).toBe("ko");
    expect(languageFromContentType("cdrama")).toBe("zh");
    expect(languageFromContentType("thaidrama")).toBe("th");
  });

  it("prefers original language over English defaults", () => {
    expect(
      resolveEmbedLanguage({
        originalLanguage: "ko",
        contentType: "series",
      }),
    ).toBe("ko");
    expect(
      resolveEmbedLanguage({
        originalLanguage: "ja",
        contentType: "anime",
      }),
    ).toBe("ja");
    expect(
      resolveEmbedLanguage({
        originalLanguage: "th",
        contentType: "thaidrama",
      }),
    ).toBe("th");
  });

  it("uses country when language missing", () => {
    expect(
      resolveEmbedLanguage({
        contentType: "series",
        countries: ["KR"],
      }),
    ).toBe("ko");
    expect(
      resolveEmbedLanguage({
        contentType: "movie",
        countries: ["JP"],
      }),
    ).toBe("ja");
  });

  it("does not let empty user pref override origin", () => {
    expect(
      resolveEmbedLanguage({
        originalLanguage: "ko",
        contentType: "kdrama",
        userPreference: "en",
        allowUserOverride: false,
      }),
    ).toBe("ko");
  });

  it("maps Tagalog to English for free embed hosts", () => {
    expect(toStreamHostLanguage("tl", ["PH"])).toBe("en");
    expect(toStreamHostLanguage("fil", ["PH"])).toBe("en");
    expect(toStreamHostLanguage("ko", ["KR"])).toBe("ko");
    expect(toStreamHostLanguage("ja", ["JP"])).toBe("ja");
    expect(toStreamHostLanguage("zh", ["CN"])).toBe("zh");
    expect(toStreamHostLanguage("th", ["TH"])).toBe("th");
  });

  it("detects Filipino locale", () => {
    expect(isFilipinoLocale({ originalLanguage: "tl" })).toBe(true);
    expect(isFilipinoLocale({ countries: ["PH"] })).toBe(true);
    expect(isFilipinoLocale({ originalLanguage: "ko", countries: ["KR"] })).toBe(
      false,
    );
  });
});

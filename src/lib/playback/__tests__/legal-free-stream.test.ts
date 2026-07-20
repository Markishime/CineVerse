import { describe, expect, it } from "vitest";
import {
  buildLegalFreeStreamLinks,
  tubiSearchUrl,
} from "@/lib/playback/legal-free-stream";

describe("legal free stream links", () => {
  it("builds Tubi search with title and year", () => {
    const url = tubiSearchUrl("Spirited Away", 2001);
    expect(url).toContain("tubitv.com/search/");
    expect(decodeURIComponent(url)).toContain("Spirited Away");
    expect(decodeURIComponent(url)).toContain("2001");
  });

  it("orders Tubi first when no TMDB hits", () => {
    const links = buildLegalFreeStreamLinks({
      title: "Crash Landing on You",
      year: 2019,
      contentType: "kdrama",
      providers: [],
    });
    expect(links.map((l) => l.platform.id)).toEqual([
      "tubi",
      "pluto",
      "freevee",
    ]);
    expect(links.every((l) => !l.confirmedOnTmdb)).toBe(true);
  });

  it("marks confirmed when TMDB lists Tubi as free", () => {
    const links = buildLegalFreeStreamLinks({
      title: "Metropia",
      year: 2009,
      providers: [
        {
          id: 73,
          name: "Tubi TV",
          type: "free",
          link: "https://tubitv.com/movies/123",
        },
      ],
    });
    const tubi = links.find((l) => l.platform.id === "tubi");
    expect(tubi?.confirmedOnTmdb).toBe(true);
    expect(tubi?.href).toContain("tubitv.com");
  });
});

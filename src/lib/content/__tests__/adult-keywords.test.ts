import { beforeEach, describe, expect, it, vi } from "vitest";
import { tmdbFetch } from "@/lib/providers/tmdb-client";
import { isAdultTmdbTitle, TMDB_ADULT_KEYWORD_IDS } from "../adult-filter";

vi.mock("@/lib/providers/tmdb-client", () => ({ tmdbFetch: vi.fn() }));

beforeEach(() => vi.mocked(tmdbFetch).mockReset());

describe("TMDB keyword classification for ordinary films", () => {
  it.each([
    [9673, "love"],
    [9672, "based on true story"],
  ])("does not restrict a film for %s (%s)", async (id) => {
    vi.mocked(tmdbFetch).mockResolvedValue({ keywords: [{ id }] });
    expect(
      await isAdultTmdbTitle("movie", 593961, {
        adult: false,
        title: "Hello, Love, Goodbye",
        overview:
          "A bartender and a domestic helper fall in love while pursuing different plans.",
      }),
    ).toBe(false);
    // The same list powers public catalog exclusions.
    expect(TMDB_ADULT_KEYWORD_IDS.split("|")).not.toContain(String(id));
  });

  it("still restricts a film with an explicit-content keyword", async () => {
    vi.mocked(tmdbFetch).mockResolvedValue({ keywords: [{ id: 155477 }] });
    expect(await isAdultTmdbTitle("movie", 123, { adult: false })).toBe(true);
  });

  it("still restricts the authoritative adult flag", async () => {
    expect(await isAdultTmdbTitle("movie", 123, { adult: true })).toBe(true);
    expect(tmdbFetch).not.toHaveBeenCalled();
  });

  it("supports TV keyword response shape without restricting ordinary themes", async () => {
    vi.mocked(tmdbFetch).mockResolvedValue({
      results: [{ id: 9673 }, { id: 9672 }],
    });
    expect(
      await isAdultTmdbTitle("tv", 123, {
        adult: false,
        name: "A family story",
      }),
    ).toBe(false);
  });
});

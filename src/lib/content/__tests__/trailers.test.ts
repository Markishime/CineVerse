import { describe, expect, it } from "vitest";
import {
  filterOfficialTrailers,
  isTrailerType,
  pickHeroTrailer,
  pickOfficialTrailer,
  sanitizeContentTrailer,
} from "@/lib/content/trailers";
import type { Trailer } from "@/types/content";

const yt = (partial: Partial<Trailer> & { key: string }): Trailer => ({
  id: partial.id ?? `yt_${partial.key}`,
  key: partial.key,
  site: "youtube",
  name: partial.name ?? "Video",
  official: partial.official ?? false,
  type: partial.type,
});

describe("official trailers only", () => {
  it("accepts official Trailer type", () => {
    expect(
      isTrailerType({ type: "Trailer", name: "Official Trailer" }),
    ).toBe(true);
  });

  it("rejects clips and featurettes", () => {
    expect(isTrailerType({ type: "Clip", name: "Cool scene" })).toBe(false);
    expect(
      isTrailerType({ type: "Featurette", name: "Making of" }),
    ).toBe(false);
    expect(
      isTrailerType({ type: "Behind the Scenes", name: "BTS" }),
    ).toBe(false);
    expect(isTrailerType({ type: "Teaser", name: "Teaser" })).toBe(false);
  });

  it("picks official trailer over clip and teaser", () => {
    const list = [
      yt({ key: "aaaaaaaaaaa", type: "Clip", name: "Clip", official: true }),
      yt({
        key: "bbbbbbbbbbb",
        type: "Trailer",
        name: "Official Trailer",
        official: true,
      }),
      yt({ key: "ccccccccccc", type: "Teaser", name: "Teaser" }),
    ];
    const best = pickOfficialTrailer(list);
    expect(best?.key).toBe("bbbbbbbbbbb");
    expect(filterOfficialTrailers(list)).toHaveLength(1);
  });

  it("sanitizes non-trailer content.trailer", () => {
    const c = sanitizeContentTrailer({
      trailer: yt({
        key: "ddddddddddd",
        type: "Featurette",
        name: "Featurette",
      }),
    });
    expect(c.trailer).toBeNull();
  });

  it("hero trailer falls back to teaser when no Trailer exists", () => {
    const list = [
      yt({ key: "aaaaaaaaaaa", type: "Clip", name: "Clip" }),
      yt({
        key: "ttttttttttt",
        type: "Teaser",
        name: "Official Teaser",
        official: true,
      }),
    ];
    expect(pickOfficialTrailer(list)).toBeNull();
    expect(pickHeroTrailer(list)?.key).toBe("ttttttttttt");
  });

  it("hero trailer prefers Trailer over Teaser", () => {
    const list = [
      yt({ key: "ttttttttttt", type: "Teaser", name: "Teaser", official: true }),
      yt({
        key: "bbbbbbbbbbb",
        type: "Trailer",
        name: "Official Trailer",
        official: true,
      }),
    ];
    expect(pickHeroTrailer(list)?.key).toBe("bbbbbbbbbbb");
  });
});

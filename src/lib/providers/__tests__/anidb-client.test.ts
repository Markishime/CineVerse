import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { ContentSchema } from "@/types/content";
import { primaryScore } from "@/lib/content/normalize";
import { canonicalPathKey } from "@/lib/content/path-key";
import { deduplicateContent } from "@/lib/content/dedupe";
import { filterPublicCatalog, isHentaiContent } from "@/lib/content/mature";
import { CatalogService } from "@/lib/content/catalog-service";
import {
  fetchAnidbById,
  fetchAnidbCatalogPage,
  fetchAnidbTitleIndex,
  findAnidbTitleId,
  mergeAnidbMetadata,
  parseAnidbAnime,
  saveAnidbCatalog,
  withAnidbMetadata,
} from "../anidb-client";

function animeXml(id = 23, restricted = false, format = "TV Series") {
  return `<?xml version="1.0" encoding="UTF-8"?>
  <anime id="${id}" restricted="${restricted}">
    <type>${format}</type><episodecount>2</episodecount><startdate>2024-01-03</startdate><enddate>2024-02-03</enddate>
    <titles><title xml:lang="x-jat" type="main">Sample ${id}</title><title xml:lang="en" type="official">Series ${id}</title><title xml:lang="ja" type="official">サンプル${id}</title></titles>
    <description>A &amp; B explore https://anidb.net/a23 [a new world].</description><picture>12345.jpg</picture>
    <ratings><permanent count="200">8.25</permanent></ratings>
    <creators><name id="1" type="Animation Work">Studio Sample</name></creators>
    <resources><resource type="2"><externalentity><identifier>99</identifier></externalentity></resource></resources>
    <tags><tag id="2" weight="600" infobox="true"><name>adventure</name></tag><tag id="3" weight="700" isspoiler="true"><name>spoiler</name></tag></tags>
    <episodes>
      <episode id="3"><epno type="2">S1</epno><title xml:lang="en">Special</title></episode>
      <episode id="2"><epno type="1">2</epno><length>24</length><airdate>2024-01-10</airdate><title xml:lang="en">Second</title></episode>
      <episode id="1"><epno type="1">1</epno><length>22</length><airdate>2024-01-03</airdate><title xml:lang="en">First</title></episode>
    </episodes>
  </anime>`;
}

let cacheDir: string;
beforeEach(async () => {
  cacheDir = await mkdtemp(join(tmpdir(), "cineverse-anidb-test-"));
  vi.stubEnv("ANIDB_CACHE_DIR", cacheDir);
  vi.stubEnv("ANIDB_CLIENT_NAME", "");
  vi.stubEnv("ANIDB_CLIENT_VERSION", "");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (
    !resolve(cacheDir).startsWith(
      resolve(join(tmpdir(), "cineverse-anidb-test-")),
    )
  )
    throw new Error("Unexpected test cache path");
  await rm(cacheDir, { recursive: true, force: true });
});

describe("AniDB metadata", () => {
  it("maps names, art, ratings, studios and the ordered regular episode sequence", () => {
    const { content, episodes } = parseAnidbAnime(animeXml());
    expect(content).toMatchObject({
      id: "anidb_23",
      title: "Series 23",
      romajiTitle: "Sample 23",
      providerIds: { anidb: 23 },
      animeFormat: "TV",
      runtime: 23,
      episodeCount: 2,
      studios: ["Studio Sample"],
      mature: false,
    });
    expect(content.poster).toEqual({
      url: "https://cdn.anidb.net/images/main/12345.jpg",
      source: "anidb",
    });
    expect(content.scores).toEqual([
      { source: "anidb", score: 8.25, count: 200 },
    ]);
    expect(content.overview).toBe("A & B explore a new world.");
    expect(content.genres.map((g) => g.name)).toEqual(["adventure"]);
    expect(episodes.map((e) => [e.episodeNumber, e.name])).toEqual([
      [1, "First"],
      [2, "Second"],
    ]);
    expect(canonicalPathKey(content)).toBe("anidb_23");
  });

  it("uses the restricted flag even with no adult genre, and rejects API errors", () => {
    const c = parseAnidbAnime(animeXml(24, true, "OVA")).content;
    expect(c.mature).toBe(true);
    expect(isHentaiContent(c)).toBe(true);
    expect(filterPublicCatalog([c])).toEqual([]);
    expect(() => parseAnidbAnime('<error code="500">Banned</error>')).toThrow(
      "AniDB",
    );
    expect(() => parseAnidbAnime("<html>broken")).toThrow("Invalid AniDB");
  });

  it("keeps saved identities and playback IDs while AniDB wins metadata and ratings", () => {
    const metadata = parseAnidbAnime(animeXml(23, true, "OVA")).content;
    const base = ContentSchema.parse({
      ...metadata,
      id: "anilist_42",
      slug: "old-link",
      title: "Old title",
      providerIds: { anilist: 42, mal: 99, tmdb: 12, tmdbMediaType: "tv" },
      scores: [{ source: "tmdb", score: 6 }],
      mature: false,
      popularity: 9999,
    });
    const merged = mergeAnidbMetadata(base, metadata);
    expect(merged).toMatchObject({
      id: "anilist_42",
      slug: "old-link",
      title: "Series 23",
      mature: true,
      providerIds: { anidb: 23, anilist: 42, mal: 99, tmdb: 12 },
    });
    expect(primaryScore(merged)).toBe(8.25);
    expect(deduplicateContent([base, merged])).toHaveLength(1);
    expect(deduplicateContent([base, merged])[0].title).toBe("Series 23");
  });

  it("rejects ambiguous title matches instead of assigning the wrong anime", () => {
    const index = [
      { aid: 1, titles: ["Sample: Series"] },
      { aid: 2, titles: ["Sample Series", "Other"] },
    ];
    expect(findAnidbTitleId(["Sample Series"], index)).toBeNull();
    expect(findAnidbTitleId(["Other"], index)).toBe(2);
  });

  it("reads the gzipped official complete title index and caches it", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          gzipSync(
            '<animetitles><anime aid="23"><title xml:lang="en">Series 23</title></anime></animetitles>',
          ),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await fetchAnidbTitleIndex()).toEqual([
      { aid: 23, titles: ["Series 23"] },
    ]);
    await fetchAnidbTitleIndex();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caches HTTP metadata, preserves provider parameters and opens cold AniDB links", async () => {
    vi.stubEnv("ANIDB_CLIENT_NAME", "cineversetest");
    vi.stubEnv("ANIDB_CLIENT_VERSION", "2");
    const fetchMock = vi.fn(async (input: string) => {
      expect(input).toContain("httpapi");
      return new Response(animeXml());
    });
    vi.stubGlobal("fetch", fetchMock);
    await fetchAnidbById(23);
    const c = await new CatalogService().byId("anidb_23");
    expect(c?.title).toBe("Series 23");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(fetchMock.mock.calls[0]![0] as unknown as string);
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client: "cineversetest",
      clientver: "2",
      request: "anime",
      aid: "23",
      protover: "1",
    });
  });

  it("stops API traffic after provider errors and never caches errors as anime", async () => {
    vi.stubEnv("ANIDB_CLIENT_NAME", "cineversetest");
    vi.stubEnv("ANIDB_CLIENT_VERSION", "1");
    const fetchMock = vi.fn(
      async () => new Response('<error code="500">Banned</error>'),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchAnidbById(23)).rejects.toThrow("paused");
    expect(await fetchAnidbById(24)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(readFile(join(cacheDir, "23.json"))).rejects.toThrow();
  });

  it("blends hentai into Anime Series with adult access and keeps movies separate", async () => {
    const safe = parseAnidbAnime(animeXml()).content;
    const adult = parseAnidbAnime(animeXml(24, true, "OVA")).content;
    const film = parseAnidbAnime(animeXml(25, false, "Movie")).content;
    await saveAnidbCatalog([safe, adult, film], true);
    const mixed = await fetchAnidbCatalogPage(
      1,
      60,
      "title_asc",
      true,
      "series",
    );
    expect(mixed?.items.map((c) => c.id)).toEqual(["anidb_23", "anidb_24"]);
    expect(
      (
        await fetchAnidbCatalogPage(1, 60, "title_asc", false, "series")
      )?.items.map((c) => c.id),
    ).toEqual(["anidb_23"]);
    expect(
      (
        await fetchAnidbCatalogPage(1, 60, "title_asc", true, "movie")
      )?.items.map((c) => c.id),
    ).toEqual(["anidb_25"]);
    expect(
      (await fetchAnidbCatalogPage(2, 1, "title_asc", true, "series"))?.items[0]
        .id,
    ).toBe("anidb_24");
  });

  it("enriches partial imports without replacing full browsing or requiring API access", async () => {
    const metadata = parseAnidbAnime(animeXml()).content;
    await saveAnidbCatalog([metadata]);
    expect(await fetchAnidbCatalogPage(1, 60, "popularity", false)).toBeNull();
    const base = ContentSchema.parse({
      ...metadata,
      id: "anilist_42",
      title: "Sample 23",
      providerIds: { anilist: 42 },
    });
    const enriched = await withAnidbMetadata(base);
    expect(enriched.title).toBe("Series 23");
    expect(enriched.id).toBe("anilist_42");
  });

  it("returns AniDB episodes under existing saved content IDs and gates restricted IDs", async () => {
    const record = parseAnidbAnime(animeXml(24, true, "OVA"));
    await writeFile(join(cacheDir, "24.json"), JSON.stringify(record));
    const service = new CatalogService();
    expect(await service.byId("anidb_24", false)).toBeNull();
    expect(
      (await service.episodes("anidb_24_s1", true)).map((e) => e.name),
    ).toEqual(["First", "Second"]);
  });
});

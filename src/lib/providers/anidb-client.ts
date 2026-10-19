/** Server-side AniDB metadata. Browse reads a snapshot; the paced importer fills it. */
import {
  readFile,
  mkdir,
  writeFile,
  rename,
  open,
  stat,
  unlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { ContentSchema, type Content, type Episode } from "@/types/content";
import { slugify } from "@/lib/utils";
import { isMatureContent } from "@/lib/content/mature";
import { matchesAnimeFormatCategory } from "@/lib/content/classification";

const DAY = 86_400_000;
const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false });
type XmlNode = { [key: string]: XmlNode | XmlNode[] | string };
const nodes = (v: unknown): XmlNode[] =>
  !v ? [] : ((Array.isArray(v) ? v : [v]) as XmlNode[]);
const text = (v: unknown): string =>
  typeof v === "string" ? v : String((v as XmlNode)?.["#text"] ?? "");
const number = (v: unknown): number | undefined => {
  const s = text(v);
  return s && Number.isFinite(Number(s)) ? Number(s) : undefined;
};
const date = (v: unknown): string | null => {
  const s = text(v);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && s !== "1970-01-01" ? s : null;
};

export interface AnidbRecord {
  content: Content;
  episodes: Episode[];
  fetchedAt: number;
}
export const anidbCacheDir = () =>
  process.env.ANIDB_CACHE_DIR || join(tmpdir(), "cineverse-anidb");
export function isAnidbConfigured() {
  return Boolean(
    process.env.ANIDB_CLIENT_NAME &&
    /^[1-9]\d*$/.test(process.env.ANIDB_CLIENT_VERSION ?? ""),
  );
}

/** AniDB's restricted flag is authoritative; genre hints never downgrade it. */
export function parseAnidbAnime(xml: string): AnidbRecord {
  if (XMLValidator.validate(xml) !== true) throw new Error("Invalid AniDB XML");
  const root = parser.parse(xml);
  if (root.error) throw new Error(`AniDB ${text(root.error) || "API error"}`);
  const a = root.anime as XmlNode | undefined;
  const aid = number(a?.["@_id"]);
  if (!a || !aid || !Number.isSafeInteger(aid) || aid < 1)
    throw new Error("Missing AniDB anime identity");
  const titles = nodes((a.titles as XmlNode)?.title);
  const findTitle = (lang: string, type?: string) =>
    text(
      titles.find(
        (t) => t["@_xml:lang"] === lang && (!type || t["@_type"] === type),
      ),
    );
  const main = text(titles.find((t) => t["@_type"] === "main"));
  const english = findTitle("en", "official");
  const title = english || main || findTitle("ja");
  if (!title) throw new Error("Missing AniDB anime title");
  const tags = nodes((a.tags as XmlNode)?.tag).filter(
    (t) => t["@_isspoiler"] !== "true" && t["@_isspoiler"] !== "1",
  );
  const tagNames = tags.map((t) => text(t.name).toLowerCase());
  const restricted =
    a["@_restricted"] === "true" ||
    a["@_restricted"] === "1" ||
    tagNames.some((t) =>
      ["18 restricted", "pornography", "hentai"].includes(t),
    );
  const adultOriented =
    restricted ||
    tagNames.some((t) => ["borderline porn", "ecchi"].includes(t));
  const format: Content["animeFormat"] =
    (
      {
        Movie: "MOVIE",
        "TV Series": "TV",
        OVA: "OVA",
        Web: "ONA",
        "TV Special": "SPECIAL",
        "Music Video": "MUSIC",
        Other: "SPECIAL",
      } as const
    )[text(a.type)] ?? "SPECIAL";
  const releaseDate = date(a.startdate);
  const endDate = date(a.enddate);
  const today = new Date().toISOString().slice(0, 10);
  const rating = (a.ratings as XmlNode)?.permanent;
  const score = number(rating);
  const picture = text(a.picture);
  const malIds = [
    ...new Set(
      nodes((a.resources as XmlNode)?.resource)
        .filter((r) => text(r["@_type"]) === "2")
        .flatMap((r) =>
          nodes(r.externalentity).map((e) => number(e.identifier)),
        )
        .filter(
          (id): id is number =>
            id != null && Number.isSafeInteger(id) && id > 0,
        ),
    ),
  ];
  const id = `anidb_${aid}`;
  const episodes: Episode[] = nodes((a.episodes as XmlNode)?.episode)
    .flatMap((e) => {
      const epno = e.epno as XmlNode;
      const episodeNumber = number(epno);
      // Type 1 is the normal sequence. Specials, trailers and credits are separate.
      if (
        text(epno?.["@_type"]) !== "1" ||
        !episodeNumber ||
        !Number.isInteger(episodeNumber)
      )
        return [];
      const names = nodes(e.title);
      const name =
        text(names.find((t) => t["@_xml:lang"] === "en")) || text(names[0]);
      return [
        {
          id: `${id}_s1_e${episodeNumber}`,
          contentId: id,
          seasonId: `${id}_s1`,
          seasonNumber: 1,
          episodeNumber,
          name: name || `Episode ${episodeNumber}`,
          overview: text(e.summary),
          stillPath: null,
          airDate: date(e.airdate),
          runtime: number(e.length) ?? null,
          playable: false,
        },
      ];
    })
    .sort((a, b) => a.episodeNumber - b.episodeNumber);
  const lengths = episodes
    .map((e) => e.runtime)
    .filter((n): n is number => n != null && n > 0);
  const content = ContentSchema.parse({
    id,
    slug: `${slugify(title)}-anidb-${aid}`,
    contentType: "anime",
    title,
    englishTitle: english || undefined,
    romajiTitle: findTitle("x-jat") || main || undefined,
    nativeTitle: findTitle("ja") || undefined,
    originalTitle: main || title,
    alternateTitles: [...new Set(titles.map(text).filter(Boolean))],
    overview: text(a.description)
      .replace(/https?:\/\/\S+ \[([^\]]+)\]/g, "$1")
      .trim(),
    poster: /^[\w.-]+\.(jpg|png|webp)$/i.test(picture)
      ? { url: `https://cdn.anidb.net/images/main/${picture}`, source: "anidb" }
      : null,
    releaseDate,
    year: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
    status:
      releaseDate && releaseDate > today
        ? "upcoming"
        : endDate && endDate <= today
          ? "ended"
          : releaseDate
            ? "airing"
            : "unknown",
    language: "ja",
    countries: ["JP"],
    animeFormat: format,
    genres: tags
      .filter(
        (t) =>
          t["@_infobox"] === "true" ||
          t["@_infobox"] === "1" ||
          (number(t["@_weight"]) ?? 0) >= 400,
      )
      .map((t) => ({ id: `anidb_tag_${t["@_id"]}`, name: text(t.name) }))
      .filter((t) => t.name),
    episodeCount: number(a.episodecount) ?? (episodes.length || null),
    seasonCount: format === "MOVIE" ? null : 1,
    runtime: lengths.length
      ? Math.round(lengths.reduce((sum, n) => sum + n, 0) / lengths.length)
      : null,
    scores:
      score != null && score >= 0 && score <= 10
        ? [
            {
              source: "anidb",
              score,
              count: number((rating as XmlNode)?.["@_count"]),
            },
          ]
        : [],
    popularity: number((rating as XmlNode)?.["@_count"]) ?? 0,
    studios: nodes((a.creators as XmlNode)?.name)
      .filter((n) => ["Animation Work", "Work"].includes(text(n["@_type"])))
      .map(text),
    providerIds: {
      anidb: aid,
      ...(malIds.length === 1 ? { mal: malIds[0] } : {}),
    },
    ageRating: adultOriented ? "18+" : null,
    mature: adultOriented,
    tags: [
      "anime",
      "anidb",
      ...tagNames,
      ...(restricted
        ? ["anidb-restricted", "hentai", "adult-anime", "explicit", "18+"]
        : adultOriented
          ? ["anime-adult-genre", "adults-only"]
          : []),
    ],
    lastSyncedAt: new Date().toISOString(),
  });
  return { content, episodes, fetchedAt: Date.now() };
}

async function readRecord(aid: number): Promise<AnidbRecord | null> {
  try {
    const row = JSON.parse(
      await readFile(join(anidbCacheDir(), `${aid}.json`), "utf8"),
    ) as AnidbRecord;
    row.content = ContentSchema.parse(row.content);
    return row.content.providerIds.anidb === aid ? row : null;
  } catch {
    return null;
  }
}

async function atomicWrite(name: string, value: unknown) {
  await mkdir(anidbCacheDir(), { recursive: true });
  const target = join(anidbCacheDir(), name);
  const temp = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value));
  await rename(temp, target);
}

/** Serialized and shared-file paced, including a concurrent importer on this host. */
let queue: Promise<unknown> = Promise.resolve();
export async function fetchAnidbById(aid: number): Promise<AnidbRecord | null> {
  if (!Number.isSafeInteger(aid) || aid < 1) return null;
  const cached = await readRecord(aid);
  if (cached && Date.now() - cached.fetchedAt < DAY) return cached;
  if (!isAnidbConfigured()) return cached;
  const task = queue.then(async () => {
    const fresh = await readRecord(aid);
    if (fresh && Date.now() - fresh.fetchedAt < DAY) return fresh;
    await mkdir(anidbCacheDir(), { recursive: true });
    const lockPath = join(anidbCacheDir(), "request.lock");
    let lock;
    try {
      lock = await open(lockPath, "wx");
    } catch {
      // A crashed worker must not block metadata forever.
      const info = await stat(lockPath).catch(() => null);
      if (info && Date.now() - info.mtimeMs > 60_000)
        await unlink(lockPath).catch(() => {});
      return fresh;
    }
    try {
      const state = JSON.parse(
        await readFile(join(anidbCacheDir(), "rate.json"), "utf8").catch(
          () => "{}",
        ),
      );
      if ((state.blockedUntil ?? 0) > Date.now()) return fresh;
      const delay = Math.max(0, (state.lastRequest ?? 0) + 4_000 - Date.now());
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      await atomicWrite("rate.json", { lastRequest: Date.now() });
      const params = new URLSearchParams({
        request: "anime",
        aid: String(aid),
        protover: "1",
        client: process.env.ANIDB_CLIENT_NAME!,
        clientver: process.env.ANIDB_CLIENT_VERSION!,
      });
      const response = await fetch(
        `http://api.anidb.net:9001/httpapi?${params}`,
        { cache: "no-store", signal: AbortSignal.timeout(12_000) },
      );
      const xml = await response.text();
      if (!response.ok || /<error\b/i.test(xml)) {
        await atomicWrite("rate.json", {
          lastRequest: Date.now(),
          blockedUntil: Date.now() + DAY,
        });
        throw new Error(
          `AniDB request failed (${response.status}); API requests paused for 24 hours`,
        );
      }
      const record = parseAnidbAnime(xml);
      if (record.content.providerIds.anidb !== aid)
        throw new Error("AniDB returned the wrong anime");
      await atomicWrite(`${aid}.json`, record);
      return record;
    } finally {
      await lock.close();
      await unlink(lockPath).catch(() => {});
    }
  });
  queue = task.catch(() => null);
  return task;
}

let snapshot:
  | {
      path: string;
      at: number;
      items: Content[];
      complete: boolean;
      byId: Map<number, Content>;
      titleIds: Map<string, number | null>;
    }
  | undefined;
function indexSnapshot(path: string, items: Content[], complete: boolean) {
  const titleIds = new Map<string, number | null>();
  const byId = new Map<number, Content>();
  for (const c of items) {
    const aid = c.providerIds.anidb!;
    byId.set(aid, c);
    for (const title of [c.title, ...c.alternateTitles]) {
      const key = titleKey(title);
      if (!key) continue;
      if (!titleIds.has(key)) titleIds.set(key, aid);
      else if (titleIds.get(key) !== aid) titleIds.set(key, null);
    }
  }
  return { path, at: Date.now(), items, complete, byId, titleIds };
}
export async function readAnidbCatalog(): Promise<Content[]> {
  const path = join(anidbCacheDir(), "catalog.json");
  if (snapshot?.path === path && Date.now() - snapshot.at < 30_000)
    return snapshot.items;
  try {
    const raw = JSON.parse(await readFile(path, "utf8")) as {
      items: unknown[];
      complete: boolean;
    };
    const items = raw.items.flatMap((r) => {
      const parsed = ContentSchema.safeParse(r);
      return parsed.success && parsed.data.providerIds.anidb
        ? [parsed.data]
        : [];
    });
    snapshot = indexSnapshot(path, items, raw.complete === true);
    return items;
  } catch {
    snapshot = indexSnapshot(path, [], false);
    return [];
  }
}
export async function isAnidbCatalogComplete() {
  await readAnidbCatalog();
  return snapshot?.complete === true;
}
export async function saveAnidbCatalog(items: Content[], complete = false) {
  await atomicWrite("catalog.json", { items, complete });
  snapshot = undefined;
}

/** Official complete title index: used by imports and exact, unambiguous matching. */
export async function fetchAnidbTitleIndex(): Promise<
  Array<{ aid: number; titles: string[] }>
> {
  const path = join(anidbCacheDir(), "titles.json");
  try {
    const cached = JSON.parse(await readFile(path, "utf8"));
    if (Date.now() - cached.at < DAY) return cached.items;
  } catch {
    /* first import */
  }
  const response = await fetch("https://anidb.net/api/anime-titles.xml.gz", {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("Unable to download AniDB title index");
  const body = Buffer.from(await response.arrayBuffer());
  const xml = (
    body[0] === 0x1f && body[1] === 0x8b ? gunzipSync(body) : body
  ).toString("utf8");
  if (XMLValidator.validate(xml) !== true)
    throw new Error("Invalid AniDB title index");
  const items = nodes(parser.parse(xml).animetitles?.anime).flatMap((a) => {
    const aid = number(a["@_aid"]);
    return aid && Number.isSafeInteger(aid) && aid > 0
      ? [{ aid, titles: nodes(a.title).map(text).filter(Boolean) }]
      : [];
  });
  if (!items.length) throw new Error("Empty AniDB title index");
  await atomicWrite("titles.json", { at: Date.now(), items });
  return items;
}

const titleKey = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
export function findAnidbTitleId(
  titles: string[],
  index: Array<{ aid: number; titles: string[] }>,
): number | null {
  const wanted = new Set(titles.map(titleKey).filter(Boolean));
  const matches = index.filter((row) =>
    row.titles.some((t) => wanted.has(titleKey(t))),
  );
  return matches.length === 1 ? matches[0].aid : null;
}

/** Keep saved identities and playback IDs; descriptive metadata belongs to AniDB. */
export function mergeAnidbMetadata(base: Content, metadata: Content): Content {
  return {
    ...base,
    ...metadata,
    id: base.id,
    slug: base.slug,
    providerIds: { ...base.providerIds, ...metadata.providerIds },
    alternateTitles: [
      ...new Set([
        base.title,
        ...base.alternateTitles,
        ...metadata.alternateTitles,
      ]),
    ],
    poster: metadata.poster ?? base.poster,
    backdrop: base.backdrop,
    trailer: base.trailer,
    watchProviders: base.watchProviders,
    regionalPlatforms: base.regionalPlatforms,
    scores: [
      ...metadata.scores,
      ...base.scores.filter((s) => s.source !== "anidb"),
    ],
    popularity: Math.max(base.popularity, metadata.popularity),
    playable: base.playable,
    mature: base.mature || metadata.mature,
    tags: [...new Set([...base.tags, ...metadata.tags])],
  };
}

export async function withAnidbMetadata(
  base: Content,
  refresh = false,
): Promise<Content> {
  if (base.contentType !== "anime") return base;
  await readAnidbCatalog();
  const titles = [
    base.title,
    base.romajiTitle,
    base.englishTitle,
    base.nativeTitle,
    ...base.alternateTitles,
  ].filter(Boolean) as string[];
  const matchingIds = new Set(
    titles
      .map((t) => snapshot?.titleIds.get(titleKey(t)))
      .filter((id) => id !== undefined),
  );
  let aid =
    base.providerIds.anidb ??
    (matchingIds.size === 1 ? [...matchingIds][0] : null);
  if (!aid && refresh && isAnidbConfigured())
    aid = findAnidbTitleId(titles, await fetchAnidbTitleIndex());
  if (!aid) return base;
  const cachedMetadata = snapshot?.byId.get(aid);
  const metadata = refresh
    ? (await fetchAnidbById(aid))?.content
    : (cachedMetadata ?? (await readRecord(aid))?.content);
  const hit = metadata ?? cachedMetadata;
  return hit ? mergeAnidbMetadata(base, hit) : base;
}

export async function fetchAnidbCatalogPage(
  page: number,
  size: number,
  sort: string,
  includeMature: boolean,
  format?: "movie" | "series",
  genre?: string,
) {
  const catalog = await readAnidbCatalog();
  if (!catalog.length || !snapshot?.complete) return null;
  const genreKey = genre?.toLowerCase();
  const items = catalog.filter(
    (c) =>
      (c.year == null || c.year >= 1980) &&
      (includeMature || !isMatureContent(c)) &&
      (!format || matchesAnimeFormatCategory(c, format)) &&
      (!genreKey ||
        (genreKey === "mature"
          ? c.mature
          : c.genres.some((g) => g.name.toLowerCase() === genreKey))),
  );
  items.sort((a, b) => {
    switch (sort) {
      case "title_asc":
        return a.title.localeCompare(b.title);
      case "title_desc":
        return b.title.localeCompare(a.title);
      case "oldest":
        return (a.year ?? 9999) - (b.year ?? 9999);
      case "newest":
        return (b.year ?? 0) - (a.year ?? 0);
      case "runtime":
        return (b.runtime ?? 0) - (a.runtime ?? 0);
      case "rating":
        return (b.scores[0]?.score ?? 0) - (a.scores[0]?.score ?? 0);
      default:
        return b.popularity - a.popularity;
    }
  });
  return {
    items: items.slice((page - 1) * size, page * size),
    page,
    total: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / size)),
  };
}

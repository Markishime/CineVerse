/**
 * GMMTV official YouTube channel integration.
 * Fetches free, legally uploaded Thai drama content from GMMTV's YouTube channel.
 * RSS feed is public and requires no API key.
 */

import type { Content } from "@/types/content";

const GMMTV_CHANNEL_ID = "UCzFMXnFXmFeVqPfJfPn3bRg";
const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${GMMTV_CHANNEL_ID}`;

/* ------------------------------------------------------------------ */
/*  RSS parsing                                                         */
/* ------------------------------------------------------------------ */

interface GmmmtvVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  link: string;
}

function parseAtomFeed(xml: string): GmmmtvVideo[] {
  const entries: GmmmtvVideo[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1];
    const videoId = extractTag(block, "yt:videoId");
    const title = extractTag(block, "title");
    const description = extractTag(block, "media:group media:description");
    const thumbnail =
      extractAttr(block, "media:thumbnail", "url") ??
      extractAttr(block, "media:group media:thumbnail", "url");
    const publishedAt = extractTag(block, "published");
    const link = extractAttr(block, "link", "href");

    if (videoId && title) {
      entries.push({
        videoId,
        title,
        description: description ?? "",
        thumbnail: thumbnail ?? "",
        publishedAt: publishedAt ?? "",
        link: link ?? `https://www.youtube.com/watch?v=${videoId}`,
      });
    }
  }

  return entries;
}

function extractTag(block: string, tag: string): string | null {
  // Handle namespace-prefixed tags like media:group media:description
  const parts = tag.split(" ");
  const tagName = parts[parts.length - 1];

  // Build regex pattern considering optional namespaces
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<${escapedTag}[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, "i");
  const m = block.match(regex);
  return m?.[1]?.trim() ?? null;
}

function extractAttr(
  block: string,
  tag: string,
  attr: string,
): string | null {
  const parts = tag.split(" ");
  const tagName = parts[parts.length - 1];
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`<${escapedTag}[^>]*?${attr}="([^"]*)"`, "i");
  const m = block.match(regex);
  return m?.[1] ?? null;
}

/* ------------------------------------------------------------------ */
/*  Fetch latest GMMTV videos                                          */
/* ------------------------------------------------------------------ */

export async function fetchGmmtvLatest(limit = 20): Promise<GmmmtvVideo[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 14_000);
    const res = await fetch(RSS_URL, {
      signal: controller.signal,
      next: { revalidate: 900 },
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.error("GMMTV RSS error", res.status);
      return [];
    }

    const xml = await res.text();
    return parseAtomFeed(xml).slice(0, limit);
  } catch (e) {
    console.error("GMMTV RSS fetch failed", e);
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Content mapping                                                     */
/* ------------------------------------------------------------------ */

const DRAMA_KEYWORDS = [
  "kdrama", "cdrama", "jdrama", "thaidrama",
  "drama", "series", "tv series",
];

function isDramaContent(title: string, description: string): boolean {
  const combined = `${title} ${description}`.toLowerCase();
  return DRAMA_KEYWORDS.some((kw) => combined.includes(kw)) ||
    // GMMTV videos are almost exclusively Thai drama series
    combined.includes("ep.") ||
    combined.includes("episode") ||
    combined.includes("part");
}

function extractEpisodeNumber(title: string): { cleanTitle: string; episode: number | null } {
  const epMatch = title.match(/(?:ep\.?\s*|episode\s*)(\d+)/i);
  if (epMatch) {
    return {
      cleanTitle: title.replace(/(?:ep\.?\s*\d+|episode\s*\d+)/i, "").trim(),
      episode: parseInt(epMatch[1], 10),
    };
  }
  return { cleanTitle: title, episode: null };
}

export function mapGmmtvVideo(video: GmmmtvVideo): Partial<Content> | null {
  if (!isDramaContent(video.title, video.description)) return null;

  const { cleanTitle } = extractEpisodeNumber(video.title);
  const slug = cleanTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return {
    title: cleanTitle,
    slug: slug || `gmmtv-${video.videoId}`,
    contentType: "thaidrama",
    overview: video.description || `${cleanTitle} - Official GMMTV upload`,
    poster: video.thumbnail
      ? { url: video.thumbnail, source: "local" as const }
      : undefined,
    releaseDate: video.publishedAt?.split("T")[0],
    countries: ["TH"],
    language: "th",
    tags: ["gmmtv", "thai-drama", "free", "youtube"],
    studios: ["GMMTV"],
    providerIds: {
      tmdb: undefined,
      anilist: undefined,
      tvmaze: undefined,
    },
    watchProviders: [],
    approved: true,
    mature: false,
    lastSyncedAt: new Date().toISOString(),
  };
}

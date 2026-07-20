import { isValidAnime } from "../lib/classification";

const ENDPOINT = "https://graphql.anilist.co";

const SEARCH_QUERY = `
query ($search: String) {
  Page(page: 1, perPage: 20) {
    media(search: $search, type: ANIME, isAdult: false) {
      id
      format
      type
      isAdult
      averageScore
      popularity
      description
      episodes
      title { romaji english native }
      coverImage { large extraLarge }
      bannerImage
      startDate { year }
      genres
    }
  }
}
`;

const AIRING_QUERY = `
query {
  Page(page: 1, perPage: 30) {
    media(type: ANIME, status: RELEASING, isAdult: false, sort: POPULARITY_DESC) {
      id
      format
      type
      isAdult
      averageScore
      popularity
      description
      episodes
      title { romaji english native }
      coverImage { large extraLarge }
      bannerImage
      startDate { year }
      genres
      nextAiringEpisode { airingAt episode }
    }
  }
}
`;

export interface NormalizedAnime {
  id: string;
  slug: string;
  contentType: "anime";
  title: string;
  englishTitle?: string;
  romajiTitle?: string;
  nativeTitle?: string;
  overview: string;
  poster: { url: string; source: "anilist" } | null;
  backdrop: { url: string; source: "anilist" } | null;
  year: number | null;
  popularity: number;
  language: string;
  countries: string[];
  genres: Array<{ id: string; name: string }>;
  providerIds: { anilist: number };
  approved: boolean;
  status: string;
  scores: Array<{ source: "anilist"; score: number }>;
  episodeCount: number | null;
  lastSyncedAt: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export class AnilistAdapter {
  private async gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`AniList ${res.status}`);
      const json = (await res.json()) as { data: T; errors?: unknown };
      if (json.errors) throw new Error("AniList GraphQL error");
      return json.data;
    } finally {
      clearTimeout(timer);
    }
  }

  private map(raw: Record<string, unknown>): NormalizedAnime | null {
    const titleObj = (raw.title ?? {}) as {
      english?: string;
      romaji?: string;
      native?: string;
    };
    const title =
      titleObj.english || titleObj.romaji || titleObj.native || null;
    const cover = (raw.coverImage ?? {}) as {
      large?: string;
      extraLarge?: string;
    };
    const coverUrl = cover.extraLarge || cover.large;

    if (
      !isValidAnime({
        format: raw.format ? String(raw.format) : null,
        isAdult: Boolean(raw.isAdult),
        hasTitle: Boolean(title),
        hasCover: Boolean(coverUrl),
        mediaType: raw.type ? String(raw.type) : "ANIME",
      })
    ) {
      return null;
    }

    const id = Number(raw.id);
    const start = (raw.startDate ?? {}) as { year?: number };
    return {
      id: `anilist_${id}`,
      slug: slugify(`${title}-${id}`),
      contentType: "anime",
      title: title as string,
      englishTitle: titleObj.english,
      romajiTitle: titleObj.romaji,
      nativeTitle: titleObj.native,
      overview: String(raw.description ?? "")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, ""),
      poster: coverUrl
        ? { url: coverUrl, source: "anilist" }
        : null,
      backdrop: raw.bannerImage
        ? { url: String(raw.bannerImage), source: "anilist" }
        : null,
      year: start.year ?? null,
      popularity: Number(raw.popularity ?? 0),
      language: "ja",
      countries: ["JP"],
      genres: Array.isArray(raw.genres)
        ? (raw.genres as string[]).map((g) => ({
            id: g.toLowerCase(),
            name: g,
          }))
        : [],
      providerIds: { anilist: id },
      approved: true,
      status: "airing",
      scores: raw.averageScore
        ? [{ source: "anilist", score: Number(raw.averageScore) / 10 }]
        : [],
      episodeCount: raw.episodes != null ? Number(raw.episodes) : null,
      lastSyncedAt: new Date().toISOString(),
    };
  }

  async search(q: string): Promise<NormalizedAnime[]> {
    if (!q.trim()) return [];
    const data = await this.gql<{
      Page: { media: Record<string, unknown>[] };
    }>(SEARCH_QUERY, { search: q });
    return (data.Page?.media ?? [])
      .map((m) => this.map(m))
      .filter(Boolean) as NormalizedAnime[];
  }

  async currentlyAiring(): Promise<NormalizedAnime[]> {
    const data = await this.gql<{
      Page: { media: Record<string, unknown>[] };
    }>(AIRING_QUERY);
    return (data.Page?.media ?? [])
      .map((m) => this.map(m))
      .filter(Boolean) as NormalizedAnime[];
  }
}

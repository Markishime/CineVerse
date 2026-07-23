/**
 * Async anime embed resolvers.
 * Pair AniList/MAL/title metadata with maintained streaming backends
 * that require session IDs or scraped player IDs.
 */

const ANIMEPAHE_API = "https://myapi-psi-wheat.vercel.app";

export type ResolvedAnimeEmbed = {
  provider: "animepahe" | "supaplay";
  url: string;
  label?: string;
};

type PaheSearchHit = {
  id?: number;
  title?: string;
  session?: string;
  year?: number;
  type?: string;
};

type PaheEpisode = {
  id?: number;
  number?: number;
  title?: string;
  session?: string;
};

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleScore(query: string, candidate: string): number {
  const q = normalizeTitle(query);
  const c = normalizeTitle(candidate);
  if (!q || !c) return 0;
  if (q === c) return 100;
  if (c.includes(q) || q.includes(c)) return 80;
  const qw = new Set(q.split(" "));
  const cw = c.split(" ");
  let hit = 0;
  for (const w of cw) if (qw.has(w)) hit++;
  return (hit / Math.max(qw.size, 1)) * 60;
}

async function fetchJson<T>(url: string, timeoutMs = 20_000): Promise<T | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Resolve AnimePahe embed via search → episodes → /embed sessions.
 * Metadata comes from AniList title (and optional year).
 */
export async function resolveAnimePaheEmbed(opts: {
  title: string;
  episode?: number;
  year?: number | null;
  anilist?: number;
}): Promise<ResolvedAnimeEmbed | null> {
  const title = opts.title?.trim();
  if (!title) return null;
  const epNum = Math.max(1, opts.episode ?? 1);

  const results = await fetchJson<PaheSearchHit[]>(
    `${ANIMEPAHE_API}/search?q=${encodeURIComponent(title)}`,
  );
  if (!results?.length) return null;

  const ranked = [...results].sort((a, b) => {
    let sa = titleScore(title, a.title ?? "");
    let sb = titleScore(title, b.title ?? "");
    if (opts.year && a.year === opts.year) sa += 15;
    if (opts.year && b.year === opts.year) sb += 15;
    return sb - sa;
  });

  const best = ranked[0];
  if (!best?.session || titleScore(title, best.title ?? "") < 25) return null;

  // Prefer /anime convenience endpoint (episodes + ids)
  const anime = await fetchJson<{
    session?: string;
    episodes?: PaheEpisode[];
    ids?: { anilist?: number | null; myanimelist?: number | null };
  }>(`${ANIMEPAHE_API}/anime?session=${encodeURIComponent(best.session)}`);

  // If AniList id known, prefer a match
  let animeSession = anime?.session ?? best.session;
  let episodes = anime?.episodes ?? [];

  if (
    opts.anilist &&
    anime?.ids?.anilist &&
    anime.ids.anilist !== opts.anilist
  ) {
    // Try second search hit with closer AniList match via /ids
    for (const hit of ranked.slice(1, 5)) {
      if (!hit.session) continue;
      const alt = await fetchJson<{
        session?: string;
        episodes?: PaheEpisode[];
        ids?: { anilist?: number | null };
      }>(`${ANIMEPAHE_API}/anime?session=${encodeURIComponent(hit.session)}`);
      if (alt?.ids?.anilist === opts.anilist) {
        animeSession = alt.session ?? hit.session;
        episodes = alt.episodes ?? [];
        break;
      }
    }
  }

  if (!episodes.length) {
    const epList = await fetchJson<PaheEpisode[]>(
      `${ANIMEPAHE_API}/episodes?session=${encodeURIComponent(animeSession)}`,
    );
    episodes = epList ?? [];
  }

  const ep =
    episodes.find((e) => Number(e.number) === epNum) ??
    episodes[epNum - 1] ??
    episodes[0];
  if (!ep?.session) return null;

  const url = `${ANIMEPAHE_API}/embed?anime_session=${encodeURIComponent(animeSession)}&episode_session=${encodeURIComponent(ep.session)}&title=${encodeURIComponent(ep.title || `Episode ${epNum}`)}`;

  return {
    provider: "animepahe",
    url,
    label: ep.title,
  };
}

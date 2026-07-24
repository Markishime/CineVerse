/**
 * Streaming embed providers for CineVerse.
 *
 * Architecture:
 * - Metadata: AniList + MAL + TMDB (catalog layer)
 * - Playback: multi-provider fallback chain (not a single hard-coded host)
 *
 * Anime uses dedicated backends (AniList/MAL-aware). Movies/series/K-drama use
 * TMDB-based general embeds.
 */

export type EmbedProviderId =
  // General — movies / series
  | "vidlink"
  | "vidfast"
  | "autoembed"
  | "vidsrc"
  | "vidcore"
  | "2embed"
  | "2embedskin"
  | "moviesapi"
  | "smashystream"
  | "vidphantom"
  | "superembed"
  // Anime-only backends
  | "cinezo"
  | "animepahe"
  | "screenscape"
  | "dropfile"
  | "ezvidapi"
  | "supaplay"
  // Asian-drama backends (K/C/J/Thai)
  | "dramaplay"
  | "kisskh"
  | "nontongo"
  | "frembed";

export interface EmbedUrlOpts {
  autoplay?: boolean;
  /** ISO 639-1 language — used as audio preference (ja→sub, en→dub when applicable) */
  language?: string;
  /** Prefer dubbed audio when the backend supports it */
  dub?: boolean;
}

export interface AnimeStreamIds {
  title: string;
  anilist?: number;
  mal?: number;
  tmdb?: number;
  tmdbMediaType?: "movie" | "tv";
  /** Absolute episode number (1 for anime movies / OVAs treated as single unit) */
  episode?: number;
  season?: number;
  animeFormat?: string;
  language?: string;
  dub?: boolean;
}

export interface EmbedProvider {
  id: EmbedProviderId;
  name: string;
  supportsTv: boolean;
  /** Anime-only providers are excluded from movie/series/kdrama chains */
  animeOnly?: boolean;
  /** Asian-drama-only providers (K/C/J/Thai) — excluded from other chains */
  dramaOnly?: boolean;
  movieUrl: (tmdbId: number, opts?: EmbedUrlOpts) => string;
  tvUrl: (
    tmdbId: number,
    season: number,
    episode: number,
    opts?: EmbedUrlOpts,
  ) => string;
  /** Optional anime-native URL builder (AniList / MAL / episode) */
  animeUrl?: (ids: AnimeStreamIds) => string | null;
  /** Needs async server resolve before iframe can load (e.g. AnimePahe sessions) */
  needsResolve?: boolean;
}

function qs(
  base: string,
  params: Record<string, string | undefined | boolean | number>,
): string {
  const sp = new URLSearchParams();
  // Default anti-ad flags (hosts ignore unknown keys)
  sp.set("ads", "0");
  sp.set("ad", "0");
  sp.set("noads", "1");
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === false || v === "") continue;
    sp.set(k, String(v === true ? "1" : v));
  }
  const s = sp.toString();
  if (!s) return base;
  return `${base}${base.includes("?") ? "&" : "?"}${s}`;
}

function preferDub(opts?: EmbedUrlOpts, ids?: AnimeStreamIds): boolean {
  if (ids?.dub != null) return ids.dub;
  if (opts?.dub != null) return opts.dub;
  const lang = (ids?.language ?? opts?.language ?? "ja").toLowerCase();
  return lang === "en" || lang.startsWith("en-");
}

/**
 * General TMDB providers (movies / series / dramas / anime TMDB fallback).
 * Priority = reliability (most working first):
 * VidFast → AutoEmbed → VidSrc → VidCore → 2Embed → VidLink → …
 */
export const GENERAL_EMBED_PROVIDERS: EmbedProvider[] = [
  {
    id: "vidfast",
    name: "VidFast",
    supportsTv: true,
    // Official embeds: https://vidfast.vc/movie/{id}?autoPlay=true
    //                 https://vidfast.vc/tv/{id}/{season}/{episode}?autoPlay=true
    movieUrl: (tmdbId, opts) => {
      const auto =
        opts?.autoplay === false ? "false" : "true";
      return qs(`https://vidfast.vc/movie/${tmdbId}`, {
        autoPlay: auto,
      });
    },
    tvUrl: (tmdbId, season, episode, opts) => {
      const auto =
        opts?.autoplay === false ? "false" : "true";
      return qs(`https://vidfast.vc/tv/${tmdbId}/${season}/${episode}`, {
        autoPlay: auto,
      });
    },
  },
  {
    id: "autoembed",
    name: "AutoEmbed",
    supportsTv: true,
    // lang = content origin (ko/ja/zh/th/en…) so Korean stays Korean, etc.
    movieUrl: (tmdbId, opts) =>
      qs(`https://autoembed.co/movie/tmdb/${tmdbId}`, {
        autoplay: opts?.autoplay,
        lang: opts?.language || "en",
      }),
    tvUrl: (tmdbId, season, episode, opts) =>
      qs(`https://autoembed.co/tv/tmdb/${tmdbId}-${season}-${episode}`, {
        autoplay: opts?.autoplay,
        lang: opts?.language || "en",
      }),
  },
  {
    id: "vidsrc",
    name: "VidSrc",
    supportsTv: true,
    movieUrl: (tmdbId, opts) =>
      qs(`https://vidsrc.to/embed/movie/${tmdbId}`, {
        autoplay: opts?.autoplay,
        lang: opts?.language,
      }),
    tvUrl: (tmdbId, season, episode, opts) =>
      qs(`https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`, {
        autoplay: opts?.autoplay,
        lang: opts?.language,
      }),
  },
  {
    id: "vidcore",
    name: "VidCore",
    supportsTv: true,
    movieUrl: (tmdbId, opts) =>
      qs(`https://vidcore.org/embed/movie/${tmdbId}/`, {
        autoplay: opts?.autoplay,
        lang: opts?.language || "en",
      }),
    tvUrl: (tmdbId, season, episode, opts) =>
      qs(`https://vidcore.org/embed/tv/${tmdbId}/${season}/${episode}/`, {
        autoplay: opts?.autoplay,
        lang: opts?.language || "en",
      }),
  },
  {
    id: "2embed",
    name: "2Embed",
    supportsTv: true,
    movieUrl: (tmdbId, opts) =>
      qs(`https://www.2embed.online/embed/movie/${tmdbId}`, {
        autoplay: opts?.autoplay,
        lang: opts?.language || "en",
      }),
    tvUrl: (tmdbId, season, episode, opts) =>
      qs(`https://www.2embed.online/embed/tv/${tmdbId}/${season}/${episode}`, {
        autoplay: opts?.autoplay,
        lang: opts?.language || "en",
      }),
  },
  {
    id: "vidlink",
    name: "VidLink",
    supportsTv: true,
    movieUrl: (tmdbId, opts) =>
      qs(`https://vidlink.pro/movie/${tmdbId}`, {
        autoplay: opts?.autoplay,
        lang: opts?.language,
      }),
    tvUrl: (tmdbId, season, episode, opts) =>
      qs(`https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`, {
        autoplay: opts?.autoplay,
        lang: opts?.language,
      }),
  },
  {
    id: "2embedskin",
    name: "2Embed Skin",
    supportsTv: true,
    movieUrl: (tmdbId, opts) =>
      qs(`https://www.2embed.skin/embed/movie/${tmdbId}`, {
        autoplay: opts?.autoplay,
        lang: opts?.language,
      }),
    tvUrl: (tmdbId, season, episode, opts) =>
      qs(`https://www.2embed.skin/embed/tv/${tmdbId}/${season}/${episode}`, {
        autoplay: opts?.autoplay,
        lang: opts?.language,
      }),
  },
  {
    id: "moviesapi",
    name: "MoviesAPI",
    supportsTv: true,
    movieUrl: (tmdbId, opts) =>
      qs(`https://moviesapi.to/movie/${tmdbId}`, {
        autoplay: opts?.autoplay,
        lang: opts?.language,
      }),
    tvUrl: (tmdbId, season, episode, opts) =>
      qs(`https://moviesapi.to/tv/${tmdbId}/${season}/${episode}`, {
        autoplay: opts?.autoplay,
        lang: opts?.language,
      }),
  },
  {
    id: "smashystream",
    name: "SmashyStream",
    supportsTv: true,
    movieUrl: (tmdbId, opts) =>
      qs(`https://player.smashy.stream/movie/${tmdbId}`, {
        autoplay: opts?.autoplay,
      }),
    tvUrl: (tmdbId, season, episode, opts) =>
      qs(`https://player.smashy.stream/tv/${tmdbId}`, {
        s: season,
        e: episode,
        autoplay: opts?.autoplay,
      }),
  },
  {
    id: "vidphantom",
    name: "VidPhantom",
    supportsTv: true,
    movieUrl: (tmdbId, opts) =>
      qs(`https://vidphantom.com/movie/${tmdbId}`, {
        autoplay: opts?.autoplay,
      }),
    tvUrl: (tmdbId, season, episode, opts) =>
      qs(`https://vidphantom.com/tv/${tmdbId}/${season}/${episode}`, {
        autoplay: opts?.autoplay,
      }),
  },
  // SuperEmbed last — multiembed.mov often hijacks UI / false-positive "loaded"
  // and is never preferred for anime/hentai.
  {
    id: "superembed",
    name: "SuperEmbed",
    supportsTv: true,
    movieUrl: (tmdbId, opts) =>
      qs(`https://multiembed.mov/`, {
        video_id: tmdbId,
        tmdb: 1,
        autoplay: opts?.autoplay,
      }),
    tvUrl: (tmdbId, season, episode, opts) =>
      qs(`https://multiembed.mov/`, {
        video_id: tmdbId,
        tmdb: 1,
        s: season,
        e: episode,
        autoplay: opts?.autoplay,
      }),
  },
];

/** Providers excluded from anime / hentai chains (hijack UI or useless without real streams). */
const ANIME_BLOCKED_PROVIDER_IDS = new Set<EmbedProviderId>([
  "superembed",
  "smashystream",
  "vidphantom",
]);

/**
 * Anime-only streaming backends.
 * Prefer AniList/MAL metadata pairing over a single hard-coded host.
 *
 * Order prioritizes fast, currently-reachable hosts first:
 * Cinezo (AniList) → ScreenScape (TMDB) → AnimePahe (async) → DropFile → ezvidapi → SupaPlay
 */
export const ANIME_EMBED_PROVIDERS: EmbedProvider[] = [
  {
    id: "cinezo",
    name: "Cinezo",
    supportsTv: true,
    animeOnly: true,
    // Cinezo also supports TMDB movie/tv, but we only use it for anime
    movieUrl: (tmdbId) => `https://player.cinezo.live/embed/movie/${tmdbId}`,
    tvUrl: (tmdbId, season, episode) =>
      `https://player.cinezo.live/embed/tv/${tmdbId}/${season}/${episode}`,
    animeUrl: (ids) => {
      if (!ids.anilist) return null;
      const ep = Math.max(1, ids.episode ?? 1);
      const dub = preferDub(undefined, ids);
      return qs(
        `https://player.cinezo.live/embed/anime/${ids.anilist}/${ep}`,
        { dub: dub ? "true" : "false", autoplay: true, poster: true },
      );
    },
  },
  {
    id: "screenscape",
    name: "ScreenScape",
    supportsTv: true,
    animeOnly: true,
    // Official API: /embed?tmdb=&type=movie|tv&s=&e=
    movieUrl: (tmdbId) =>
      qs("https://flix.screenscape.me/embed", {
        tmdb: tmdbId,
        type: "movie",
      }),
    tvUrl: (tmdbId, season, episode) =>
      qs("https://flix.screenscape.me/embed", {
        tmdb: tmdbId,
        type: "tv",
        s: season,
        e: episode,
      }),
    animeUrl: (ids) => {
      // Anime as TV (or movie) on TMDB when available
      if (!ids.tmdb) return null;
      if (ids.tmdbMediaType === "movie" || ids.animeFormat === "MOVIE") {
        return qs("https://flix.screenscape.me/embed", {
          tmdb: ids.tmdb,
          type: "movie",
        });
      }
      const s = Math.max(1, ids.season ?? 1);
      const e = Math.max(1, ids.episode ?? 1);
      return qs("https://flix.screenscape.me/embed", {
        tmdb: ids.tmdb,
        type: "tv",
        s,
        e,
      });
    },
  },
  {
    id: "animepahe",
    name: "AnimePahe",
    supportsTv: true,
    animeOnly: true,
    needsResolve: true,
    movieUrl: () => "",
    tvUrl: () => "",
    // Resolved client-side via /api/v1/playback/anime-embed
    animeUrl: () => null,
  },
  {
    id: "dropfile",
    name: "DropFile",
    supportsTv: true,
    animeOnly: true,
    movieUrl: () => "",
    tvUrl: () => "",
    animeUrl: (ids) => {
      // Prefer MAL id (stable anime catalog key); fall back to AniList
      const id = ids.mal ?? ids.anilist;
      if (!id) return null;
      const ep = Math.max(1, ids.episode ?? 1);
      const dub = preferDub(undefined, ids);
      // DropFile public embed: /embed/{mal|anilist}/{episode}
      return qs(`https://dropfile.cc/embed/${id}/${ep}`, {
        type: ids.mal ? "mal" : "anilist",
        anilist: ids.anilist,
        mal: ids.mal,
        dub: dub ? "1" : "0",
        sub: dub ? "0" : "1",
      });
    },
  },
  {
    id: "ezvidapi",
    name: "ezvidapi",
    supportsTv: true,
    animeOnly: true,
    movieUrl: (tmdbId) => `https://ezvidapi.com/embed/movie/${tmdbId}`,
    tvUrl: (tmdbId, season, episode) =>
      `https://ezvidapi.com/embed/tv/${tmdbId}/${season}/${episode}`,
    animeUrl: (ids) => {
      // Multi-provider backend — TMDB paths; AniList when no TMDB
      if (ids.tmdb) {
        if (ids.tmdbMediaType === "movie" || ids.animeFormat === "MOVIE") {
          return `https://ezvidapi.com/embed/movie/${ids.tmdb}`;
        }
        const s = Math.max(1, ids.season ?? 1);
        const e = Math.max(1, ids.episode ?? 1);
        return `https://ezvidapi.com/embed/tv/${ids.tmdb}/${s}/${e}`;
      }
      if (ids.anilist) {
        const ep = Math.max(1, ids.episode ?? 1);
        return qs(`https://ezvidapi.com/embed/anime/${ids.anilist}/${ep}`, {
          dub: preferDub(undefined, ids) ? "true" : "false",
        });
      }
      return null;
    },
  },
  {
    id: "supaplay",
    name: "SupaPlay",
    supportsTv: true,
    animeOnly: true,
    // Classic /stream/s-2 needs HiAnime/Anikoto episode IDs (async resolve)
    needsResolve: true,
    movieUrl: () => "",
    tvUrl: () => "",
    animeUrl: () => null,
  },
];

/**
 * Asian-drama streaming backends (K-Drama / C-Drama / J-Drama / Thai Drama).
 * These hosts carry subtitled Asian dramas that general TMDB embeds often miss.
 *
 * Order: DramaPlay → KissKH → NontonGo → Frembed → general fallbacks
 */
export const DRAMA_EMBED_PROVIDERS: EmbedProvider[] = [
  {
    id: "dramaplay",
    name: "DramaPlay",
    supportsTv: true,
    dramaOnly: true,
    // https://www.dramaplay.one — TMDB movie/tv embeds with built-in subtitles.
    movieUrl: (tmdbId, opts) =>
      qs(`https://www.dramaplay.one/embed/movie/${tmdbId}`, {
        autoplay: opts?.autoplay,
        sub: opts?.language ?? "en",
      }),
    tvUrl: (tmdbId, season, episode, opts) =>
      qs(
        `https://www.dramaplay.one/embed/tv/${tmdbId}/${season}/${episode}`,
        {
          autoplay: opts?.autoplay,
          sub: opts?.language ?? "en",
        },
      ),
  },
  {
    id: "kisskh",
    name: "KissKH",
    supportsTv: true,
    dramaOnly: true,
    // https://kisskh.megaplay.su — KissKH episode embed keyed by TMDB id.
    movieUrl: (tmdbId, opts) =>
      qs(`https://kisskh.megaplay.su/embed/movie/${tmdbId}`, {
        autoplay: opts?.autoplay,
      }),
    tvUrl: (tmdbId, season, episode, opts) =>
      qs(
        `https://kisskh.megaplay.su/embed/tv/${tmdbId}/${season}/${episode}`,
        {
          autoplay: opts?.autoplay,
        },
      ),
  },
  {
    id: "nontongo",
    name: "NontonGo",
    supportsTv: true,
    dramaOnly: true,
    // https://www.nontongo.win — Indonesian-focused, strong K/C/J-drama coverage.
    movieUrl: (tmdbId, opts) =>
      qs(`https://www.nontongo.win/embed/movie/${tmdbId}`, {
        autoplay: opts?.autoplay,
      }),
    tvUrl: (tmdbId, season, episode, opts) =>
      qs(
        `https://www.nontongo.win/embed/tv/${tmdbId}/${season}/${episode}`,
        {
          autoplay: opts?.autoplay,
        },
      ),
  },
  {
    id: "frembed",
    name: "Frembed",
    supportsTv: true,
    dramaOnly: true,
    // https://frembed.asia — French-origin, multilingual subs, good Asian drama coverage.
    // TV uses "serie" (not "tv") + query params sa/epi.
    movieUrl: (tmdbId, opts) =>
      qs(`https://frembed.asia/embed/movie/${tmdbId}`, {
        autoplay: opts?.autoplay,
      }),
    tvUrl: (tmdbId, season, episode, opts) =>
      qs(`https://frembed.asia/embed/serie/${tmdbId}`, {
        sa: season,
        epi: episode,
        autoplay: opts?.autoplay,
      }),
  },
];

/** All providers (general + anime + drama) */
export const EMBED_PROVIDERS: EmbedProvider[] = [
  ...GENERAL_EMBED_PROVIDERS,
  ...ANIME_EMBED_PROVIDERS,
  ...DRAMA_EMBED_PROVIDERS,
];

export function getProvidersForMediaType(
  mediaType: "movie" | "tv",
): EmbedProvider[] {
  const list = GENERAL_EMBED_PROVIDERS;
  if (mediaType === "movie") return list;
  return list.filter((p) => p.supportsTv);
}

/** Asian-drama content types that use the dedicated drama backends. */
const DRAMA_CONTENT_TYPES = new Set([
  "kdrama",
  "cdrama",
  "jdrama",
  "thaidrama",
]);

export interface ProviderIdHints {
  tmdb?: number | null;
  anilist?: number | null;
  mal?: number | null;
  animeFormat?: string | null;
}

/**
 * Whether a provider can build a playable URL for the given ids right now.
 * Avoids auto-skipping into SuperEmbed and dead slots.
 */
export function providerCanPlay(
  provider: EmbedProvider,
  mediaType: "movie" | "tv",
  contentType: string,
  ids: ProviderIdHints,
  season = 1,
  episode = 1,
): boolean {
  if (contentType === "anime") {
    if (ANIME_BLOCKED_PROVIDER_IDS.has(provider.id)) return false;
    const url = buildAnimeEmbedUrl(provider.id, {
      title: "",
      anilist: ids.anilist ?? undefined,
      mal: ids.mal ?? undefined,
      tmdb: ids.tmdb ?? undefined,
      tmdbMediaType: mediaType,
      season,
      episode,
      animeFormat: ids.animeFormat ?? undefined,
    });
    // needsResolve providers are playable if we have title identity
    if (provider.needsResolve) {
      return Boolean(ids.anilist || ids.mal || ids.tmdb);
    }
    return Boolean(url);
  }

  if (!ids.tmdb || !Number.isFinite(ids.tmdb)) return false;
  if (mediaType === "movie") {
    return Boolean(provider.movieUrl(ids.tmdb));
  }
  return Boolean(provider.tvUrl(ids.tmdb, season, episode));
}

/**
 * Content-type aware provider chain.
 * Movies / series: VidFast → AutoEmbed → …
 * Anime / hentai: Cinezo / DropFile / … first (AniList), then AutoEmbed / VidFast if TMDB
 * Drama: AutoEmbed → VidFast → … then drama hosts
 */
export function getProvidersForContentType(
  contentType: string,
  mediaType: "movie" | "tv" = "tv",
  ids: ProviderIdHints = {},
  season = 1,
  episode = 1,
): EmbedProvider[] {
  const general = getProvidersForMediaType(mediaType);
  let chain: EmbedProvider[];

  if (contentType === "anime") {
    const generalSafe = general.filter(
      (p) => !ANIME_BLOCKED_PROVIDER_IDS.has(p.id),
    );
    // Hentai often only has AniList — native hosts first so we never land on SuperEmbed
    chain = [
      ...ANIME_EMBED_PROVIDERS,
      // TMDB generals only when useful (AutoEmbed / VidFast …)
      ...generalSafe,
    ];
  } else if (DRAMA_CONTENT_TYPES.has(contentType)) {
    chain = [...general, ...DRAMA_EMBED_PROVIDERS];
  } else {
    chain = general;
  }

  // Drop providers that cannot produce a URL for this title
  const playable = chain.filter((p) =>
    providerCanPlay(p, mediaType, contentType, ids, season, episode),
  );

  // Always return something if filter emptied (defensive)
  return playable.length > 0 ? playable : chain.slice(0, 6);
}

function suppressAdsOnUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("ads")) u.searchParams.set("ads", "0");
    if (!u.searchParams.has("ad")) u.searchParams.set("ad", "0");
    if (!u.searchParams.has("noads")) u.searchParams.set("noads", "1");
    return u.toString();
  } catch {
    return url;
  }
}

export function buildEmbedUrl(
  providerId: EmbedProviderId,
  tmdbId: number,
  mediaType: "movie" | "tv",
  season?: number,
  episode?: number,
  opts?: EmbedUrlOpts,
): string | null {
  const provider = EMBED_PROVIDERS.find((p) => p.id === providerId);
  if (!provider) return null;
  if (provider.animeOnly && !provider.movieUrl(tmdbId) && mediaType === "movie") {
    // anime-only providers without movieUrl still handled via buildAnimeEmbedUrl
  }

  if (mediaType === "movie") {
    return suppressAdsOnUrl(provider.movieUrl(tmdbId, opts) || null);
  }
  if (!season || !episode) return null;
  return suppressAdsOnUrl(provider.tvUrl(tmdbId, season, episode, opts) || null);
}

/** Build anime-native embed URL (preferred for contentType=anime) */
export function buildAnimeEmbedUrl(
  providerId: EmbedProviderId,
  ids: AnimeStreamIds,
  opts?: EmbedUrlOpts,
): string | null {
  const provider = EMBED_PROVIDERS.find((p) => p.id === providerId);
  if (!provider) return null;

  const merged: AnimeStreamIds = {
    ...ids,
    language: ids.language ?? opts?.language,
    dub: ids.dub ?? opts?.dub ?? preferDub(opts, ids),
  };

  if (provider.animeUrl) {
    const anime = provider.animeUrl(merged);
    if (anime) return suppressAdsOnUrl(anime);
  }

  // Fallback to TMDB paths when anime-native URL unavailable
  if (merged.tmdb) {
    if (
      merged.tmdbMediaType === "movie" ||
      merged.animeFormat === "MOVIE"
    ) {
      return suppressAdsOnUrl(provider.movieUrl(merged.tmdb, opts) || null);
    }
    const s = Math.max(1, merged.season ?? 1);
    const e = Math.max(1, merged.episode ?? 1);
    return suppressAdsOnUrl(provider.tvUrl(merged.tmdb, s, e, opts) || null);
  }

  return null;
}

export function getProviderName(id: EmbedProviderId): string {
  return EMBED_PROVIDERS.find((p) => p.id === id)?.name ?? id;
}

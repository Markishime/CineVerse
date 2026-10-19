import {
  LIVE_ACTION_EMBED_PROVIDERS,
  type LiveActionProviderId,
} from "./live-action-providers";
import { isFilipinoLocale } from "./language";

/**
 * Streaming embed providers for CineVerse.
 *
 * Architecture:
 * - Metadata: AniDB + AniList + MAL + TMDB (catalog layer)
 * - Playback: multi-provider fallback chain (not a single hard-coded host)
 *
 * Movies, series and anime share the TMDB-based general embeds. Anime also
 * keeps dedicated AniList/MAL-aware backends as fallbacks.
 */

export type EmbedProviderId =
  | LiveActionProviderId
  // General — movies / series
  | "vidfast"
  | "2embed"
  | "2embedskin"
  | "vidsrcpm"
  | "autoembed"
  // Anime-only backends
  | "megaplay"
  | "cinezo"
  | "animepahe"
  | "supaplay";

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
  /** Host postMessages PLAYER_EVENT/MEDIA_DATA once a real stream resolves, so silence means no content */
  signalsPlayback?: boolean;
  /** Small public asset; if it fails to load the host is blocking/unreachable for this viewer */
  probeUrl?: string;
}

/**
 * Build query string. Does NOT inject ads=* junk — several hosts (VidFast)
 * reject or mis-handle unknown flags and fail to load Filipino/regional titles.
 */
function qs(
  base: string,
  params: Record<string, string | undefined | boolean | number> = {},
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === false || v === "") continue;
    // Preserve "true"/"false" strings; booleans true → "true" for hosts like VidFast
    if (v === true) sp.set(k, "true");
    else sp.set(k, String(v));
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
 * General TMDB providers — verified endpoint formats (2026).
 *
 * Priority (most reliable first):
 * VidFast → 2Embed → 2Embed Skin → VidSrc PM (see GENERAL_PLAY_ORDER).
 *
 * Filipino movies use the same TMDB numeric id path as other titles.
 */
export const GENERAL_EMBED_PROVIDERS: EmbedProvider[] = [
  {
    id: "autoembed",
    name: "AutoEmbed",
    supportsTv: true,
    // Player URLs embedded by https://autoembed.co/movie/tmdb/{id} and
    // https://autoembed.co/tv/tmdb/{id}-{season}-{episode}.
    // Load the player directly so its playback/error messages reach our frame.
    signalsPlayback: true,
    movieUrl: (tmdbId) => `https://player.autoembed.co/embed/movie/${tmdbId}`,
    tvUrl: (tmdbId, season, episode) =>
      `https://player.autoembed.co/embed/tv/${tmdbId}/${season}-${episode}/`,
  },
  {
    id: "vidfast",
    name: "VidFast",
    supportsTv: true,
    // Docs: https://vidfast.vc/
    // Movie: https://vidfast.vc/movie/{id}?autoPlay=true
    // TV:    https://vidfast.vc/tv/{id}/{season}/{episode}?autoPlay=true
    movieUrl: (tmdbId, opts) =>
      qs(`https://vidfast.vc/movie/${tmdbId}`, {
        autoPlay: opts?.autoplay === false ? "false" : "true",
      }),
    tvUrl: (tmdbId, season, episode, opts) =>
      qs(`https://vidfast.vc/tv/${tmdbId}/${season}/${episode}`, {
        autoPlay: opts?.autoplay === false ? "false" : "true",
      }),
  },
  {
    id: "2embed",
    name: "2Embed",
    supportsTv: true,
    // Docs: https://www.2embed.online/
    // Movie: /embed/movie/{id}
    // TV:    /embed/tv/{id}/{season}/{episode}
    movieUrl: (tmdbId) => `https://www.2embed.online/embed/movie/${tmdbId}`,
    tvUrl: (tmdbId, season, episode) =>
      `https://www.2embed.online/embed/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: "2embedskin",
    name: "2Embed Skin",
    supportsTv: true,
    movieUrl: (tmdbId) => `https://www.2embed.skin/embed/movie/${tmdbId}`,
    tvUrl: (tmdbId, season, episode) =>
      `https://www.2embed.skin/embed/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: "vidsrcpm",
    name: "VidSrc PM",
    supportsTv: true,
    movieUrl: (tmdbId) => `https://vidsrc.pm/embed/movie/${tmdbId}`,
    tvUrl: (tmdbId, season, episode) =>
      `https://vidsrc.pm/embed/tv/${tmdbId}/${season}/${episode}`,
  },
];

/**
 * Anime-only streaming backends.
 * Prefer AniList/MAL metadata pairing over a single hard-coded host.
 *
 * Definition order is not the play order — getProvidersForContentType builds
 * the live chain: all general movie/TV hosts first, then instant anime hosts
 * (MegaPlay → Cinezo).
 */
export const ANIME_EMBED_PROVIDERS: EmbedProvider[] = [
  {
    id: "megaplay",
    name: "MegaPlay",
    supportsTv: true,
    animeOnly: true,
    // The backend kissanime.com.cv serves anime from. HiAnime/Zoro-sourced,
    // keyed directly by MAL or AniList id + absolute episode + sub|dub — no
    // async session resolve needed (unlike the s-2 HiAnime-episode-id path).
    // MAL:     https://megaplay.buzz/stream/mal/{malId}/{ep}/{sub|dub}
    // AniList: https://megaplay.buzz/stream/ani/{anilistId}/{ep}/{sub|dub}
    movieUrl: () => "",
    tvUrl: () => "",
    animeUrl: (ids) => {
      const ep = Math.max(1, ids.episode ?? 1);
      const lang = preferDub(undefined, ids) ? "dub" : "sub";
      if (ids.mal) {
        return `https://megaplay.buzz/stream/mal/${ids.mal}/${ep}/${lang}`;
      }
      if (ids.anilist) {
        return `https://megaplay.buzz/stream/ani/${ids.anilist}/${ep}/${lang}`;
      }
      return null;
    },
  },
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
      return qs(`https://player.cinezo.live/embed/anime/${ids.anilist}/${ep}`, {
        dub: dub ? "true" : "false",
        autoplay: true,
        poster: true,
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

/** All providers (general + anime + drama) */
export const EMBED_PROVIDERS: EmbedProvider[] = [
  ...GENERAL_EMBED_PROVIDERS,
  ...LIVE_ACTION_EMBED_PROVIDERS,
  ...ANIME_EMBED_PROVIDERS,
];

/**
 * Shared default order. Filipino live-action titles use their verified locale
 * priority in getProvidersForContentType; anime keeps this shared order.
 */
export const GENERAL_PLAY_ORDER: EmbedProviderId[] = [
  "vidfast",
  "2embed",
  "2embedskin",
  "vidsrcpm",
  "autoembed",
];

/** Anime uses the same default and general fallback order as other videos. */
export const ANIME_PLAY_ORDER: EmbedProviderId[] = [...GENERAL_PLAY_ORDER];

export function getProvidersForMediaType(
  mediaType: "movie" | "tv",
): EmbedProvider[] {
  const list = GENERAL_EMBED_PROVIDERS.filter(
    (p) => p.supportsTv || mediaType === "movie",
  );
  return preferProviders(list, GENERAL_PLAY_ORDER);
}

export interface ProviderIdHints {
  tmdb?: number | null;
  anilist?: number | null;
  mal?: number | null;
  animeFormat?: string | null;
  /** ISO countries e.g. PH — content locale hints */
  countries?: string[] | null;
  originalLanguage?: string | null;
}

/** Reorder a general list so preferred ids come first (stable). */
function preferProviders(
  list: EmbedProvider[],
  preferredIds: EmbedProviderId[],
): EmbedProvider[] {
  const preferred: EmbedProvider[] = [];
  const rest: EmbedProvider[] = [];
  const seen = new Set<EmbedProviderId>();
  for (const id of preferredIds) {
    const p = list.find((x) => x.id === id);
    if (p && !seen.has(p.id)) {
      preferred.push(p);
      seen.add(p.id);
    }
  }
  for (const p of list) {
    if (!seen.has(p.id)) rest.push(p);
  }
  return [...preferred, ...rest];
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
 * Content-type aware provider chain (user product rules):
 *
 * Verified general hosts lead when a TMDB id is available. Content-specific
 * anime hosts remain available as fallbacks.
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
    // Preserve the shared provider list for anime films and series,
    // with native hosts available after it.
    const liveNatives = ANIME_EMBED_PROVIDERS.filter((p) => !p.needsResolve);
    const instantNatives = preferProviders(liveNatives, ["megaplay", "cinezo"]);
    chain = [...preferProviders(general, ANIME_PLAY_ORDER), ...instantNatives];
  } else {
    // Extra movie/TV servers also cover Filipino titles and every drama type.
    // Keep the anime list above independent from these additions.
    // VidFast can serve an unembeddable 403 without firing iframe.onerror.
    // Start Filipino titles on the host verified with real Philippine films.
    const preferred: EmbedProviderId[] = isFilipinoLocale(ids)
      ? ["vidrock", "2embedcc", "vidsrcsh", "multiembed", ...GENERAL_PLAY_ORDER]
      : [
          "vidfast",
          "vidrock",
          "vidsrcsh",
          "multiembed",
          "2embedcc",
          ...GENERAL_PLAY_ORDER,
        ];
    chain = preferProviders(
      [...general, ...LIVE_ACTION_EMBED_PROVIDERS],
      preferred,
    );
  }

  // Drop providers that cannot produce a URL for this title
  const playable = chain.filter((p) =>
    providerCanPlay(p, mediaType, contentType, ids, season, episode),
  );

  // Always return something if filter emptied (defensive)
  return playable.length > 0 ? playable : chain.slice(0, 6);
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

  if (mediaType === "movie") {
    return provider.movieUrl(tmdbId, opts) || null;
  }
  if (!season || !episode) return null;
  return provider.tvUrl(tmdbId, season, episode, opts) || null;
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

  // Anime series MUST use TV path — only true AniList MOVIE format uses movie
  const forceMovie = merged.animeFormat === "MOVIE";

  if (provider.animeUrl) {
    const anime = provider.animeUrl({
      ...merged,
      tmdbMediaType: forceMovie ? "movie" : "tv",
    });
    if (anime) return anime;
  }

  // Fallback to TMDB paths when anime-native URL unavailable
  if (merged.tmdb) {
    if (forceMovie) {
      return provider.movieUrl(merged.tmdb, opts) || null;
    }
    const s = Math.max(1, merged.season ?? 1);
    const e = Math.max(1, merged.episode ?? 1);
    return provider.tvUrl(merged.tmdb, s, e, opts) || null;
  }

  return null;
}

export function getProviderName(id: EmbedProviderId): string {
  return EMBED_PROVIDERS.find((p) => p.id === id)?.name ?? id;
}

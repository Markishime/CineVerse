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
  | "vixsrc"
  | "2embed"
  | "2embedskin"
  | "moviesapi"
  | "smashystream"
  | "vidphantom"
  | "superembed"
  // Anime-only backends
  | "megaplay"
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
 * Only pass `lang` when the host is known to honor it. Tagalog/Filipino and
 * other unsupported codes must be omitted (not sent as tl) — hosts then serve
 * the default English/source track that actually works for PH cinema.
 */
function embedLangParam(language?: string): string | undefined {
  if (!language) return undefined;
  const l = language.toLowerCase().split("-")[0] ?? language;
  const supported = new Set([
    "en",
    "ko",
    "ja",
    "zh",
    "th",
    "es",
    "fr",
    "de",
    "pt",
    "hi",
    "it",
    "ru",
    "ar",
    "id",
    "ms",
    "tr",
    "vi",
  ]);
  if (!supported.has(l)) return undefined;
  return l;
}

/**
 * General TMDB providers — researched endpoint formats (2025–2026).
 *
 * Priority (most reliable first):
 * AutoEmbed (autoembed.co) → VidFast (vidfast.vc) → VidSrc → VixSrc → 2Embed → …
 *
 * Filipino movies: use TMDB numeric id + no Tagalog lang flag (see embedLangParam).
 */
export const GENERAL_EMBED_PROVIDERS: EmbedProvider[] = [
  {
    id: "autoembed",
    name: "AutoEmbed",
    supportsTv: true,
    // Live host: autoembed.co (verified reachable — returns HTTP 200). The
    // player.autoembed.cc AND player.autoembed.app hosts both time out / no
    // longer resolve ("IP address could not be found"). autoembed.co uses a
    // DASH-separated TV path, not slash segments:
    // Movie: https://autoembed.co/movie/tmdb/{tmdbId}
    // TV:    https://autoembed.co/tv/tmdb/{tmdbId}-{season}-{episode}
    // TMDB or IMDb ids accepted. No lang param.
    movieUrl: (tmdbId) => `https://autoembed.co/movie/tmdb/${tmdbId}`,
    tvUrl: (tmdbId, season, episode) =>
      `https://autoembed.co/tv/tmdb/${tmdbId}-${season}-${episode}`,
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
    id: "vidsrc",
    name: "VidSrc",
    supportsTv: true,
    // Docs: https://vidsrc.to/ — TMDB or IMDb (tt…)
    // Movie: /embed/movie/{id}
    // TV:    /embed/tv/{id}/{season}/{episode}
    movieUrl: (tmdbId) => `https://vidsrc.to/embed/movie/${tmdbId}`,
    tvUrl: (tmdbId, season, episode) =>
      `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: "vixsrc",
    name: "VixSrc",
    supportsTv: true,
    // https://vixsrc.to — clean TMDB embeds, good regional coverage
    movieUrl: (tmdbId) => `https://vixsrc.to/movie/${tmdbId}`,
    tvUrl: (tmdbId, season, episode) =>
      `https://vixsrc.to/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: "vidcore",
    name: "VidCore",
    supportsTv: true,
    movieUrl: (tmdbId, opts) =>
      qs(`https://vidcore.org/embed/movie/${tmdbId}/`, {
        lang: embedLangParam(opts?.language),
      }),
    tvUrl: (tmdbId, season, episode, opts) =>
      qs(`https://vidcore.org/embed/tv/${tmdbId}/${season}/${episode}/`, {
        lang: embedLangParam(opts?.language),
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
    id: "vidlink",
    name: "VidLink",
    supportsTv: true,
    movieUrl: (tmdbId, opts) =>
      qs(`https://vidlink.pro/movie/${tmdbId}`, {
        autoplay: opts?.autoplay === false ? "false" : "true",
      }),
    tvUrl: (tmdbId, season, episode, opts) =>
      qs(`https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`, {
        autoplay: opts?.autoplay === false ? "false" : "true",
      }),
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
    id: "moviesapi",
    name: "MoviesAPI",
    supportsTv: true,
    movieUrl: (tmdbId) => `https://moviesapi.to/movie/${tmdbId}`,
    tvUrl: (tmdbId, season, episode) =>
      `https://moviesapi.to/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: "smashystream",
    name: "SmashyStream",
    supportsTv: true,
    movieUrl: (tmdbId) => `https://player.smashy.stream/movie/${tmdbId}`,
    tvUrl: (tmdbId, season, episode) =>
      qs(`https://player.smashy.stream/tv/${tmdbId}`, {
        s: season,
        e: episode,
      }),
  },
  {
    id: "vidphantom",
    name: "VidPhantom",
    supportsTv: true,
    movieUrl: (tmdbId) => `https://vidphantom.com/movie/${tmdbId}`,
    tvUrl: (tmdbId, season, episode) =>
      `https://vidphantom.com/tv/${tmdbId}/${season}/${episode}`,
  },
  // SuperEmbed last — multiembed.mov often hijacks UI / false-positive "loaded"
  {
    id: "superembed",
    name: "SuperEmbed",
    supportsTv: true,
    movieUrl: (tmdbId) =>
      qs(`https://multiembed.mov/`, {
        video_id: tmdbId,
        tmdb: 1,
      }),
    tvUrl: (tmdbId, season, episode) =>
      qs(`https://multiembed.mov/`, {
        video_id: tmdbId,
        tmdb: 1,
        s: season,
        e: episode,
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
 * MegaPlay (the server kissanime.com.cv uses) → Cinezo (AniList) → ScreenScape
 * (TMDB) → AnimePahe (async) → DropFile → ezvidapi → SupaPlay
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
 * Reliability note: only NontonGo's TMDB path is doc-verified. KissKH needs its
 * own episode id (no TMDB path) and DramaPlay/Frembed formats are unverified, so
 * the routing puts the proven TMDB generals AHEAD of these — see
 * getProvidersForContentType. These are best-effort supplements, not primaries.
 */
export const DRAMA_EMBED_PROVIDERS: EmbedProvider[] = [
  {
    id: "dramaplay",
    name: "DramaPlay",
    supportsTv: true,
    dramaOnly: true,
    // https://dramaplay.one — TMDB movie/tv embeds with built-in subtitles.
    // Keep the path id-only: an unsupported ?sub=<lang> (e.g. sub=tl) made it
    // fail. Best-effort supplement, not a primary — demoted below the proven
    // TMDB generals in the chains.
    movieUrl: (tmdbId) => `https://dramaplay.one/embed/movie/${tmdbId}`,
    tvUrl: (tmdbId, season, episode) =>
      `https://dramaplay.one/embed/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: "kisskh",
    name: "KissKH",
    supportsTv: true,
    dramaOnly: true,
    // https://kisskh.megaplay.su — the player kissasian.cam serves dramas from.
    // IMPORTANT: this embed is keyed by KissKH's OWN internal episode id
    // (e.g. /kisskh/129692), NOT a TMDB id. The old /embed/movie/{tmdb} and
    // /embed/tv/{tmdb}/… paths do not exist and 404 ("Route ... not found").
    // Building the real URL needs a KissKH catalog search (title → drama id →
    // episode id) which is not implemented yet, so we emit no URL here — the
    // provider is filtered out of chains until a resolver exists. Do NOT
    // resurrect the fake TMDB paths.
    movieUrl: () => "",
    tvUrl: () => "",
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
  /** ISO countries e.g. PH — used for Filipino-first host order */
  countries?: string[] | null;
  originalLanguage?: string | null;
}

function isFilipinoContent(ids: ProviderIdHints): boolean {
  const lang = (ids.originalLanguage ?? "").toLowerCase();
  if (lang === "tl" || lang === "fil" || lang === "tgl") return true;
  return (ids.countries ?? []).some((c) => c.toUpperCase() === "PH");
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
 * Content-type aware provider chain (user product rules):
 *
 * - Movies (non-PH): AutoEmbed → VidFast → VidSrc → VixSrc → …
 * - Filipino movies: VixSrc → VidSrc → VidFast → 2Embed → AutoEmbed (fast PH loads)
 * - K-Drama: NontonGo first → DramaPlay → KissKH → Frembed → AutoEmbed → …
 * - Anime: AutoEmbed first (correct TV tmdb) → VidFast → VidSrc → anime-native
 * - Other dramas: NontonGo-first drama pack + generals
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
    // MegaPlay first (the server kissanime.com.cv uses) — direct MAL/AniList
    // embeds, English sub & dub. Then remaining anime natives, then TMDB
    // generals as a last resort for titles MegaPlay can't key.
    const animeNatives = preferProviders(ANIME_EMBED_PROVIDERS, ["megaplay"]);
    chain = animeNatives.concat(
      preferProviders(generalSafe, [
        "autoembed",
        "vidfast",
        "vidsrc",
        "vixsrc",
        "2embed",
      ]),
    );
  } else if (
    contentType === "kdrama" ||
    DRAMA_CONTENT_TYPES.has(contentType) ||
    contentType === "cdrama" ||
    contentType === "jdrama" ||
    contentType === "thaidrama"
  ) {
    // Proven TMDB generals lead (they actually resolve) with the drama-specific
    // hosts as best-effort supplements after. KissKH is intentionally NOT
    // ordered here — it emits no TMDB URL (needs its own episode id) and is
    // filtered out; DramaPlay/NontonGo/Frembed formats are unreliable, so they
    // must never sit ahead of the working generals.
    chain = [
      ...preferProviders(general, [
        "autoembed",
        "vidfast",
        "vidsrc",
        "vixsrc",
        "2embed",
      ]),
      ...preferProviders(DRAMA_EMBED_PROVIDERS, ["nontongo", "dramaplay"]),
    ];
  } else if (isFilipinoContent(ids)) {
    // Filipino cinema: no PH-specialist embed host exists, so lead with the
    // broadest currently-live TMDB aggregators (best odds a PH title resolves
    // somewhere) — VidFast/VidSrc/VidCore — then VixSrc/AutoEmbed, then drama
    // hosts as best-effort. (kissasian.cam's KissKH backend can't be driven by
    // a TMDB id, so it can't lead here — see the kisskh provider.)
    chain = [
      ...preferProviders(general, [
        "vidfast",
        "vidsrc",
        "vidcore",
        "vixsrc",
        "autoembed",
        "2embed",
        "vidlink",
      ]),
      ...preferProviders(DRAMA_EMBED_PROVIDERS, ["nontongo", "dramaplay"]),
    ];
  } else {
    // Default movies + western series: AutoEmbed first
    chain = preferProviders(general, [
      "autoembed",
      "vidfast",
      "vidsrc",
      "vixsrc",
      "2embed",
    ]);
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

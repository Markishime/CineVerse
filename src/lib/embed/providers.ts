/**
 * Third-party embed video providers for CineVerse streaming.
 *
 * Each provider maps TMDb IDs to embeddable iframe URLs.
 * Default order: autoembed (best anime support) → vidsrc.to → vidcore → multiembed → others.
 *
 * Subtitle support is handled via the provider's built-in subtitle selector
 * inside the player iframe. No iframe reload needed for subtitle changes.
 */

export type EmbedProviderId =
  | "autoembed"
  | "vidsrc.to"
  | "vidsrc.mov"
  | "vidcore"
  | "multiembed"
  | "2embed"
  | "vidapi";

export interface EmbedProvider {
  id: EmbedProviderId;
  name: string;
  /** Whether this provider supports TV episodes */
  supportsTv: boolean;
  /** Build the embed URL for a movie */
  movieUrl: (tmdbId: number, opts?: EmbedUrlOpts) => string;
  /** Build the embed URL for a TV episode */
  tvUrl: (tmdbId: number, season: number, episode: number, opts?: EmbedUrlOpts) => string;
}

export interface EmbedUrlOpts {
  /** Auto-start playback */
  autoplay?: boolean;
  /** ISO 639-1 language code (e.g. "en", "ko", "ja") — used to set the default audio track */
  language?: string;
}

/** Default provider order — autoembed first (best anime), then vidsrc.to, vidcore, multiembed, others */
export const EMBED_PROVIDERS: EmbedProvider[] = [
  {
    id: "autoembed",
    name: "AutoEmbed",
    supportsTv: true,
    movieUrl: (tmdbId, opts) => {
      const base = `https://autoembed.co/movie/tmdb/${tmdbId}`;
      const params = new URLSearchParams();
      if (opts?.autoplay) params.set("autoplay", "1");
      if (opts?.language) params.set("lang", opts.language);
      const qs = params.toString();
      return qs ? `${base}?${qs}` : base;
    },
    tvUrl: (tmdbId, season, episode, opts) => {
      const base = `https://autoembed.co/tv/tmdb/${tmdbId}-${season}-${episode}`;
      const params = new URLSearchParams();
      if (opts?.autoplay) params.set("autoplay", "1");
      if (opts?.language) params.set("lang", opts.language);
      const qs = params.toString();
      return qs ? `${base}?${qs}` : base;
    },
  },
  {
    id: "vidsrc.to",
    name: "VidSrc",
    supportsTv: true,
    movieUrl: (tmdbId, opts) => {
      const base = `https://vidsrc.to/embed/movie/${tmdbId}`;
      const params = new URLSearchParams();
      if (opts?.autoplay) params.set("autoplay", "1");
      if (opts?.language) params.set("lang", opts.language);
      const qs = params.toString();
      return qs ? `${base}?${qs}` : base;
    },
    tvUrl: (tmdbId, season, episode, opts) => {
      const base = `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`;
      const params = new URLSearchParams();
      if (opts?.autoplay) params.set("autoplay", "1");
      if (opts?.language) params.set("lang", opts.language);
      const qs = params.toString();
      return qs ? `${base}?${qs}` : base;
    },
  },
  {
    id: "vidsrc.mov",
    name: "VidSrc Mirror",
    supportsTv: true,
    movieUrl: (tmdbId, opts) => {
      const base = `https://vidsrc.mov/embed/movie/${tmdbId}`;
      const params = new URLSearchParams();
      if (opts?.autoplay) params.set("autoplay", "1");
      if (opts?.language) params.set("lang", opts.language);
      const qs = params.toString();
      return qs ? `${base}?${qs}` : base;
    },
    tvUrl: (tmdbId, season, episode, opts) => {
      const base = `https://vidsrc.mov/embed/tv/${tmdbId}/${season}/${episode}`;
      const params = new URLSearchParams();
      if (opts?.autoplay) params.set("autoplay", "1");
      if (opts?.language) params.set("lang", opts.language);
      const qs = params.toString();
      return qs ? `${base}?${qs}` : base;
    },
  },
  {
    id: "vidcore",
    name: "VidCore",
    supportsTv: true,
    movieUrl: (tmdbId, opts) => {
      const base = `https://vidcore.org/embed/movie/${tmdbId}`;
      const params = new URLSearchParams();
      if (opts?.autoplay) params.set("autoplay", "1");
      if (opts?.language) params.set("lang", opts.language);
      const qs = params.toString();
      return qs ? `${base}?${qs}` : base;
    },
    tvUrl: (tmdbId, season, episode, opts) => {
      const base = `https://vidcore.org/embed/tv/${tmdbId}/${season}/${episode}`;
      const params = new URLSearchParams();
      if (opts?.autoplay) params.set("autoplay", "1");
      if (opts?.language) params.set("lang", opts.language);
      const qs = params.toString();
      return qs ? `${base}?${qs}` : base;
    },
  },
  {
    id: "multiembed",
    name: "MultiEmbed",
    supportsTv: true,
    movieUrl: (tmdbId, opts) => {
      const base = `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`;
      const params = new URLSearchParams();
      if (opts?.autoplay) params.set("autoplay", "1");
      if (opts?.language) params.set("lang", opts.language);
      const qs = params.toString();
      return qs ? `${base}&${qs}` : base;
    },
    tvUrl: (tmdbId, season, episode, opts) => {
      const base = `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}`;
      const params = new URLSearchParams();
      if (opts?.autoplay) params.set("autoplay", "1");
      if (opts?.language) params.set("lang", opts.language);
      const qs = params.toString();
      return qs ? `${base}&${qs}` : base;
    },
  },
  {
    id: "2embed",
    name: "2Embed",
    supportsTv: true,
    movieUrl: (tmdbId, opts) => {
      const base = `https://www.2embed.online/embed/movie/${tmdbId}`;
      const params = new URLSearchParams();
      if (opts?.autoplay) params.set("autoplay", "1");
      if (opts?.language) params.set("lang", opts.language);
      const qs = params.toString();
      return qs ? `${base}?${qs}` : base;
    },
    tvUrl: (tmdbId, season, episode, opts) => {
      const base = `https://www.2embed.online/embed/tv/${tmdbId}/${season}/${episode}`;
      const params = new URLSearchParams();
      if (opts?.autoplay) params.set("autoplay", "1");
      if (opts?.language) params.set("lang", opts.language);
      const qs = params.toString();
      return qs ? `${base}?${qs}` : base;
    },
  },
  {
    id: "vidapi",
    name: "VidAPI",
    supportsTv: true,
    movieUrl: (tmdbId, opts) => {
      const base = `https://vidapi.qzz.io/movie/${tmdbId}`;
      const params = new URLSearchParams();
      if (opts?.autoplay) params.set("autoplay", "1");
      if (opts?.language) params.set("lang", opts.language);
      const qs = params.toString();
      return qs ? `${base}?${qs}` : base;
    },
    tvUrl: (tmdbId, season, episode, opts) => {
      const base = `https://vidapi.qzz.io/tv/${tmdbId}/${season}/${episode}`;
      const params = new URLSearchParams();
      if (opts?.autoplay) params.set("autoplay", "1");
      if (opts?.language) params.set("lang", opts.language);
      const qs = params.toString();
      return qs ? `${base}?${qs}` : base;
    },
  },
];

/**
 * Get all providers that support the given media type,
 * ordered by default preference (autoembed first).
 */
export function getProvidersForMediaType(
  mediaType: "movie" | "tv",
): EmbedProvider[] {
  if (mediaType === "movie") {
    return EMBED_PROVIDERS;
  }
  return EMBED_PROVIDERS.filter((p) => p.supportsTv);
}

/**
 * Get providers ordered by content type.
 * For anime: autoembed → vidsrc.to → vidcore → multiembed → others.
 * For series/kdrama: vidsrc.to → autoembed → vidcore → others.
 * For movies: default order.
 */
export function getProvidersForContentType(
  contentType: string,
  mediaType: "movie" | "tv" = "tv",
): EmbedProvider[] {
  const all = mediaType === "movie"
    ? EMBED_PROVIDERS
    : EMBED_PROVIDERS.filter((p) => p.supportsTv);

  if (contentType === "anime") {
    // Anime-optimized: autoembed first, then vidsrc, vidcore, multiembed
    const animeOrder: EmbedProviderId[] = [
      "autoembed", "vidsrc.to", "vidsrc.mov", "vidcore",
      "multiembed", "2embed", "vidapi",
    ];
    return animeOrder
      .map((id) => all.find((p) => p.id === id))
      .filter(Boolean) as EmbedProvider[];
  }

  if (contentType === "kdrama") {
    // K-drama: vidsrc first (best Korean audio), then autoembed
    const kdramaOrder: EmbedProviderId[] = [
      "vidsrc.to", "vidsrc.mov", "autoembed", "vidcore",
      "multiembed", "2embed", "vidapi",
    ];
    return kdramaOrder
      .map((id) => all.find((p) => p.id === id))
      .filter(Boolean) as EmbedProvider[];
  }

  // Default: autoembed first (reliable for all types)
  return all;
}

/**
 * Build the embed URL for a specific provider + media type.
 */
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
    return provider.movieUrl(tmdbId, opts);
  }

  if (!season || !episode) return null;
  return provider.tvUrl(tmdbId, season, episode, opts);
}

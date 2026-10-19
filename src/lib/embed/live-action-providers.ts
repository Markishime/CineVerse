import type { EmbedProvider } from "./providers";

export type LiveActionProviderId =
  "vidrock" | "vidsrcsh" | "multiembed" | "2embedcc";

/** Additional movie/TV fallbacks. Keep these out of anime provider chains. */
export const LIVE_ACTION_EMBED_PROVIDERS: EmbedProvider[] = [
  {
    id: "2embedcc",
    name: "2Embed CC",
    supportsTv: true,
    // https://www.2embed.cc/#api — differs from the .online/.skin endpoints.
    // The documented TV route uses &s= and &e= in the path, without a '?'.
    movieUrl: (id) => `https://www.2embed.cc/embed/${id}`,
    tvUrl: (id, season, episode) =>
      `https://www.2embed.cc/embedtv/${id}&s=${season}&e=${episode}`,
  },
  {
    id: "vidrock",
    name: "VidRock",
    supportsTv: true,
    // https://vidrock.net/ — TMDB movie and episode embed documentation.
    movieUrl: (id) => `https://vidrock.net/movie/${id}`,
    tvUrl: (id, season, episode) =>
      `https://vidrock.net/tv/${id}/${season}/${episode}`,
  },
  {
    id: "vidsrcsh",
    name: "VidSrc SH",
    supportsTv: true,
    // https://vidsrc.sh/vidsrc/docs/ — numeric TMDB IDs are supported.
    movieUrl: (id) => `https://vidsrc.sh/embed/movie/${id}`,
    tvUrl: (id, season, episode) =>
      `https://vidsrc.sh/embed/tv/${id}/${season}/${episode}`,
  },
  {
    id: "multiembed",
    name: "MultiEmbed",
    supportsTv: true,
    // https://www.superembed.stream/ — the simple iframe integration.
    // tmdb=1 is required: without it numeric IDs are treated as IMDb IDs.
    movieUrl: (id) => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    tvUrl: (id, season, episode) =>
      `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${episode}`,
  },
];

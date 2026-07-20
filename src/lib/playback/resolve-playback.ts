/**
 * Server-only legal playback resolver.
 * Returns an in-app player payload only for verified sources.
 * Never treats TMDB as a stream; never invents URLs from metadata.
 * Each episode must resolve to its own approved source — never a shared generic URL.
 */
import type {
  ContentKind,
  PlaybackSourceDocument,
  ResolvedPlayback,
} from "@/types/playback";
import {
  isSourceCurrentlyValid,
  listSources,
  regionAllowed,
} from "@/lib/playback/playback-store";
import { buildStreamPlayback } from "@/lib/playback/cloudflare-stream";

export type ResolveOpts = {
  titleId: string;
  episodeId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  region?: string;
  /** Prefer full feature when available */
  preferFull?: boolean;
  contentIdAliases?: string[];
};

function scoreSource(s: PlaybackSourceDocument, preferFull: boolean): number {
  let score = 0;
  if (s.contentKind === "full_movie" || s.contentKind === "full_episode") {
    score += preferFull ? 100 : 50;
  }
  if (s.contentKind === "trailer") score += preferFull ? 5 : 40;
  if (s.sourceType === "cineverse_hosted") score += 12;
  if (s.sourceType === "cloudflare_stream") score += 11;
  if (s.sourceType === "youtube_embed") score += 10;
  if (s.sourceType === "public_domain") score += 9;
  if (s.sourceType === "vimeo_embed") score += 9;
  if (s.sourceType === "creative_commons") score += 7;
  return score;
}

function toEmbedMode(
  source: PlaybackSourceDocument,
): ResolvedPlayback["mode"] {
  if (source.sourceType === "youtube_embed" && source.youtubeVideoId) {
    return "youtube_iframe";
  }
  if (source.sourceType === "vimeo_embed" && source.vimeoVideoId) {
    return "vimeo_embed";
  }
  if (
    source.sourceType === "cloudflare_stream" ||
    source.cloudflareVideoUid ||
    source.playbackAssetId?.startsWith("cloudflare:")
  ) {
    return "cloudflare_iframe";
  }
  if (
    source.playbackAssetId?.startsWith("archive:") ||
    source.manifestPath?.includes("archive.org")
  ) {
    return "archive_embed";
  }
  if (
    source.manifestPath?.endsWith(".m3u8") ||
    source.playbackAssetId?.includes(".m3u8")
  ) {
    return "cineverse_hls";
  }
  if (source.playbackAssetId || source.manifestPath) return "cineverse_mp4";
  return "none";
}

/**
 * Build a playable URL only for approved asset patterns.
 * - archive:{identifier} → Internet Archive embed
 * - cloudflare:{uid} → signed session URL (when env configured)
 * - https trusted hosts for hosted HLS/MP4
 * - Never accepts arbitrary third-party URLs from untrusted input
 */
export function resolveAssetUrl(
  source: PlaybackSourceDocument,
): string | undefined {
  if (!source.embeddingAllowed) return undefined;

  if (source.sourceType === "youtube_embed" && source.youtubeVideoId) {
    return undefined;
  }
  if (source.sourceType === "vimeo_embed" && source.vimeoVideoId) {
    return undefined;
  }

  const asset = source.playbackAssetId ?? source.manifestPath;
  if (!asset) return undefined;

  if (asset.startsWith("archive:")) {
    const id = asset.slice("archive:".length).replace(/[^a-zA-Z0-9._-]/g, "");
    if (!id) return undefined;
    return `https://archive.org/embed/${id}`;
  }

  // Cloudflare Stream — iframe/HLS built in resolvePlayback via buildStreamPlayback
  if (
    source.sourceType === "cloudflare_stream" ||
    asset.startsWith("cloudflare:") ||
    source.cloudflareVideoUid
  ) {
    return undefined;
  }

  if (asset.startsWith("https://") && isTrustedHost(asset)) {
    return asset;
  }

  if (source.manifestPath && isTrustedHost(source.manifestPath)) {
    return source.manifestPath;
  }

  if (asset.startsWith("gs://") || asset.startsWith("playback/")) {
    const base = process.env.PLAYBACK_CDN_BASE_URL;
    if (base) {
      const path = asset
        .replace(/^gs:\/\/[^/]+\//, "")
        .replace(/^playback\//, "playback/");
      return `${base.replace(/\/$/, "")}/${path}`;
    }
  }

  return undefined;
}

function isTrustedHost(url: string): boolean {
  try {
    const u = new URL(url);
    const allowed = [
      "archive.org",
      "ia601000.us.archive.org",
      "ia801000.us.archive.org",
      "storage.googleapis.com",
      "firebasestorage.googleapis.com",
      "cloudflarestream.com",
      "videodelivery.net",
    ];
    const extra = (process.env.PLAYBACK_TRUSTED_HOSTS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const hosts = [...allowed, ...extra];
    return hosts.some(
      (h) => u.hostname === h || u.hostname.endsWith(`.${h}`),
    );
  } catch {
    return false;
  }
}

function matchesEpisode(
  s: PlaybackSourceDocument,
  opts: ResolveOpts,
): boolean {
  // Prefer exact episodeId match
  if (opts.episodeId && s.episodeId === opts.episodeId) {
    return true;
  }
  // Also match season + episode numbers (catalog ids may differ from seed ids)
  if (
    opts.seasonNumber != null &&
    opts.episodeNumber != null &&
    s.seasonNumber != null &&
    s.episodeNumber != null
  ) {
    return (
      s.seasonNumber === opts.seasonNumber &&
      s.episodeNumber === opts.episodeNumber
    );
  }
  // Episode id suffix match: *_s1_e2
  if (opts.episodeId && s.episodeId) {
    const tail = opts.episodeId.match(/_s(\d+)_e(\d+)$/);
    const stail = s.episodeId.match(/_s(\d+)_e(\d+)$/);
    if (tail && stail && tail[1] === stail[1] && tail[2] === stail[2]) {
      return true;
    }
  }
  if (opts.episodeId && !s.episodeId) return false;
  // Movie-level: no episode binding
  return !s.episodeId && s.seasonNumber == null && s.episodeNumber == null;
}

export function resolvePlayback(opts: ResolveOpts): ResolvedPlayback {
  const region = (opts.region ?? "US").toUpperCase();
  const preferFull = opts.preferFull !== false;
  const candidateIds = [
    opts.titleId,
    ...(opts.contentIdAliases ?? []),
  ].filter(Boolean);

  const wantsEpisode =
    Boolean(opts.episodeId) ||
    (opts.seasonNumber != null && opts.episodeNumber != null);

  const candidates: PlaybackSourceDocument[] = [];
  for (const id of candidateIds) {
    const approved = listSources({ titleId: id, status: "approved" });
    if (wantsEpisode) {
      candidates.push(
        ...approved.filter((s) => matchesEpisode(s, opts)),
      );
    } else {
      // Title-level: movie full or title-level sources only (not random episode)
      candidates.push(
        ...approved.filter(
          (s) =>
            !s.episodeId &&
            s.seasonNumber == null &&
            s.episodeNumber == null,
        ),
      );
    }
  }

  const byId = new Map(candidates.map((c) => [c.id, c]));
  const valid = Array.from(byId.values())
    .filter(isSourceCurrentlyValid)
    .filter((s) => regionAllowed(s, region))
    .filter((s) => s.embeddingAllowed)
    .sort(
      (a, b) => scoreSource(b, preferFull) - scoreSource(a, preferFull),
    );

  const full = valid.find(
    (s) =>
      s.contentKind === "full_movie" || s.contentKind === "full_episode",
  );
  const chosen =
    preferFull && full
      ? full
      : valid.find((s) => s.contentKind === "trailer") ?? valid[0];

  if (!chosen) {
    return {
      playable: false,
      mode: "none",
      region,
      externalProvidersOnly: true,
      watchLabel: "Not Available on CineVerse",
      episodeId: opts.episodeId,
      seasonNumber: opts.seasonNumber,
      episodeNumber: opts.episodeNumber,
      reason: wantsEpisode
        ? "This episode isn’t available for full playback yet. Try the trailer or a free legal service."
        : "Full playback isn’t available for this title yet. Try the trailer or Watch free on Tubi.",
    };
  }

  const isFull =
    chosen.contentKind === "full_movie" ||
    chosen.contentKind === "full_episode";

  if (preferFull && !isFull) {
    return {
      playable: false,
      mode: "none",
      contentKind: chosen.contentKind,
      region,
      externalProvidersOnly: true,
      watchLabel: "Watch Trailer",
      reason: "Only the trailer is available for this title right now.",
    };
  }

  const mode = toEmbedMode(chosen);
  const signedUrl = resolveAssetUrl(chosen);
  const expiresAt =
    mode === "cineverse_hls" || mode === "cineverse_mp4"
      ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
      : undefined;

  if (mode === "youtube_iframe" && chosen.youtubeVideoId) {
    return {
      playable: true,
      contentKind: chosen.contentKind as ContentKind,
      sourceType: chosen.sourceType,
      mode: "youtube_iframe",
      youtubeVideoId: chosen.youtubeVideoId.trim(),
      attributionText: chosen.attributionText,
      attributionSource: chosen.attributionSource,
      licenseType: chosen.licenseType,
      rightsHolder: chosen.rightsHolder,
      providerName: chosen.providerName,
      region,
      externalProvidersOnly: false,
      watchLabel: "Watch Now",
      episodeId: chosen.episodeId,
      seasonNumber: chosen.seasonNumber,
      episodeNumber: chosen.episodeNumber,
    };
  }

  if (mode === "vimeo_embed" && chosen.vimeoVideoId) {
    return {
      playable: true,
      contentKind: chosen.contentKind as ContentKind,
      sourceType: chosen.sourceType,
      mode: "vimeo_embed",
      vimeoVideoId: chosen.vimeoVideoId.trim(),
      attributionText: chosen.attributionText,
      rightsHolder: chosen.rightsHolder,
      providerName: chosen.providerName,
      region,
      externalProvidersOnly: false,
      watchLabel: "Watch Now",
      episodeId: chosen.episodeId,
      seasonNumber: chosen.seasonNumber,
      episodeNumber: chosen.episodeNumber,
    };
  }

  // Cloudflare Stream — owned/licensed full movie or episode
  if (mode === "cloudflare_iframe") {
    const uid = (
      chosen.cloudflareVideoUid ??
      chosen.playbackAssetId?.replace(/^cloudflare:/, "") ??
      ""
    ).trim();
    if (uid) {
      const stream = buildStreamPlayback(uid);
      if (stream?.iframeUrl || stream?.manifestUrl) {
        return {
          playable: true,
          contentKind: chosen.contentKind as ContentKind,
          sourceType: "cloudflare_stream",
          mode: stream.mode === "cineverse_hls" ? "cineverse_hls" : "cloudflare_iframe",
          cloudflareVideoUid: stream.videoUid,
          cloudflareCustomerCode: stream.customerCode,
          cloudflareToken: stream.signedToken,
          signedUrl: stream.manifestUrl ?? stream.iframeUrl,
          expiresAt: stream.expiresAt,
          attributionText: chosen.attributionText,
          rightsHolder: chosen.rightsHolder,
          providerName: chosen.providerName ?? "Cloudflare Stream",
          region,
          externalProvidersOnly: false,
          watchLabel: "Watch Now",
          episodeId: chosen.episodeId,
          seasonNumber: chosen.seasonNumber,
          episodeNumber: chosen.episodeNumber,
        };
      }
      return {
        playable: false,
        mode: "none",
        region,
        externalProvidersOnly: true,
        watchLabel: "Not Available on CineVerse",
        reason:
          "Cloudflare Stream video is mapped but player is not configured. Set NEXT_PUBLIC_CLOUDFLARE_STREAM_CUSTOMER_CODE (and signing keys if required).",
      };
    }
  }

  if (
    (mode === "cineverse_mp4" ||
      mode === "cineverse_hls" ||
      mode === "archive_embed") &&
    signedUrl
  ) {
    return {
      playable: true,
      contentKind: chosen.contentKind as ContentKind,
      sourceType: chosen.sourceType,
      mode: mode === "archive_embed" ? "cineverse_mp4" : mode,
      signedUrl,
      expiresAt,
      attributionText: chosen.attributionText,
      attributionSource: chosen.attributionSource,
      licenseType: chosen.licenseType,
      rightsHolder: chosen.rightsHolder,
      providerName: chosen.providerName,
      region,
      externalProvidersOnly: false,
      watchLabel: "Watch Now",
      episodeId: chosen.episodeId,
      seasonNumber: chosen.seasonNumber,
      episodeNumber: chosen.episodeNumber,
    };
  }

  return {
    playable: false,
    mode: "none",
    region,
    externalProvidersOnly: true,
    watchLabel: "Not Available on CineVerse",
    reason:
      "A rights record exists but the embed asset is not available for in-app playback (check Stream/CDN config).",
  };
}

/** Trailers: only approved youtube_embed trailer sources (not clips/featurettes). */
export function resolveLegalTrailer(opts: {
  titleId: string;
  aliases?: string[];
  region?: string;
}): ResolvedPlayback | null {
  const region = (opts.region ?? "US").toUpperCase();
  const ids = [opts.titleId, ...(opts.aliases ?? [])];
  for (const id of ids) {
    // Prefer official trailers; never use clip as the primary trailer
    const trailers = listSources({ titleId: id, status: "approved" })
      .filter((s) => s.contentKind === "trailer")
      .filter(isSourceCurrentlyValid)
      .filter((s) => regionAllowed(s, region))
      .filter((s) => s.sourceType === "youtube_embed" && s.youtubeVideoId);
    const t = trailers[0];
    if (t?.youtubeVideoId) {
      return {
        playable: true,
        contentKind: t.contentKind,
        sourceType: t.sourceType,
        mode: "youtube_iframe",
        youtubeVideoId: t.youtubeVideoId.trim(),
        rightsHolder: t.rightsHolder,
        providerName: t.providerName,
        region,
        externalProvidersOnly: false,
        watchLabel: "Watch Trailer",
      };
    }
  }
  return null;
}

/** Whether a specific episode has an approved full source */
export function isEpisodePlayable(
  titleId: string,
  opts: {
    episodeId?: string;
    seasonNumber?: number;
    episodeNumber?: number;
    region?: string;
    aliases?: string[];
  },
): boolean {
  const r = resolvePlayback({
    titleId,
    episodeId: opts.episodeId,
    seasonNumber: opts.seasonNumber,
    episodeNumber: opts.episodeNumber,
    region: opts.region,
    contentIdAliases: opts.aliases,
    preferFull: true,
  });
  return r.playable && r.contentKind === "full_episode";
}

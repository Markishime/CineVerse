/**
 * Legal streaming source-of-truth types.
 * TMDB is metadata only — never a streaming source.
 *
 * Playback providers:
 * - youtube_embed: official rights-holder YouTube full/trailer (IFrame only)
 * - public_domain / creative_commons: reviewed free assets (e.g. Archive.org)
 * - cineverse_hosted: owned/licensed HLS/MP4 (signed short-lived URLs)
 * - cloudflare_stream: licensed Stream UIDs → signed session URLs
 * - vimeo_embed: licensed Vimeo embeds
 * - licensed_partner: disabled until contracts + env flag
 */
import { z } from "zod";

export const SourceTypeSchema = z.enum([
  "youtube_embed",
  "cineverse_hosted",
  "public_domain",
  "creative_commons",
  "cloudflare_stream",
  "vimeo_embed",
  "licensed_partner",
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const ContentKindSchema = z.enum([
  "full_movie",
  "full_episode",
  "trailer",
  "clip",
]);
export type ContentKind = z.infer<typeof ContentKindSchema>;

export const PlaybackStatusSchema = z.enum([
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "expired",
]);
export type PlaybackStatus = z.infer<typeof PlaybackStatusSchema>;

export const RightsBasisSchema = z.enum([
  "owned",
  "direct_license",
  "creator_permission",
  "public_domain",
  "creative_commons",
]);
export type RightsBasis = z.infer<typeof RightsBasisSchema>;

export const LicenseTypeSchema = z.enum([
  "CC0",
  "CC-BY",
  "CC-BY-SA",
  "CC-BY-ND",
  "CC-BY-NC",
  "CC-BY-NC-SA",
  "CC-BY-NC-ND",
  "custom",
]);
export type LicenseType = z.infer<typeof LicenseTypeSchema>;

export const MediaTypeSchema = z.enum([
  "movie",
  "series",
  "anime",
  "kdrama",
]);
export type MediaType = z.infer<typeof MediaTypeSchema>;

/** Catalog metadata (may be enriched from TMDB). Never used alone for playback. */
export const TitleDocumentSchema = z.object({
  id: z.string().min(1),
  tmdbId: z.number().int().positive().optional(),
  mediaType: MediaTypeSchema,
  title: z.string().min(1),
  originalTitle: z.string().optional(),
  overview: z.string().optional(),
  posterPath: z.string().optional(),
  backdropPath: z.string().optional(),
  releaseDate: z.string().optional(),
  status: z.string().optional(),
  genres: z.array(z.string()).default([]),
  originCountries: z.array(z.string()).default([]),
  originalLanguage: z.string().optional(),
  /** Derived: true only if an approved full source exists for at least one region */
  playable: z.boolean().default(false),
  playableRegions: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TitleDocument = z.infer<typeof TitleDocumentSchema>;

export const SeasonDocumentSchema = z.object({
  id: z.string().min(1),
  titleId: z.string().min(1),
  seasonNumber: z.number().int().nonnegative(),
  name: z.string(),
  overview: z.string().optional(),
  posterPath: z.string().optional(),
  episodeCount: z.number().int().nonnegative().optional(),
});
export type SeasonDocument = z.infer<typeof SeasonDocumentSchema>;

export const EpisodeDocumentSchema = z.object({
  id: z.string().min(1),
  titleId: z.string().min(1),
  seasonId: z.string().min(1),
  seasonNumber: z.number().int().nonnegative(),
  episodeNumber: z.number().int().positive(),
  tmdbEpisodeId: z.number().int().optional(),
  name: z.string(),
  overview: z.string().optional(),
  stillPath: z.string().optional(),
  runtimeMinutes: z.number().optional(),
  airDate: z.string().optional(),
  playable: z.boolean().default(false),
});
export type EpisodeDocument = z.infer<typeof EpisodeDocumentSchema>;

export const PlaybackSourceDocumentSchema = z.object({
  id: z.string().min(1),
  titleId: z.string().min(1),
  /** Required for series/anime/kdrama full episodes — never reuse one URL for all eps */
  episodeId: z.string().optional(),
  seasonNumber: z.number().int().nonnegative().optional(),
  episodeNumber: z.number().int().positive().optional(),

  sourceType: SourceTypeSchema,
  providerName: z.string().min(1),

  /** YouTube video id only — never a direct stream URL */
  youtubeVideoId: z.string().min(6).max(20).optional(),
  /** Vimeo numeric id */
  vimeoVideoId: z.string().optional(),
  /** Cloudflare Stream video UID */
  cloudflareVideoUid: z.string().optional(),
  /** archive:identifier | gs:// | playback/ path | https trusted host */
  playbackAssetId: z.string().optional(),
  manifestPath: z.string().optional(),

  contentKind: ContentKindSchema,
  status: PlaybackStatusSchema,

  rightsHolder: z.string().min(1),
  rightsBasis: RightsBasisSchema,

  licenseType: LicenseTypeSchema.optional(),
  attributionText: z.string().optional(),
  attributionSource: z.string().optional(),

  evidenceDocumentPaths: z.array(z.string()).default([]),
  reviewedBy: z.string().min(1),
  reviewedAt: z.string().optional(),

  allowedRegions: z.array(z.string()).default(["*"]),
  blockedRegions: z.array(z.string()).default([]),

  validFrom: z.string().optional(),
  validUntil: z.string().optional(),

  monetizationAllowed: z.boolean().default(false),
  embeddingAllowed: z.boolean().default(true),
  downloadAllowed: z.boolean().default(false),

  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PlaybackSourceDocument = z.infer<
  typeof PlaybackSourceDocumentSchema
>;

/** What the signed-in client may use to render the in-app player */
export const ResolvedPlaybackSchema = z.object({
  playable: z.boolean(),
  contentKind: ContentKindSchema.optional(),
  sourceType: SourceTypeSchema.optional(),
  mode: z
    .enum([
      "youtube_iframe",
      "cineverse_hls",
      "cineverse_mp4",
      "vimeo_embed",
      "archive_embed",
      "cloudflare_iframe",
      "none",
    ])
    .default("none"),
  youtubeVideoId: z.string().optional(),
  vimeoVideoId: z.string().optional(),
  /** Cloudflare Stream video UID (owned/licensed uploads only) */
  cloudflareVideoUid: z.string().optional(),
  /** Customer subdomain code for iframe player */
  cloudflareCustomerCode: z.string().optional(),
  /** Short-lived signed token for protected Stream playback */
  cloudflareToken: z.string().optional(),
  /** Short-lived signed URL for owned/licensed assets only — never permanent */
  signedUrl: z.string().url().optional(),
  expiresAt: z.string().optional(),
  /**
   * Free legal download URL (public domain / CC / owned files with downloadAllowed).
   * Never a scraped embed stream.
   */
  downloadUrl: z.string().url().optional(),
  downloadLabel: z.string().optional(),
  attributionText: z.string().optional(),
  attributionSource: z.string().optional(),
  licenseType: LicenseTypeSchema.optional(),
  rightsHolder: z.string().optional(),
  providerName: z.string().optional(),
  reason: z.string().optional(),
  region: z.string(),
  episodeId: z.string().optional(),
  seasonNumber: z.number().optional(),
  episodeNumber: z.number().optional(),
  /** External legal discovery only — never used as in-app stream */
  externalProvidersOnly: z.boolean().default(false),
  /** UI helper */
  watchLabel: z
    .enum(["Watch Now", "Watch Trailer", "Not Available on CineVerse"])
    .optional(),
});
export type ResolvedPlayback = z.infer<typeof ResolvedPlaybackSchema>;

export const CreatePlaybackSourceInputSchema =
  PlaybackSourceDocumentSchema.omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    reviewedAt: true,
  }).extend({
    status: PlaybackStatusSchema.default("pending_review"),
  });
export type CreatePlaybackSourceInput = z.infer<
  typeof CreatePlaybackSourceInputSchema
>;

/** POST /api/v1/playback/session body */
export const PlaybackSessionRequestSchema = z.object({
  titleId: z.string().min(1),
  episodeId: z.string().optional(),
  seasonNumber: z.number().int().nonnegative().optional(),
  episodeNumber: z.number().int().positive().optional(),
  region: z.string().min(2).max(8).optional(),
  contentIdAliases: z.array(z.string()).optional(),
});
export type PlaybackSessionRequest = z.infer<
  typeof PlaybackSessionRequestSchema
>;

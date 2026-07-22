import { z } from "zod";

export const ContentTypeSchema = z.enum([
  "movie",
  "series",
  "anime",
  "kdrama",
  "cdrama",
  "jdrama",
  "thaidrama",
]);
export type ContentType = z.infer<typeof ContentTypeSchema>;

/** Asian-drama content types (country-specific scripted series). */
export const DRAMA_CONTENT_TYPES = [
  "kdrama",
  "cdrama",
  "jdrama",
  "thaidrama",
] as const satisfies readonly ContentType[];

export type DramaContentType = (typeof DRAMA_CONTENT_TYPES)[number];

export function isDramaType(t?: ContentType | string | null): boolean {
  return (DRAMA_CONTENT_TYPES as readonly string[]).includes(t ?? "");
}

/** Origin metadata for each drama type: label + ISO country codes + languages. */
export const DRAMA_META: Record<
  DramaContentType,
  { label: string; short: string; countries: string[]; languages: string[] }
> = {
  kdrama: {
    label: "K-Drama",
    short: "KR",
    countries: ["KR", "KOR"],
    languages: ["ko"],
  },
  cdrama: {
    label: "C-Drama",
    short: "CN",
    countries: ["CN", "CHN", "TW", "TWN", "HK", "HKG"],
    languages: ["zh", "cn", "zh-cn", "zh-tw", "zh-hk", "cmn", "yue"],
  },
  jdrama: {
    label: "J-Drama",
    short: "JP",
    countries: ["JP", "JPN"],
    languages: ["ja"],
  },
  thaidrama: {
    label: "Thai Drama",
    short: "TH",
    countries: ["TH", "THA"],
    languages: ["th"],
  },
};

export const ContentStatusSchema = z.enum([
  "rumored",
  "planned",
  "in_production",
  "post_production",
  "released",
  "ended",
  "canceled",
  "airing",
  "upcoming",
  "unknown",
]);
export type ContentStatus = z.infer<typeof ContentStatusSchema>;

export const AnimeFormatSchema = z.enum([
  "TV",
  "MOVIE",
  "OVA",
  "ONA",
  "SPECIAL",
  "SHORT",
  "MUSIC",
  "UNKNOWN",
]);
export type AnimeFormat = z.infer<typeof AnimeFormatSchema>;

export const ProviderIdsSchema = z.object({
  tmdb: z.number().optional(),
  tmdbMediaType: z.enum(["movie", "tv"]).optional(),
  anilist: z.number().optional(),
  tvmaze: z.number().optional(),
  imdb: z.string().optional(),
  /** MyAnimeList id (official API or Jikan fallback) */
  mal: z.number().optional(),
  /** Trakt slug or numeric id */
  trakt: z.union([z.string(), z.number()]).optional(),
  /** OMDb title key (used for ratings enrichment) */
  omdb: z.string().optional(),
});
export type ProviderIds = z.infer<typeof ProviderIdsSchema>;

export const ImageAssetSchema = z.object({
  url: z.string().url().or(z.string().startsWith("/")),
  width: z.number().optional(),
  height: z.number().optional(),
  source: z.enum(["tmdb", "anilist", "storage", "local"]).optional(),
});
export type ImageAsset = z.infer<typeof ImageAssetSchema>;

export const GenreSchema = z.object({
  id: z.string(),
  name: z.string(),
});
export type Genre = z.infer<typeof GenreSchema>;

export const ProviderScoreSchema = z.object({
  source: z.enum(["tmdb", "anilist", "cineverse", "trakt", "omdb", "imdb", "rotten_tomatoes", "metacritic"]),
  score: z.number(),
  count: z.number().optional(),
});
export type ProviderScore = z.infer<typeof ProviderScoreSchema>;

export const TrailerSchema = z.object({
  id: z.string(),
  key: z.string(),
  site: z.enum(["youtube", "vimeo", "other"]),
  name: z.string(),
  official: z.boolean().default(true),
  type: z.string().optional(),
});
export type Trailer = z.infer<typeof TrailerSchema>;

export const WatchProviderSchema = z.object({
  id: z.number(),
  name: z.string(),
  logoPath: z.string().nullable().optional(),
  type: z.enum(["flatrate", "rent", "buy", "free", "ads"]),
  displayPriority: z.number().optional(),
  /** Deep link to legal watch page (TMDB / JustWatch region link) */
  link: z.string().url().nullable().optional(),
});
export type WatchProvider = z.infer<typeof WatchProviderSchema>;

export const RegionalPlatformSchema = z.object({
  name: z.string(),
  slug: z.string(),
  deepLink: z.string().url(),
  type: z.enum(["flatrate", "free", "rent", "buy", "ads"]),
  logoPath: z.string().nullable().optional(),
});
export type RegionalPlatform = z.infer<typeof RegionalPlatformSchema>;

export const ContentSchema = z.object({
  id: z.string(),
  slug: z.string(),
  contentType: ContentTypeSchema,
  title: z.string(),
  originalTitle: z.string().optional(),
  englishTitle: z.string().optional(),
  romajiTitle: z.string().optional(),
  nativeTitle: z.string().optional(),
  alternateTitles: z.array(z.string()).default([]),
  overview: z.string().default(""),
  poster: ImageAssetSchema.nullable().optional(),
  backdrop: ImageAssetSchema.nullable().optional(),
  releaseDate: z.string().nullable().optional(),
  year: z.number().nullable().optional(),
  status: ContentStatusSchema.default("unknown"),
  language: z.string().nullable().optional(),
  countries: z.array(z.string()).default([]),
  genres: z.array(GenreSchema).default([]),
  runtime: z.number().nullable().optional(),
  seasonCount: z.number().nullable().optional(),
  episodeCount: z.number().nullable().optional(),
  ageRating: z.string().nullable().optional(),
  scores: z.array(ProviderScoreSchema).default([]),
  popularity: z.number().default(0),
  trailer: TrailerSchema.nullable().optional(),
  watchProviders: z.array(WatchProviderSchema).default([]),
  regionalPlatforms: z.array(RegionalPlatformSchema).optional(),
  providerIds: ProviderIdsSchema.default({}),
  animeFormat: AnimeFormatSchema.optional(),
  studios: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  nextEpisodeAt: z.string().nullable().optional(),
  approved: z.boolean().default(true),
  mature: z.boolean().default(false),
  /** True when a verified legal full-playback source exists (Watch Now) */
  playable: z.boolean().optional(),
  lastSyncedAt: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type Content = z.infer<typeof ContentSchema>;

export const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  originalName: z.string().optional(),
  profilePath: z.string().nullable().optional(),
  biography: z.string().optional(),
  birthday: z.string().nullable().optional(),
  deathday: z.string().nullable().optional(),
  knownForDepartment: z.string().optional(),
  popularity: z.number().default(0),
  providerIds: ProviderIdsSchema.default({}),
});
export type Person = z.infer<typeof PersonSchema>;

export const CreditSchema = z.object({
  id: z.string(),
  contentId: z.string(),
  personId: z.string(),
  personName: z.string(),
  profilePath: z.string().nullable().optional(),
  character: z.string().nullable().optional(),
  job: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  order: z.number().default(0),
  creditType: z.enum(["cast", "crew"]),
});
export type Credit = z.infer<typeof CreditSchema>;

export const SeasonSchema = z.object({
  id: z.string(),
  contentId: z.string(),
  seasonNumber: z.number(),
  name: z.string(),
  overview: z.string().default(""),
  poster: ImageAssetSchema.nullable().optional(),
  airDate: z.string().nullable().optional(),
  episodeCount: z.number().default(0),
});
export type Season = z.infer<typeof SeasonSchema>;

export const EpisodeSchema = z.object({
  id: z.string(),
  contentId: z.string(),
  seasonId: z.string(),
  seasonNumber: z.number(),
  episodeNumber: z.number(),
  name: z.string(),
  overview: z.string().default(""),
  stillPath: z.string().nullable().optional(),
  airDate: z.string().nullable().optional(),
  runtime: z.number().nullable().optional(),
  /** True only when this episode has its own approved full legal source */
  playable: z.boolean().optional(),
});
export type Episode = z.infer<typeof EpisodeSchema>;

export const LibraryStatusSchema = z.enum([
  "plan_to_watch",
  "watching",
  "completed",
  "on_hold",
  "dropped",
]);
export type LibraryStatus = z.infer<typeof LibraryStatusSchema>;

export const UserLibraryEntrySchema = z.object({
  id: z.string(),
  uid: z.string(),
  contentId: z.string(),
  status: LibraryStatusSchema,
  rating: z.number().min(0).max(10).nullable().optional(),
  progress: z
    .object({
      season: z.number().default(0),
      episode: z.number().default(0),
      percent: z.number().min(0).max(100).default(0),
    })
    .optional(),
  notes: z.string().optional(),
  updatedAt: z.string(),
  createdAt: z.string(),
});
export type UserLibraryEntry = z.infer<typeof UserLibraryEntrySchema>;

export const FavoriteSchema = z.object({
  id: z.string(),
  uid: z.string(),
  contentId: z.string(),
  createdAt: z.string(),
});
export type Favorite = z.infer<typeof FavoriteSchema>;

export const ReviewSchema = z.object({
  id: z.string(),
  contentId: z.string(),
  uid: z.string(),
  username: z.string(),
  rating: z.number().min(0).max(10),
  title: z.string().max(120).optional(),
  body: z.string().max(5000),
  hasSpoilers: z.boolean().default(false),
  approved: z.boolean().default(true),
  upvotes: z.number().default(0),
  downvotes: z.number().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Review = z.infer<typeof ReviewSchema>;

export const CollectionSchema = z.object({
  id: z.string(),
  uid: z.string(),
  name: z.string(),
  description: z.string().default(""),
  coverUrl: z.string().nullable().optional(),
  isPublic: z.boolean().default(true),
  itemCount: z.number().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Collection = z.infer<typeof CollectionSchema>;

export const PerformanceModeSchema = z.enum([
  "auto",
  "cinematic",
  "balanced",
  "performance",
]);
export type PerformanceMode = z.infer<typeof PerformanceModeSchema>;

export const AnimeTitlePreferenceSchema = z.enum([
  "english",
  "romaji",
  "native",
]);
export type AnimeTitlePreference = z.infer<typeof AnimeTitlePreferenceSchema>;

export const UserSettingsSchema = z.object({
  uid: z.string(),
  region: z.string().default("US"),
  language: z.string().default("en"),
  preferredProviders: z.array(z.number()).default([]),
  preferredContentTypes: z.array(ContentTypeSchema).default([]),
  animeTitlePreference: AnimeTitlePreferenceSchema.default("english"),
  animeAudioLanguage: z.string().default("ja"),
  kdramaAudioLanguage: z.string().default("ko"),
  generalAudioLanguage: z.string().default("en"),
  matureContent: z.boolean().default(false),
  performanceMode: PerformanceModeSchema.default("cinematic"),
  reducedMotionOverride: z.boolean().nullable().optional(),
  notificationPrefs: z
    .object({
      airing: z.boolean().default(true),
      recommendations: z.boolean().default(true),
      social: z.boolean().default(true),
      product: z.boolean().default(false),
    })
    .default({
      airing: true,
      recommendations: true,
      social: true,
      product: false,
    }),
  updatedAt: z.string().optional(),
});
export type UserSettings = z.infer<typeof UserSettingsSchema>;

export const UserProfileSchema = z.object({
  uid: z.string(),
  username: z.string(),
  displayName: z.string(),
  bio: z.string().default(""),
  avatarUrl: z.string().nullable().optional(),
  isPublic: z.boolean().default(true),
  stats: z
    .object({
      watched: z.number().default(0),
      watching: z.number().default(0),
      planToWatch: z.number().default(0),
      favorites: z.number().default(0),
      reviews: z.number().default(0),
    })
    .default({
      watched: 0,
      watching: 0,
      planToWatch: 0,
      favorites: 0,
      reviews: 0,
    }),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const ContentRightsSchema = z.object({
  contentId: z.string(),
  verified: z.boolean().default(false),
  playbackPermitted: z.boolean().default(false),
  licenseActive: z.boolean().default(false),
  allowedRegions: z.array(z.string()).default([]),
  expiresAt: z.string().nullable().optional(),
  notes: z.string().optional(),
  updatedAt: z.string(),
  updatedBy: z.string().optional(),
});
export type ContentRights = z.infer<typeof ContentRightsSchema>;

export const RecommendationSchema = z.object({
  content: ContentSchema,
  reason: z.string(),
  score: z.number(),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

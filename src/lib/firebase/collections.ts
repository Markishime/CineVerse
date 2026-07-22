/** Firestore collection names — single source of truth. */
export const COLLECTIONS = {
  users: "users",
  userSettings: "userSettings",
  content: "content",
  contentProviderData: "contentProviderData",
  /** Legal streaming metadata (rights-aware catalog) */
  titles: "titles",
  seasons: "seasons",
  episodes: "episodes",
  /** Verified full/trailer playback sources — never TMDB */
  playbackSources: "playbackSources",
  people: "people",
  credits: "credits",
  trailers: "trailers",
  watchProviders: "watchProviders",
  contentAvailability: "contentAvailability",
  userLibrary: "userLibrary",
  favorites: "favorites",
  reviews: "reviews",
  reviewVotes: "reviewVotes",
  reviewReports: "reviewReports",
  collections: "collections",
  collectionItems: "collectionItems",
  notifications: "notifications",
  userDevices: "userDevices",
  searchCache: "searchCache",
  homepageCollections: "homepageCollections",
  syncJobs: "syncJobs",
  syncLocks: "syncLocks",
  providerMappings: "providerMappings",
  classificationOverrides: "classificationOverrides",
  editorialFeatures: "editorialFeatures",
  contentRights: "contentRights",
  playbackAssets: "playbackAssets",
  playbackAuditLog: "playbackAuditLog",
  /** Cached regional platform deep links */
  regionalLinks: "regionalLinks",
} as const;

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS];

export function libraryDocId(uid: string, contentId: string): string {
  return `${uid}_${contentId}`;
}

export function favoriteDocId(uid: string, contentId: string): string {
  return `${uid}_${contentId}`;
}

export function reviewVoteDocId(uid: string, reviewId: string): string {
  return `${uid}_${reviewId}`;
}

export function collectionItemDocId(
  collectionId: string,
  contentId: string,
): string {
  return `${collectionId}_${contentId}`;
}

/**
 * Manually reviewed legal full-playback seeds.
 * Movies + free series/anime/kdrama episodes (public-domain Archive embeds).
 * Each episode has its own playback record — never one shared URL for all eps.
 */
import type { PlaybackSourceDocument, TitleDocument } from "@/types/playback";
import {
  FREE_FULL_MOVIES,
  freeMovieTitleIds,
} from "@/lib/playback/free-movies";
import {
  FREE_FULL_SHOWS,
  freeEpisodeId,
  freeShowTitleIds,
} from "@/lib/playback/free-shows";

const now = () => new Date().toISOString();

export const SEED_TITLES: TitleDocument[] = [
  ...FREE_FULL_MOVIES.map((m) => ({
    id: `title_${m.seedId.replace(/^seed_movie_/, "")}`,
    tmdbId: m.tmdbId,
    mediaType: "movie" as const,
    title: m.title,
    originalTitle: m.originalTitle,
    overview: m.overview,
    genres: m.genres,
    originCountries: ["US"] as string[],
    originalLanguage: "en",
    releaseDate: `${m.year}-01-01`,
    playable: true,
    playableRegions: ["*"],
    createdAt: now(),
    updatedAt: now(),
  })),
  ...FREE_FULL_SHOWS.map((s) => ({
    id: s.seedId,
    tmdbId: s.tmdbId,
    mediaType: s.contentType,
    title: s.title,
    originalTitle: s.originalTitle,
    overview: s.overview,
    genres: s.genres,
    originCountries: ["US"] as string[],
    originalLanguage: "en",
    releaseDate: `${s.year}-01-01`,
    playable: true,
    playableRegions: ["*"],
    createdAt: now(),
    updatedAt: now(),
  })),
];

function archiveSource(input: {
  id: string;
  titleId: string;
  episodeId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  playbackAssetId: string;
  contentKind: "full_movie" | "full_episode";
  evidence: string;
  notes?: string;
}): PlaybackSourceDocument {
  return {
    id: input.id,
    titleId: input.titleId,
    episodeId: input.episodeId,
    seasonNumber: input.seasonNumber,
    episodeNumber: input.episodeNumber,
    sourceType: "public_domain",
    providerName: "Internet Archive",
    playbackAssetId: input.playbackAssetId,
    contentKind: input.contentKind,
    status: "approved",
    rightsHolder: "Public domain / free archival print (US)",
    rightsBasis: "public_domain",
    evidenceDocumentPaths: [input.evidence],
    reviewedBy: "seed_rights_officer",
    reviewedAt: now(),
    allowedRegions: ["*"],
    blockedRegions: [],
    monetizationAllowed: true,
    embeddingAllowed: true,
    downloadAllowed: false,
    notes: input.notes,
    createdAt: now(),
    updatedAt: now(),
  };
}

/** Movie full sources (all id aliases) */
const movieSources: PlaybackSourceDocument[] = FREE_FULL_MOVIES.flatMap((m) =>
  freeMovieTitleIds(m).map((titleId, i) =>
    archiveSource({
      id: `ps_movie_${m.seedId}_${i}`,
      titleId,
      playbackAssetId: `archive:${m.archiveId}`,
      contentKind: "full_movie",
      evidence: m.evidence,
      notes: `Free full film · ${m.title} (${m.year})`,
    }),
  ),
);

/**
 * Episode sources — unique record per episode per title alias.
 * episodeId format matches catalog: `${seedId}_s${season}_e${ep}`
 * Also bind seasonNumber/episodeNumber for resolve.
 */
const showSources: PlaybackSourceDocument[] = FREE_FULL_SHOWS.flatMap((show) =>
  freeShowTitleIds(show).flatMap((titleId, ti) =>
    show.episodes.map((ep) => {
      const episodeId = freeEpisodeId(
        show.seedId,
        ep.seasonNumber,
        ep.episodeNumber,
      );
      return archiveSource({
        id: `ps_ep_${show.seedId}_${ep.seasonNumber}_${ep.episodeNumber}_${ti}`,
        titleId,
        episodeId,
        seasonNumber: ep.seasonNumber,
        episodeNumber: ep.episodeNumber,
        playbackAssetId: `archive:${ep.archiveId}`,
        contentKind: "full_episode",
        evidence: show.evidence,
        notes: `Free full episode · ${show.title} S${ep.seasonNumber}E${ep.episodeNumber} · ${ep.name}`,
      });
    }),
  ),
);

export const SEED_PLAYBACK_SOURCES: PlaybackSourceDocument[] = [
  ...movieSources,
  ...showSources,
];

export const CONTENT_ID_ALIASES: Record<string, string> = {
  ...Object.fromEntries(
    FREE_FULL_MOVIES.flatMap((m) =>
      freeMovieTitleIds(m).map((id) => [id, m.seedId] as const),
    ),
  ),
  ...Object.fromEntries(
    FREE_FULL_SHOWS.flatMap((s) =>
      freeShowTitleIds(s).map((id) => [id, s.seedId] as const),
    ),
  ),
};

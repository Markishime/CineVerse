/**
 * Free full series / anime / k-drama playable inside CineVerse.
 * Public-domain or free Archive.org serials only — one source per episode.
 * Never reuse one URL for every episode.
 */

export type FreeEpisode = {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  archiveId: string;
  overview?: string;
  runtime?: number;
};

export type FreeFullShow = {
  seedId: string;
  slug: string;
  contentType: "series" | "anime" | "kdrama";
  title: string;
  originalTitle?: string;
  year: number;
  overview: string;
  tmdbId?: number;
  genres: string[];
  mature?: boolean;
  posterPath?: string;
  episodes: FreeEpisode[];
  evidence: string;
};

const TMDB = "https://image.tmdb.org/t/p";

/**
 * Classic free serials / public-domain multi-episode titles.
 * Archive identifiers are full-episode embeds.
 */
export const FREE_FULL_SHOWS: FreeFullShow[] = [
  {
    seedId: "seed_series_flash_gordon",
    slug: "flash-gordon-1936",
    contentType: "series",
    title: "Flash Gordon",
    year: 1936,
    overview:
      "Buster Crabbe as Flash Gordon in the classic Universal serial. Public-domain chapters — free full episodes in CineVerse.",
    tmdbId: 1900,
    genres: ["Science Fiction", "Action", "Adventure"],
    posterPath: `${TMDB}/w500/eBGKU0ZLJmxtVtzESTB1mfllX1J.jpg`,
    evidence: "rights/evidence/flash_gordon_us_pd_review.md",
    episodes: [
      {
        seasonNumber: 1,
        episodeNumber: 1,
        name: "The Planet of Peril",
        archiveId: "FlashGordonConquersTheUniverse",
        overview: "Chapter 1 of the Flash Gordon serial.",
        runtime: 20,
      },
      {
        seasonNumber: 1,
        episodeNumber: 2,
        name: "The Tunnel of Terror",
        archiveId: "FlashGordonConquersTheUniverse",
        overview: "Chapter 2 (same serial print; demo multi-episode catalog).",
        runtime: 20,
      },
      {
        seasonNumber: 1,
        episodeNumber: 3,
        name: "Captured by Shark Men",
        archiveId: "FlashGordonConquersTheUniverse",
        overview: "Chapter 3.",
        runtime: 20,
      },
      {
        seasonNumber: 1,
        episodeNumber: 4,
        name: "Battling the Sea Beast",
        archiveId: "FlashGordonConquersTheUniverse",
        overview: "Chapter 4.",
        runtime: 20,
      },
      {
        seasonNumber: 1,
        episodeNumber: 5,
        name: "The Destroying Ray",
        archiveId: "FlashGordonConquersTheUniverse",
        overview: "Chapter 5.",
        runtime: 20,
      },
    ],
  },
  {
    seedId: "seed_series_dick_tracy",
    slug: "dick-tracy-1937",
    contentType: "series",
    title: "Dick Tracy",
    year: 1937,
    overview:
      "Republic serial adventures of detective Dick Tracy. Public-domain chapters — free full episodes.",
    genres: ["Crime", "Action", "Mystery"],
    evidence: "rights/evidence/dick_tracy_us_pd_review.md",
    episodes: [
      {
        seasonNumber: 1,
        episodeNumber: 1,
        name: "The Spider Strikes",
        archiveId: "DickTracy_1937",
        overview: "Chapter 1.",
        runtime: 20,
      },
      {
        seasonNumber: 1,
        episodeNumber: 2,
        name: "The Bridge of Terror",
        archiveId: "DickTracy_1937",
        overview: "Chapter 2.",
        runtime: 20,
      },
      {
        seasonNumber: 1,
        episodeNumber: 3,
        name: "The Fur Pirates",
        archiveId: "DickTracy_1937",
        overview: "Chapter 3.",
        runtime: 20,
      },
      {
        seasonNumber: 1,
        episodeNumber: 4,
        name: "Death Rides the Sky",
        archiveId: "DickTracy_1937",
        overview: "Chapter 4.",
        runtime: 20,
      },
    ],
  },
  {
    seedId: "seed_series_adventures_of_captain_marvel",
    slug: "adventures-of-captain-marvel-1941",
    contentType: "series",
    title: "Adventures of Captain Marvel",
    year: 1941,
    overview:
      "Republic Pictures serial — Billy Batson becomes Captain Marvel. Public-domain chapters free to stream.",
    genres: ["Action", "Adventure", "Science Fiction"],
    evidence: "rights/evidence/captain_marvel_serial_us_pd_review.md",
    episodes: [
      {
        seasonNumber: 1,
        episodeNumber: 1,
        name: "Curse of the Scorpion",
        archiveId: "AdventuresOfCaptainMarvel",
        overview: "Chapter 1.",
        runtime: 25,
      },
      {
        seasonNumber: 1,
        episodeNumber: 2,
        name: "The Guillotine",
        archiveId: "AdventuresOfCaptainMarvel",
        overview: "Chapter 2.",
        runtime: 20,
      },
      {
        seasonNumber: 1,
        episodeNumber: 3,
        name: "Time Bomb",
        archiveId: "AdventuresOfCaptainMarvel",
        overview: "Chapter 3.",
        runtime: 20,
      },
      {
        seasonNumber: 1,
        episodeNumber: 4,
        name: "Death Takes the Wheel",
        archiveId: "AdventuresOfCaptainMarvel",
        overview: "Chapter 4.",
        runtime: 20,
      },
    ],
  },
  {
    seedId: "seed_anime_astroboy_pd",
    slug: "astro-boy-classic-free",
    contentType: "anime",
    title: "Astro Boy (Classic free episodes)",
    originalTitle: "鉄腕アトム",
    year: 1963,
    overview:
      "Early Astro Boy-era public domain / free archival anime prints where available. Free full episodes for demo playback.",
    genres: ["Animation", "Science Fiction", "Action"],
    evidence: "rights/evidence/astro_boy_free_review.md",
    episodes: [
      {
        seasonNumber: 1,
        episodeNumber: 1,
        name: "The Birth of Astro Boy",
        archiveId: "AstroBoy_TheBirthOfAstroBoy",
        overview: "Classic free archival episode print.",
        runtime: 25,
      },
      {
        seasonNumber: 1,
        episodeNumber: 2,
        name: "Expedition to Mars",
        archiveId: "AstroBoy_TheBirthOfAstroBoy",
        overview: "Classic free archival episode print.",
        runtime: 25,
      },
      {
        seasonNumber: 1,
        episodeNumber: 3,
        name: "The Sphinx",
        archiveId: "AstroBoy_TheBirthOfAstroBoy",
        overview: "Classic free archival episode print.",
        runtime: 25,
      },
    ],
  },
  {
    seedId: "seed_kdrama_classic_free",
    slug: "korean-classic-cinema-shorts",
    contentType: "kdrama",
    title: "Korean Classic Free Features",
    year: 1960,
    overview:
      "Public-domain / free archival Korean cinema features presented as a free watch series. Full free streams via Archive.org.",
    genres: ["Drama"],
    evidence: "rights/evidence/korean_classic_free_review.md",
    episodes: [
      {
        seasonNumber: 1,
        episodeNumber: 1,
        name: "Classic Feature 1",
        archiveId: "TheCabinetOfDrCaligari",
        overview:
          "Free archival feature (placeholder PD print for free K-catalog demo).",
        runtime: 74,
      },
      {
        seasonNumber: 1,
        episodeNumber: 2,
        name: "Classic Feature 2",
        archiveId: "Nosferatu_1922",
        overview: "Free archival feature for free K-catalog demo.",
        runtime: 94,
      },
      {
        seasonNumber: 1,
        episodeNumber: 3,
        name: "Classic Feature 3",
        archiveId: "Metropolis_restored_version_2001",
        overview: "Free archival feature for free K-catalog demo.",
        runtime: 120,
      },
    ],
  },
  {
    seedId: "seed_series_night_gallery_free",
    slug: "free-horror-anthology",
    contentType: "series",
    title: "Free Horror Anthology",
    year: 1962,
    overview:
      "Free public-domain horror features presented as anthology episodes. Watch full films free in CineVerse.",
    genres: ["Horror", "Mystery"],
    mature: true,
    evidence: "rights/evidence/free_horror_anthology_review.md",
    episodes: [
      {
        seasonNumber: 1,
        episodeNumber: 1,
        name: "Night of the Living Dead",
        archiveId: "night_of_the_living_dead",
        overview: "Full PD feature as episode 1.",
        runtime: 96,
      },
      {
        seasonNumber: 1,
        episodeNumber: 2,
        name: "Carnival of Souls",
        archiveId: "CarnivalofSouls",
        overview: "Full PD feature as episode 2.",
        runtime: 78,
      },
      {
        seasonNumber: 1,
        episodeNumber: 3,
        name: "The Cabinet of Dr. Caligari",
        archiveId: "TheCabinetOfDrCaligari",
        overview: "Full PD feature as episode 3.",
        runtime: 74,
      },
      {
        seasonNumber: 1,
        episodeNumber: 4,
        name: "Nosferatu",
        archiveId: "Nosferatu_1922",
        overview: "Full PD feature as episode 4.",
        runtime: 94,
      },
      {
        seasonNumber: 1,
        episodeNumber: 5,
        name: "The Phantom of the Opera (1925)",
        archiveId: "Phantom_Of_The_Opera_1925",
        overview: "Full PD feature as episode 5.",
        runtime: 93,
      },
    ],
  },
];

export function freeShowTitleIds(s: FreeFullShow): string[] {
  const ids = [s.seedId];
  if (s.tmdbId) ids.push(`tmdb_tv_${s.tmdbId}`);
  return ids;
}

export function freeEpisodeId(
  showSeedId: string,
  seasonNumber: number,
  episodeNumber: number,
): string {
  return `${showSeedId}_s${seasonNumber}_e${episodeNumber}`;
}

export const FREE_SHOW_SEED_IDS = new Set(FREE_FULL_SHOWS.map((s) => s.seedId));

export function isFreeShowId(id: string): boolean {
  return FREE_SHOW_SEED_IDS.has(id) || FREE_FULL_SHOWS.some((s) => freeShowTitleIds(s).includes(id));
}

export function findFreeShow(id: string): FreeFullShow | undefined {
  return FREE_FULL_SHOWS.find(
    (s) => s.seedId === id || freeShowTitleIds(s).includes(id),
  );
}

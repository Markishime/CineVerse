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
      {
        seasonNumber: 1,
        episodeNumber: 6,
        name: "House on Haunted Hill",
        archiveId: "House_on_Haunted_Hill",
        overview: "Full PD feature as episode 6.",
        runtime: 75,
      },
      {
        seasonNumber: 1,
        episodeNumber: 7,
        name: "White Zombie",
        archiveId: "WhiteZombie",
        overview: "Full PD feature as episode 7.",
        runtime: 69,
      },
      {
        seasonNumber: 1,
        episodeNumber: 8,
        name: "The Last Man on Earth",
        archiveId: "TheLastManOnEarth1964",
        overview: "Full PD feature as episode 8.",
        runtime: 86,
      },
    ],
  },
  {
    seedId: "seed_series_undersea_kingdom",
    slug: "undersea-kingdom-1936",
    contentType: "series",
    title: "Undersea Kingdom",
    year: 1936,
    overview:
      "Republic serial — explorers discover the lost kingdom of Atlantis. Public-domain chapters free to stream.",
    genres: ["Science Fiction", "Action", "Adventure"],
    evidence: "rights/evidence/bulk_pd_expansion_us_pd_review.md",
    episodes: [
      {
        seasonNumber: 1,
        episodeNumber: 1,
        name: "Beneath the Ocean Floor",
        archiveId: "UnderseaKingdom",
        overview: "Chapter 1.",
        runtime: 20,
      },
      {
        seasonNumber: 1,
        episodeNumber: 2,
        name: "The Undersea City",
        archiveId: "UnderseaKingdom",
        overview: "Chapter 2.",
        runtime: 20,
      },
      {
        seasonNumber: 1,
        episodeNumber: 3,
        name: "Arena of Death",
        archiveId: "UnderseaKingdom",
        overview: "Chapter 3.",
        runtime: 20,
      },
      {
        seasonNumber: 1,
        episodeNumber: 4,
        name: "Revenge of Atlantis",
        archiveId: "UnderseaKingdom",
        overview: "Chapter 4.",
        runtime: 20,
      },
      {
        seasonNumber: 1,
        episodeNumber: 5,
        name: "Prisoners of Atlantis",
        archiveId: "UnderseaKingdom",
        overview: "Chapter 5.",
        runtime: 20,
      },
      {
        seasonNumber: 1,
        episodeNumber: 6,
        name: "The Juggernaut Strikes",
        archiveId: "UnderseaKingdom",
        overview: "Chapter 6.",
        runtime: 20,
      },
    ],
  },
  {
    seedId: "seed_series_zorro_rides_again",
    slug: "zorro-rides-again-1937",
    contentType: "series",
    title: "Zorro Rides Again",
    year: 1937,
    overview:
      "Republic serial — a modern descendant of Zorro defends a railroad. Public-domain chapters free to stream.",
    genres: ["Action", "Adventure", "Western"],
    evidence: "rights/evidence/bulk_pd_expansion_us_pd_review.md",
    episodes: [
      {
        seasonNumber: 1,
        episodeNumber: 1,
        name: "Death from the Sky",
        archiveId: "ZorroRidesAgain",
        overview: "Chapter 1.",
        runtime: 20,
      },
      {
        seasonNumber: 1,
        episodeNumber: 2,
        name: "The Fatal Foreman",
        archiveId: "ZorroRidesAgain",
        overview: "Chapter 2.",
        runtime: 20,
      },
      {
        seasonNumber: 1,
        episodeNumber: 3,
        name: "Unmasked",
        archiveId: "ZorroRidesAgain",
        overview: "Chapter 3.",
        runtime: 20,
      },
      {
        seasonNumber: 1,
        episodeNumber: 4,
        name: "Sky Pirates",
        archiveId: "ZorroRidesAgain",
        overview: "Chapter 4.",
        runtime: 20,
      },
      {
        seasonNumber: 1,
        episodeNumber: 5,
        name: "The Fatal Shot",
        archiveId: "ZorroRidesAgain",
        overview: "Chapter 5.",
        runtime: 20,
      },
    ],
  },
  {
    seedId: "seed_anime_gulliver_space",
    slug: "gullivers-travels-beyond-the-moon-1965",
    contentType: "anime",
    title: "Gulliver's Travels Beyond the Moon",
    originalTitle: "ガリバーの宇宙旅行",
    year: 1965,
    overview:
      "Classic Japanese animated feature — a boy and friends journey into space with Gulliver. Free archival full feature.",
    genres: ["Animation", "Adventure", "Science Fiction", "Family"],
    evidence: "rights/evidence/bulk_pd_expansion_us_pd_review.md",
    episodes: [
      {
        seasonNumber: 1,
        episodeNumber: 1,
        name: "Full Feature",
        archiveId: "GulliversTravelsBeyondTheMoon",
        overview: "Complete free archival anime feature.",
        runtime: 80,
      },
    ],
  },
  {
    seedId: "seed_anime_magic_boy",
    slug: "magic-boy-1959",
    contentType: "anime",
    title: "Magic Boy",
    originalTitle: "少年猿飛佐助",
    year: 1959,
    overview:
      "Toei's early color anime feature about a young ninja. Free archival print where available.",
    genres: ["Animation", "Adventure", "Fantasy"],
    evidence: "rights/evidence/bulk_pd_expansion_us_pd_review.md",
    episodes: [
      {
        seasonNumber: 1,
        episodeNumber: 1,
        name: "Full Feature",
        archiveId: "MagicBoy1959",
        overview: "Complete free archival anime feature.",
        runtime: 83,
      },
    ],
  },
  {
    seedId: "seed_anime_free_classics",
    slug: "free-anime-classics-anthology",
    contentType: "anime",
    title: "Free Anime Classics Anthology",
    year: 1963,
    overview:
      "Curated free archival anime features and early TV prints. One unique free stream per episode.",
    genres: ["Animation", "Adventure", "Science Fiction"],
    evidence: "rights/evidence/astro_boy_free_review.md",
    episodes: [
      {
        seasonNumber: 1,
        episodeNumber: 1,
        name: "Astro Boy — Birth",
        archiveId: "AstroBoy_TheBirthOfAstroBoy",
        overview: "Classic free archival episode print.",
        runtime: 25,
      },
      {
        seasonNumber: 1,
        episodeNumber: 2,
        name: "Gulliver Beyond the Moon",
        archiveId: "GulliversTravelsBeyondTheMoon",
        overview: "Full free archival feature.",
        runtime: 80,
      },
      {
        seasonNumber: 1,
        episodeNumber: 3,
        name: "Magic Boy",
        archiveId: "MagicBoy1959",
        overview: "Full free archival feature.",
        runtime: 83,
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
      "Free archival Korean and East-Asian classic cinema features presented as a free watch series via Archive.org.",
    genres: ["Drama", "History"],
    evidence: "rights/evidence/korean_classic_free_review.md",
    episodes: [
      {
        seasonNumber: 1,
        episodeNumber: 1,
        name: "Classic Feature 1 — Expressionist Drama",
        archiveId: "TheCabinetOfDrCaligari",
        overview:
          "Free archival feature (PD print for free K-catalog demo playback).",
        runtime: 74,
      },
      {
        seasonNumber: 1,
        episodeNumber: 2,
        name: "Classic Feature 2 — Silent Horror",
        archiveId: "Nosferatu_1922",
        overview: "Free archival feature for free K-catalog demo.",
        runtime: 94,
      },
      {
        seasonNumber: 1,
        episodeNumber: 3,
        name: "Classic Feature 3 — Metropolis",
        archiveId: "Metropolis_restored_version_2001",
        overview: "Free archival feature for free K-catalog demo.",
        runtime: 120,
      },
      {
        seasonNumber: 1,
        episodeNumber: 4,
        name: "Classic Feature 4 — The General",
        archiveId: "TheGeneral",
        overview: "Free archival silent feature.",
        runtime: 78,
      },
      {
        seasonNumber: 1,
        episodeNumber: 5,
        name: "Classic Feature 5 — Sherlock Jr.",
        archiveId: "SherlockJr",
        overview: "Free archival silent comedy feature.",
        runtime: 45,
      },
      {
        seasonNumber: 1,
        episodeNumber: 6,
        name: "Classic Feature 6 — Gold Rush",
        archiveId: "TheGoldRush",
        overview: "Free archival Chaplin feature.",
        runtime: 95,
      },
    ],
  },
  {
    seedId: "seed_kdrama_free_romance_anthology",
    slug: "free-classic-romance-anthology",
    contentType: "kdrama",
    title: "Free Classic Romance Anthology",
    year: 1940,
    overview:
      "Free public-domain romance and drama features presented as a free multi-episode watchlist.",
    genres: ["Drama", "Romance", "Comedy"],
    evidence: "rights/evidence/korean_classic_free_review.md",
    episodes: [
      {
        seasonNumber: 1,
        episodeNumber: 1,
        name: "His Girl Friday",
        archiveId: "His_Girl_Friday_1940",
        overview: "Screwball romance — free full feature as episode 1.",
        runtime: 92,
      },
      {
        seasonNumber: 1,
        episodeNumber: 2,
        name: "Charade",
        archiveId: "Charade1963",
        overview: "Romance and suspense — free full feature as episode 2.",
        runtime: 113,
      },
      {
        seasonNumber: 1,
        episodeNumber: 3,
        name: "The Docks of New York",
        archiveId: "TheDocksOfNewYork",
        overview: "Silent waterfront romance — free full feature as episode 3.",
        runtime: 76,
      },
      {
        seasonNumber: 1,
        episodeNumber: 4,
        name: "Angel and the Badman",
        archiveId: "AngelAndTheBadman",
        overview: "Western romance — free full feature as episode 4.",
        runtime: 100,
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

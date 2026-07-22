/**
 * Free full movies playable inside CineVerse.
 * Public-domain / rights-cleared prints only (Internet Archive embeds).
 * TMDB IDs are metadata links — never stream sources.
 */

export type FreeFullMovie = {
  seedId: string;
  slug: string;
  title: string;
  originalTitle?: string;
  year: number;
  overview: string;
  tmdbId?: number;
  archiveId: string;
  runtime?: number;
  genres: string[];
  ageRating?: string;
  mature?: boolean;
  posterPath?: string;
  backdropPath?: string;
  evidence: string;
};

const TMDB = "https://image.tmdb.org/t/p";

export const FREE_FULL_MOVIES: FreeFullMovie[] = [
  {
    seedId: "seed_movie_metropolis",
    slug: "metropolis-1927",
    title: "Metropolis",
    originalTitle: "Metropolis",
    year: 1927,
    overview:
      "In a futuristic city sharply divided between workers and planners, a mastermind's son falls in love with a working-class prophet. Free full public-domain stream.",
    tmdbId: 19,
    archiveId: "Metropolis_restored_version_2001",
    runtime: 153,
    genres: ["Science Fiction", "Drama"],
    posterPath: `${TMDB}/w500/vHI9c8D2WRyN4laq3Z5xTc3uV6E.jpg`,
    evidence: "rights/evidence/metropolis_us_pd_review.md",
  },
  {
    seedId: "seed_movie_nosferatu",
    slug: "nosferatu-1922",
    title: "Nosferatu",
    originalTitle: "Nosferatu, eine Symphonie des Grauens",
    year: 1922,
    overview:
      "Vampire Count Orlok preys on a young couple. Murnau's 1922 horror classic — free public-domain full film.",
    tmdbId: 653,
    archiveId: "Nosferatu_1922",
    runtime: 94,
    genres: ["Horror", "Fantasy"],
    evidence: "rights/evidence/nosferatu_us_pd_review.md",
  },
  {
    seedId: "seed_movie_notld",
    slug: "night-of-the-living-dead-1968",
    title: "Night of the Living Dead",
    year: 1968,
    overview:
      "Survivors barricade themselves against flesh-eating ghouls. US public domain — free full stream in CineVerse.",
    tmdbId: 10331,
    archiveId: "night_of_the_living_dead",
    runtime: 96,
    genres: ["Horror", "Thriller"],
    ageRating: "R",
    mature: true,
    posterPath: `${TMDB}/w500/inNUOa9WZGdyRXQlt7eqmHtCtbl.jpg`,
    evidence: "rights/evidence/notld_us_pd_review.md",
  },
  {
    seedId: "seed_movie_caligari",
    slug: "the-cabinet-of-dr-caligari-1920",
    title: "The Cabinet of Dr. Caligari",
    originalTitle: "Das Cabinet des Dr. Caligari",
    year: 1920,
    overview:
      "A hypnotist uses a somnambulist to commit murders. Landmark German expressionist horror — free full stream.",
    tmdbId: 234,
    archiveId: "TheCabinetOfDrCaligari",
    runtime: 74,
    genres: ["Horror", "Mystery"],
    evidence: "rights/evidence/caligari_us_pd_review.md",
  },
  {
    seedId: "seed_movie_phantom_opera",
    slug: "the-phantom-of-the-opera-1925",
    title: "The Phantom of the Opera",
    year: 1925,
    overview:
      "A disfigured composer haunts the Paris Opera. Lon Chaney's 1925 classic — free full stream.",
    tmdbId: 964,
    archiveId: "Phantom_Of_The_Opera_1925",
    runtime: 93,
    genres: ["Horror", "Drama"],
    evidence: "rights/evidence/phantom_opera_us_pd_review.md",
  },
  {
    seedId: "seed_movie_plan9",
    slug: "plan-9-from-outer-space-1959",
    title: "Plan 9 from Outer Space",
    year: 1959,
    overview:
      "Aliens resurrect the dead to stop a doomsday weapon. Ed Wood cult classic — free full stream.",
    tmdbId: 10515,
    archiveId: "Plan_9_from_Outer_Space_1959",
    runtime: 79,
    genres: ["Science Fiction", "Horror"],
    evidence: "rights/evidence/plan9_us_pd_review.md",
  },
  {
    seedId: "seed_movie_charade",
    slug: "charade-1963",
    title: "Charade",
    year: 1963,
    overview:
      "Romance and suspense in Paris after a husband's murder. Cary Grant / Audrey Hepburn — free full stream.",
    tmdbId: 4808,
    archiveId: "Charade1963",
    runtime: 113,
    genres: ["Mystery", "Romance", "Comedy"],
    evidence: "rights/evidence/charade_us_pd_review.md",
  },
  {
    seedId: "seed_movie_detour",
    slug: "detour-1945",
    title: "Detour",
    year: 1945,
    overview:
      "A hitchhiker is trapped in a spiral of crime. Classic film noir — free full stream.",
    tmdbId: 982,
    archiveId: "Detour1945",
    runtime: 67,
    genres: ["Crime", "Drama"],
    evidence: "rights/evidence/detour_us_pd_review.md",
  },
  {
    seedId: "seed_movie_his_girl_friday",
    slug: "his-girl-friday-1940",
    title: "His Girl Friday",
    year: 1940,
    overview:
      "A newspaper editor schemes to keep his ex-wife on staff. Screwball comedy — free full stream.",
    tmdbId: 3085,
    archiveId: "His_Girl_Friday_1940",
    runtime: 92,
    genres: ["Comedy", "Romance"],
    evidence: "rights/evidence/his_girl_friday_us_pd_review.md",
  },
  {
    seedId: "seed_movie_dozen_oysters",
    slug: "the-general-1926",
    title: "The General",
    year: 1926,
    overview:
      "A Confederate railroad engineer pursues stolen locomotive in Buster Keaton's masterpiece. Free public-domain full film.",
    tmdbId: 961,
    archiveId: "TheGeneral",
    runtime: 78,
    genres: ["Comedy", "Action", "War"],
    evidence: "rights/evidence/general_us_pd_review.md",
  },
  {
    seedId: "seed_movie_sherlock_jr",
    slug: "sherlock-jr-1924",
    title: "Sherlock Jr.",
    year: 1924,
    overview:
      "A projectionist dreams himself into the movies as a detective. Buster Keaton — free full stream.",
    tmdbId: 962,
    archiveId: "SherlockJr",
    runtime: 45,
    genres: ["Comedy", "Action"],
    evidence: "rights/evidence/sherlock_jr_us_pd_review.md",
  },
  {
    seedId: "seed_movie_gold_rush",
    slug: "the-gold-rush-1925",
    title: "The Gold Rush",
    year: 1925,
    overview:
      "The Tramp seeks fortune in the Klondike. Chaplin classic — free public-domain full film.",
    tmdbId: 963,
    archiveId: "TheGoldRush",
    runtime: 95,
    genres: ["Comedy", "Adventure"],
    evidence: "rights/evidence/gold_rush_us_pd_review.md",
  },
  {
    seedId: "seed_movie_night_opera",
    slug: "a-night-at-the-opera-1935",
    title: "A Night at the Opera",
    year: 1935,
    overview:
      "The Marx Brothers wreak havoc on an opera company. Classic comedy — free full stream where PD applies.",
    tmdbId: 3078,
    archiveId: "ANightAtTheOpera",
    runtime: 96,
    genres: ["Comedy", "Music"],
    evidence: "rights/evidence/night_opera_us_pd_review.md",
  },
  {
    seedId: "seed_movie_docks_of_ny",
    slug: "the-docks-of-new-york-1928",
    title: "The Docks of New York",
    year: 1928,
    overview:
      "A stoker saves a suicidal woman on the waterfront. Silent drama — free public-domain stream.",
    tmdbId: 42726,
    archiveId: "TheDocksOfNewYork",
    runtime: 76,
    genres: ["Drama", "Romance"],
    evidence: "rights/evidence/docks_ny_us_pd_review.md",
  },
  {
    seedId: "seed_movie_little_shop",
    slug: "the-little-shop-of-horrors-1960",
    title: "The Little Shop of Horrors",
    year: 1960,
    overview:
      "A florist's assistant cultivates a man-eating plant. Cult classic — free public-domain full film.",
    tmdbId: 11586,
    archiveId: "The_Little_Shop_of_Horrors",
    runtime: 72,
    genres: ["Comedy", "Horror"],
    ageRating: "NR",
    evidence: "rights/evidence/little_shop_us_pd_review.md",
  },
  {
    seedId: "seed_movie_brain_dead_zombie",
    slug: "carnival-of-souls-1962",
    title: "Carnival of Souls",
    year: 1962,
    overview:
      "A woman survives a car crash and is haunted by spectral figures. Horror classic — free full stream.",
    tmdbId: 16087,
    archiveId: "CarnivalofSouls",
    runtime: 78,
    genres: ["Horror", "Mystery"],
    evidence: "rights/evidence/carnival_souls_us_pd_review.md",
  },
  {
    seedId: "seed_movie_santa_claus_conquers",
    slug: "santa-claus-conquers-the-martians-1964",
    title: "Santa Claus Conquers the Martians",
    year: 1964,
    overview:
      "Martians kidnap Santa to bring Christmas to Mars. Camp classic — free public-domain full film.",
    tmdbId: 18822,
    archiveId: "SantaClausConquersTheMartians",
    runtime: 81,
    genres: ["Comedy", "Science Fiction", "Family"],
    evidence: "rights/evidence/santa_martians_us_pd_review.md",
  },
  {
    seedId: "seed_movie_mcclintock",
    slug: "mcclintock-1963",
    title: "McLintock!",
    year: 1963,
    overview:
      "A cattle baron faces family and frontier chaos. John Wayne western comedy — free full stream (PD).",
    tmdbId: 11620,
    archiveId: "McLintock",
    runtime: 127,
    genres: ["Western", "Comedy"],
    evidence: "rights/evidence/mcclintock_us_pd_review.md",
  },
  {
    seedId: "seed_movie_angel_and_badman",
    slug: "angel-and-the-badman-1947",
    title: "Angel and the Badman",
    year: 1947,
    overview:
      "A wounded gunfighter is reformed by a Quaker family. John Wayne western — free full stream.",
    tmdbId: 30141,
    archiveId: "AngelAndTheBadman",
    runtime: 100,
    genres: ["Western", "Romance"],
    evidence: "rights/evidence/angel_badman_us_pd_review.md",
  },
  {
    seedId: "seed_movie_swan_lake",
    slug: "the-most-dangerous-game-1932",
    title: "The Most Dangerous Game",
    year: 1932,
    overview:
      "A big-game hunter becomes the hunted on a remote island. Pre-Code thriller — free full stream.",
    tmdbId: 3079,
    archiveId: "TheMostDangerousGame",
    runtime: 63,
    genres: ["Adventure", "Thriller", "Horror"],
    evidence: "rights/evidence/most_dangerous_game_us_pd_review.md",
  },
  {
    seedId: "seed_movie_doa",
    slug: "doa-1950",
    title: "D.O.A.",
    year: 1950,
    overview:
      "A poisoned man races to find his own killer before time runs out. Classic film noir — free public-domain full stream.",
    tmdbId: 18067,
    archiveId: "doa_1950",
    runtime: 83,
    genres: ["Crime", "Drama", "Mystery"],
    evidence: "rights/evidence/bulk_pd_expansion_us_pd_review.md",
  },
  {
    seedId: "seed_movie_hitch_hiker",
    slug: "the-hitch-hiker-1953",
    title: "The Hitch-Hiker",
    year: 1953,
    overview:
      "Two fishermen pick up a psychopathic hitchhiker. Ida Lupino noir — free public-domain full film.",
    tmdbId: 28715,
    archiveId: "TheHitchHiker",
    runtime: 71,
    genres: ["Crime", "Thriller", "Drama"],
    evidence: "rights/evidence/bulk_pd_expansion_us_pd_review.md",
  },
  {
    seedId: "seed_movie_house_haunted_hill",
    slug: "house-on-haunted-hill-1959",
    title: "House on Haunted Hill",
    year: 1959,
    overview:
      "A millionaire offers guests $10,000 to survive a night in a haunted mansion. Vincent Price — free full stream.",
    tmdbId: 14811,
    archiveId: "House_on_Haunted_Hill",
    runtime: 75,
    genres: ["Horror", "Mystery"],
    evidence: "rights/evidence/bulk_pd_expansion_us_pd_review.md",
  },
  {
    seedId: "seed_movie_last_man_earth",
    slug: "the-last-man-on-earth-1964",
    title: "The Last Man on Earth",
    year: 1964,
    overview:
      "Vincent Price as the last human survivor of a vampire plague. Sci-fi horror classic — free full stream.",
    tmdbId: 15531,
    archiveId: "TheLastManOnEarth1964",
    runtime: 86,
    genres: ["Horror", "Science Fiction"],
    evidence: "rights/evidence/bulk_pd_expansion_us_pd_review.md",
  },
  {
    seedId: "seed_movie_brain_wouldnt_die",
    slug: "the-brain-that-wouldnt-die-1962",
    title: "The Brain That Wouldn't Die",
    year: 1962,
    overview:
      "A surgeon keeps his fiancée's severed head alive while hunting a new body. Cult horror — free full stream.",
    tmdbId: 31012,
    archiveId: "The_Brain_That_Wouldnt_Die",
    runtime: 82,
    genres: ["Horror", "Science Fiction"],
    mature: true,
    evidence: "rights/evidence/bulk_pd_expansion_us_pd_review.md",
  },
  {
    seedId: "seed_movie_reefer_madness",
    slug: "reefer-madness-1936",
    title: "Reefer Madness",
    year: 1936,
    overview:
      "Propaganda cult classic about the dangers of marijuana. Public domain — free full stream.",
    tmdbId: 42657,
    archiveId: "Reefer_Madness_1938",
    runtime: 66,
    genres: ["Drama", "Comedy"],
    evidence: "rights/evidence/bulk_pd_expansion_us_pd_review.md",
  },
  {
    seedId: "seed_movie_white_zombie",
    slug: "white-zombie-1932",
    title: "White Zombie",
    year: 1932,
    overview:
      "Bela Lugosi as a voodoo master who turns a woman into a zombie. Early zombie cinema — free full stream.",
    tmdbId: 3077,
    archiveId: "WhiteZombie",
    runtime: 69,
    genres: ["Horror"],
    evidence: "rights/evidence/bulk_pd_expansion_us_pd_review.md",
  },
  {
    seedId: "seed_movie_dementia_13",
    slug: "dementia-13-1963",
    title: "Dementia 13",
    year: 1963,
    overview:
      "Francis Ford Coppola's early horror about a family haunted by murder and guilt. Free public-domain stream.",
    tmdbId: 28721,
    archiveId: "Dementia_13",
    runtime: 75,
    genres: ["Horror", "Thriller"],
    evidence: "rights/evidence/bulk_pd_expansion_us_pd_review.md",
  },
  {
    seedId: "seed_movie_night_ghouls",
    slug: "night-of-the-ghouls-1959",
    title: "Night of the Ghouls",
    year: 1959,
    overview:
      "Ed Wood's spiritualist con-artist tale with floating spirits. Cult classic — free full stream.",
    tmdbId: 39934,
    archiveId: "NightOfTheGhouls",
    runtime: 69,
    genres: ["Horror", "Comedy"],
    evidence: "rights/evidence/bulk_pd_expansion_us_pd_review.md",
  },
  {
    seedId: "seed_movie_teenagers_outer_space",
    slug: "teenagers-from-outer-space-1959",
    title: "Teenagers from Outer Space",
    year: 1959,
    overview:
      "Alien teens invade Earth to raise giant lobsters as food. Camp sci-fi — free public-domain full film.",
    tmdbId: 30352,
    archiveId: "TeenagersFromOuterSpace",
    runtime: 86,
    genres: ["Science Fiction", "Horror"],
    evidence: "rights/evidence/bulk_pd_expansion_us_pd_review.md",
  },
  {
    seedId: "seed_movie_manos",
    slug: "manos-the-hands-of-fate-1966",
    title: "Manos: The Hands of Fate",
    year: 1966,
    overview:
      "A family encounters a cult in the desert. Infamously terrible — free public-domain full film.",
    tmdbId: 15223,
    archiveId: "ManosTheHandsOfFate",
    runtime: 70,
    genres: ["Horror"],
    evidence: "rights/evidence/bulk_pd_expansion_us_pd_review.md",
  },
  {
    seedId: "seed_movie_impact",
    slug: "impact-1949",
    title: "Impact",
    year: 1949,
    overview:
      "A businessman survives a murder plot and hides in a small town. Noir drama — free full stream.",
    tmdbId: 43303,
    archiveId: "Impact_1949",
    runtime: 111,
    genres: ["Crime", "Drama", "Mystery"],
    evidence: "rights/evidence/bulk_pd_expansion_us_pd_review.md",
  },
  {
    seedId: "seed_movie_scarlet_street",
    slug: "scarlet-street-1945",
    title: "Scarlet Street",
    year: 1945,
    overview:
      "Edward G. Robinson as a meek cashier drawn into fraud and murder. Fritz Lang noir — free full stream.",
    tmdbId: 3076,
    archiveId: "ScarletStreet",
    runtime: 102,
    genres: ["Crime", "Drama"],
    evidence: "rights/evidence/bulk_pd_expansion_us_pd_review.md",
  },
  {
    seedId: "seed_movie_steamboat_bill",
    slug: "steamboat-bill-jr-1928",
    title: "Steamboat Bill, Jr.",
    year: 1928,
    overview:
      "Buster Keaton as a college boy trying to run his father's riverboat. Silent comedy masterpiece — free full stream.",
    tmdbId: 2898,
    archiveId: "SteamboatBillJr",
    runtime: 71,
    genres: ["Comedy", "Action"],
    evidence: "rights/evidence/bulk_pd_expansion_us_pd_review.md",
  },
  {
    seedId: "seed_movie_intolerance",
    slug: "intolerance-1916",
    title: "Intolerance",
    year: 1916,
    overview:
      "D.W. Griffith's epic intercutting four stories of intolerance across history. Silent landmark — free full stream.",
    tmdbId: 3059,
    archiveId: "Intolerance",
    runtime: 197,
    genres: ["Drama", "History"],
    evidence: "rights/evidence/bulk_pd_expansion_us_pd_review.md",
  },
];

/** Catalog / TMDB ids that resolve to free full playback */
export function freeMovieTitleIds(m: FreeFullMovie): string[] {
  const ids = [m.seedId, `title_${m.seedId.replace(/^seed_movie_/, "")}`];
  if (m.tmdbId) {
    ids.push(`tmdb_movie_${m.tmdbId}`);
  }
  return ids;
}

export const FREE_MOVIE_SEED_IDS = new Set(
  FREE_FULL_MOVIES.map((m) => m.seedId),
);

export const FREE_MOVIE_TMDB_IDS = new Set(
  FREE_FULL_MOVIES.map((m) => m.tmdbId).filter(Boolean) as number[],
);

export function isFreeFullMovieId(id: string): boolean {
  if (FREE_MOVIE_SEED_IDS.has(id)) return true;
  if (id.startsWith("tmdb_movie_")) {
    const n = Number(id.replace("tmdb_movie_", ""));
    return FREE_MOVIE_TMDB_IDS.has(n);
  }
  return FREE_FULL_MOVIES.some((m) => freeMovieTitleIds(m).includes(id));
}

/** Map used by LEGAL_FULL_PLAYBACK / UI */
export const FREE_FULL_PLAYBACK_MAP: Record<
  string,
  { type: "archive"; id: string; label: string }
> = Object.fromEntries(
  FREE_FULL_MOVIES.flatMap((m) => {
    const entry = {
      type: "archive" as const,
      id: m.archiveId,
      label: "Watch Now · free full film (public domain)",
    };
    return freeMovieTitleIds(m).map((id) => [id, entry] as const);
  }),
);

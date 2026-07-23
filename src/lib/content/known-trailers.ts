/**
 * Curated embeddable YouTube trailer keys (oEmbed-verified where possible).
 * Each entry can list multiple keys — hero tries them in order on error.
 *
 * Keys must be exactly 11 chars [A-Za-z0-9_-].
 */

import type { Content, Trailer } from "@/types/content";
import { isValidYoutubeKey } from "@/lib/content/trailers";

/** Truncated / removed / known-wrong — never attach these */
export const DEAD_TRAILER_KEYS = new Set([
  "pkKu9yvy1bw", // old JJK
  "EXeq9FDrBc", // Dark Knight truncated
  "SWm2FqR7GA", // Interstellar truncated
  "y0ugUzF2X4", // The Bear truncated
  "YoHD9XEInc0", // bad Inception typo
  "LaLzIQ1s0c4", // old Last of Us — oEmbed dead
  "BcWRrvaZb9I", // old Stranger Things S4 — oEmbed dead
  "F1B9Fk_SgI0", // wrong video (Childish Gambino, not Frieren)
  "S8_YwFLCh4U", // One Piece Stampede mislabeled as Goblin
  "bsvPv1AAY1s", // Solo Leveling dead
  "EQ1HKNVEL4I", // Dan Da Dan dead
  "2uq34TeWEdQ", // FMA dead
  "stl2AlKw0JA", // Witcher dead
  "V8RVVgGI28U", // HotD dead
  "B4Xm2TJcmjg", // Shogun dead
  "YQ0UZvvFjlY", // Euphoria dead
  "V-mugKDQDlg", // Fallout dead
  "GNRhW5T_5Vg", // Crash Landing dead
  "wxN1T1iQkFg", // EEAAO dead
  "YoHD9XEK0xo", // classic Inception — often oEmbed-blocked
]);

export function isPlayableTrailerKey(key?: string | null): boolean {
  if (!key) return false;
  const k = key.trim();
  if (!isValidYoutubeKey(k)) return false;
  if (DEAD_TRAILER_KEYS.has(k)) return false;
  return true;
}

type KnownEntry = {
  match: RegExp;
  /** Primary first; hero tries the rest if primary errors */
  keys: string[];
  name: string;
};

/**
 * oEmbed-verified studio / Netflix / HBO / Crunchyroll trailers.
 * Specific patterns first.
 */
export const KNOWN_TRAILERS: KnownEntry[] = [
  // ── Anime ──────────────────────────────────────────
  {
    match: /attack on titan|shingeki no kyojin/i,
    keys: ["LHtdKWJdif4"],
    name: "Attack on Titan Official Trailer",
  },
  {
    match: /jujutsu kaisen|呪術廻戦/i,
    keys: ["pkKu9hLT-t8", "MPfZhgLiK6w", "RYI-WG_HFV8"],
    name: "Jujutsu Kaisen Official Trailer",
  },
  {
    match: /chainsaw man/i,
    keys: ["v4yLeNt-kCU"],
    name: "Chainsaw Man Trailer",
  },
  {
    match: /cowboy bebop/i,
    keys: ["gY5nDXOtv_o"],
    name: "Cowboy Bebop Trailer",
  },
  {
    match: /spirited away|sen to chihiro/i,
    keys: ["ByXuk9QqQkk"],
    name: "Spirited Away Trailer",
  },
  {
    match: /frieren/i,
    keys: ["Iwr1aLEDpe4", "01WEqntM1NI"],
    name: "Frieren Trailer",
  },

  // ── Movies ─────────────────────────────────────────
  {
    match: /^inception$/i,
    keys: ["8hP9D6kZseM"],
    name: "Inception Official Trailer",
  },
  {
    match: /^interstellar$/i,
    keys: ["zSWdZVtXT7E"],
    name: "Interstellar Official Trailer",
  },
  {
    match: /dark knight(?!\s*rises)/i,
    keys: ["EXeTwQWrcwY"],
    name: "The Dark Knight Official Trailer",
  },
  {
    match: /^parasite$/i,
    keys: ["5xH0HfJHsaY"],
    name: "Parasite Trailer",
  },
  {
    match: /^dune(\s|:|$)|dune part one/i,
    keys: ["8g18jFHCLXk"],
    name: "Dune Trailer",
  },
  {
    match: /^the batman$/i,
    keys: ["mqqft2x_Aa4"],
    name: "The Batman Trailer",
  },
  {
    match: /^oppenheimer$/i,
    keys: ["bK6ldnjE3Y0", "uYPbbksJxIg"],
    name: "Oppenheimer Trailer",
  },
  {
    match: /furiosa|mad max saga/i,
    keys: ["XJMuhwVlca4"],
    name: "Furiosa Trailer",
  },
  {
    match: /top gun.*maverick|maverick/i,
    keys: ["giXco2jaZ_4"],
    name: "Top Gun Maverick Trailer",
  },
  {
    match: /spider-man.*across|across the spider/i,
    keys: ["shW9i6k8cB0"],
    name: "Spider-Verse Trailer",
  },
  {
    match: /^arrival$/i,
    keys: ["tFMo3UJ4B4g"],
    name: "Arrival Trailer",
  },
  {
    match: /^oldboy$/i,
    keys: ["2HkjrJ6IK5E"],
    name: "Oldboy Trailer",
  },

  // ── Series ─────────────────────────────────────────
  {
    match: /stranger things/i,
    keys: ["b9EkMc79ZSU", "PssKpzB0Ah0", "sBEvEcpnG7k"],
    name: "Stranger Things Trailer",
  },
  {
    match: /last of us/i,
    keys: ["uLtkt8BonwM", "_zHPsmXCjB0"],
    name: "The Last of Us Trailer",
  },
  {
    match: /^dark$/i,
    keys: ["rrwycJ08PSA"],
    name: "Dark Trailer",
  },
  {
    match: /game of thrones/i,
    keys: ["KPLWWIOCOOQ"],
    name: "Game of Thrones Trailer",
  },
  {
    match: /^succession$/i,
    keys: ["OzYxJV_rmE8"],
    name: "Succession Trailer",
  },
  {
    match: /^the bear$/i,
    keys: ["gBmkI4jlaIo"],
    name: "The Bear Trailer",
  },
  {
    match: /^severance$/i,
    keys: ["xEQP4VVuyrY"],
    name: "Severance Trailer",
  },
  {
    match: /^andor$/i,
    keys: ["cKOegEuCcfw"],
    name: "Andor Trailer",
  },
  {
    match: /^fallout$/i,
    keys: ["0kQ8i2FpRDk"],
    name: "Fallout Trailer",
  },

  // ── Dramas ─────────────────────────────────────────
  {
    match: /squid game/i,
    keys: ["oqxAJKy0ii4"],
    name: "Squid Game Trailer",
  },
  {
    match: /queen of tears/i,
    keys: ["Gg2D8zrzlOA", "2FMG4dshO-A"],
    name: "Queen of Tears Trailer",
  },
];

function titleHaystack(
  c: Pick<
    Content,
    | "title"
    | "englishTitle"
    | "romajiTitle"
    | "originalTitle"
    | "nativeTitle"
    | "alternateTitles"
  >,
): string {
  return [
    c.title,
    c.englishTitle,
    c.romajiTitle,
    c.originalTitle,
    c.nativeTitle,
    ...(c.alternateTitles ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

function findEntry(
  c: Pick<
    Content,
    | "title"
    | "englishTitle"
    | "romajiTitle"
    | "originalTitle"
    | "nativeTitle"
    | "alternateTitles"
  >,
): KnownEntry | null {
  const hay = titleHaystack(c);
  return KNOWN_TRAILERS.find((t) => t.match.test(hay)) ?? null;
}

/** All playable keys for a title (primary first) */
export function lookupKnownTrailerKeys(
  c: Pick<
    Content,
    | "title"
    | "englishTitle"
    | "romajiTitle"
    | "originalTitle"
    | "nativeTitle"
    | "alternateTitles"
  >,
): string[] {
  const entry = findEntry(c);
  if (!entry) return [];
  return entry.keys.filter((k) => isPlayableTrailerKey(k));
}

export function lookupKnownTrailer(
  c: Pick<
    Content,
    | "title"
    | "englishTitle"
    | "romajiTitle"
    | "originalTitle"
    | "nativeTitle"
    | "alternateTitles"
  >,
): Trailer | null {
  const entry = findEntry(c);
  if (!entry) return null;
  const key = entry.keys.find((k) => isPlayableTrailerKey(k));
  if (!key) return null;
  return {
    id: `yt_${key}`,
    key,
    site: "youtube",
    name: entry.name,
    official: true,
    type: "Trailer",
  };
}

/**
 * Pin known-good trailer when title matches. Always overrides dead keys.
 */
export function ensureKnownTrailers<T extends Content>(c: T): T {
  const known = lookupKnownTrailer(c);
  if (known) {
    return { ...c, trailer: known };
  }
  if (c.trailer?.key && !isPlayableTrailerKey(c.trailer.key)) {
    return { ...c, trailer: null };
  }
  if (c.trailer?.site === "youtube" && c.trailer.key) {
    const key = c.trailer.key.trim();
    if (key !== c.trailer.key) {
      return {
        ...c,
        trailer: { ...c.trailer, key, id: `yt_${key}` },
      };
    }
  }
  return c;
}

/** Drop dead / invalid YouTube keys from a trailer list */
export function filterPlayableTrailers(list: Trailer[]): Trailer[] {
  return list.filter(
    (t) => t?.site === "youtube" && isPlayableTrailerKey(t.key),
  );
}

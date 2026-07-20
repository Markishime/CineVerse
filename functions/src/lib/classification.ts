/** Shared classification logic for Cloud Functions (mirrors web app). */

export function isKDrama(candidate: {
  isTv: boolean;
  originalLanguage?: string | null;
  originCountries?: string[];
  genres?: Array<{ name: string } | string>;
  typeLabel?: string | null;
}): boolean {
  if (!candidate.isTv) return false;
  const lang = (candidate.originalLanguage ?? "").toLowerCase();
  const countries = (candidate.originCountries ?? []).map((c) => c.toUpperCase());
  const isKorean =
    lang === "ko" || countries.includes("KR") || countries.includes("KOR");
  if (!isKorean) return false;

  const excluded = new Set([
    "news",
    "reality",
    "talk",
    "talk show",
    "variety",
    "game show",
    "music",
    "sport",
    "sports",
    "documentary",
    "award show",
  ]);
  const names = (candidate.genres ?? []).map((g) =>
    (typeof g === "string" ? g : g.name).toLowerCase(),
  );
  if (names.some((n) => excluded.has(n))) return false;

  const type = (candidate.typeLabel ?? "").toLowerCase();
  if (
    type.includes("reality") ||
    type.includes("talk") ||
    type.includes("news") ||
    type.includes("variety")
  ) {
    return false;
  }
  return true;
}

export function isValidAnime(candidate: {
  format?: string | null;
  isAdult?: boolean;
  hasTitle?: boolean;
  hasCover?: boolean;
  mediaType?: string | null;
}): boolean {
  if (candidate.isAdult) return false;
  if (candidate.mediaType && candidate.mediaType.toUpperCase() !== "ANIME") {
    return false;
  }
  if (!candidate.hasTitle || !candidate.hasCover) return false;
  const allowed = new Set(["TV", "MOVIE", "OVA", "ONA", "SPECIAL", "SHORT", "TV_SHORT"]);
  const format = (candidate.format ?? "").toUpperCase();
  return allowed.has(format);
}

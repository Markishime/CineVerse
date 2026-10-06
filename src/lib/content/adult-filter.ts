import { tmdbFetch } from "@/lib/providers/tmdb-client";

/** TMDB keyword ids for sexual/erotic content and Vivamax producers (excluded everywhere). */
export const TMDB_ADULT_KEYWORD_IDS =
  "267122|155477|256466|354470|325693|281741|359980|380475|384749|381106|41404|227102|298666|302868|337153|284535|9673|9672|190370|6593";
export const TMDB_ADULT_COMPANY_IDS = "149142|173083";

const KEYWORD_SET = new Set(TMDB_ADULT_KEYWORD_IDS.split("|").map(Number));
const COMPANY_SET = new Set(TMDB_ADULT_COMPANY_IDS.split("|").map(Number));

/** Title-only hits strong enough to hide without overview corroboration. */
const TITLE_STRICT =
  /\b(creampie|condom|macho dancer|sugar (mommy|daddy|baby)|hayok|vmx|vivamax|sex drive|midnight girls|libog|kalibog|torrid|xxx|erotic|erotica|18\+|r-?18|uncut|kinky)\b/i;

const OVERVIEW_ADULT =
  /\b(erotic|erotica|softcore|hardcore|sexual|sensual|seduc|explicit sex|sex scene|sexually|nudity|nude|lust|adult film|pornograph|xxx|bold film|sultry|steamy affair)\b/i;

export function textLooksAdult(title: string, overview = ""): boolean {
  return TITLE_STRICT.test(title) || OVERVIEW_ADULT.test(overview);
}

interface AdultCheckDetail {
  adult?: boolean;
  title?: string;
  name?: string;
  overview?: string;
  production_companies?: Array<{ id: number }>;
}

/** Authoritative server check for a direct /watch link: flag, text, producer and TMDB keywords. */
export async function isAdultTmdbTitle(
  mediaType: "movie" | "tv",
  tmdbId: number,
  detail?: AdultCheckDetail | null,
): Promise<boolean> {
  if (detail?.adult) return true;
  if (textLooksAdult(detail?.title ?? detail?.name ?? "", detail?.overview ?? "")) {
    return true;
  }
  if (detail?.production_companies?.some((c) => COMPANY_SET.has(c.id))) {
    return true;
  }
  const kw = await tmdbFetch<{
    keywords?: Array<{ id: number }>;
    results?: Array<{ id: number }>;
  }>(`/${mediaType}/${tmdbId}/keywords`);
  const list = kw?.keywords ?? kw?.results ?? [];
  return list.some((k) => KEYWORD_SET.has(k.id));
}

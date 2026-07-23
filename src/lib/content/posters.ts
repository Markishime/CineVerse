/**
 * Reliable poster URLs for every catalog item.
 * Prefer provider art; fall back to deterministic local SVG (never blank).
 */

const TYPE_HUE: Record<string, string> = {
  movie: "1a1430",
  series: "0d1f2d",
  anime: "1f0d24",
  kdrama: "1a1210",
  cdrama: "1a1410",
  jdrama: "12141a",
  thaidrama: "1a1218",
};

/** Paths / hostnames that look like fake seed placeholders or dead assets */
const BROKEN_POSTER_RE =
  /Q5Q5Q5|5Q5Q|_poster\.jpg$|_bg\.jpg$|queen_tears|lovely_runner|itaewon_class|alchemy_bg|woo_bg|\/null(\.|$)|\/undefined(\.|$)/i;

export function isLikelyBrokenPosterUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return true;
  const u = url.trim();
  if (!u || u === "null" || u === "undefined") return true;
  if (BROKEN_POSTER_RE.test(u)) return true;
  // TMDB real posters are mixed alphanumeric hashes (~27 chars), not words
  try {
    const host = new URL(u.startsWith("http") ? u : `https://x${u}`).hostname;
    if (host.includes("image.tmdb.org")) {
      const file = u.split("/").pop() ?? "";
      // Reject obvious non-hash filenames
      if (
        !/^[a-zA-Z0-9_-]{12,}\.(jpg|jpeg|png|webp)$/i.test(file) ||
        /poster|backdrop|bg|image|photo/i.test(file)
      ) {
        return true;
      }
    }
  } catch {
    return true;
  }
  return false;
}

export function cinematicPosterUrl(
  id: string,
  title: string,
  contentType?: string,
): string {
  void id;
  return posterFallbackLabel(title, contentType ?? "movie");
}

export function cinematicBackdropUrl(id: string, title: string): string {
  void id;
  return posterFallbackLabel(title || "CineVerse", "movie", "backdrop");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Always-available local SVG poster (no external CDN dependency) */
export function posterFallbackLabel(
  title: string,
  contentType = "movie",
  size: "poster" | "backdrop" = "poster",
): string {
  const hue = TYPE_HUE[contentType] ?? "111827";
  const w = size === "backdrop" ? 1280 : 500;
  const h = size === "backdrop" ? 720 : 750;
  const t = escapeXml((title || "CineVerse").slice(0, 28));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#${hue}"/><stop offset="100%" stop-color="#0a0a12"/></linearGradient></defs><rect fill="url(#g)" width="${w}" height="${h}"/><text x="50%" y="48%" fill="#F8FAFF" font-family="system-ui,Segoe UI,sans-serif" font-size="${size === "backdrop" ? 42 : 28}" font-weight="700" text-anchor="middle" dominant-baseline="middle">${t}</text><text x="50%" y="58%" fill="#A8B0C0" font-family="system-ui,sans-serif" font-size="16" text-anchor="middle">${escapeXml(contentType)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Normalize relative TMDB paths and reject garbage / fake seed URLs. */
export function normalizeImageUrl(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const u = url.trim();
  if (!u || u === "null" || u === "undefined") return null;
  if (isLikelyBrokenPosterUrl(u) && !u.startsWith("data:")) return null;

  let absolute = u;
  if (u.startsWith("/")) {
    absolute = `https://image.tmdb.org/t/p/w500${u}`;
  } else if (u.startsWith("http://")) {
    absolute = `https://${u.slice("http://".length)}`;
  } else if (!u.startsWith("https://") && !u.startsWith("data:")) {
    return null;
  }

  if (isLikelyBrokenPosterUrl(absolute) && !absolute.startsWith("data:")) {
    return null;
  }
  return absolute;
}

export function isValidImageUrl(url?: string | null): boolean {
  return Boolean(normalizeImageUrl(url));
}

/**
 * Best display URL for a catalog card: real poster → backdrop → local SVG.
 * Never returns empty.
 */
export function resolveCardImageUrl(
  content: {
    id?: string;
    title?: string;
    contentType?: string;
    poster?: { url?: string | null } | null;
    backdrop?: { url?: string | null } | null;
  },
  opts?: { preferBackdrop?: boolean },
): string {
  const title = content.title || "CineVerse";
  const type = content.contentType || "movie";
  if (opts?.preferBackdrop) {
    const bd = normalizeImageUrl(content.backdrop?.url);
    if (bd) return bd;
  }
  const poster = normalizeImageUrl(content.poster?.url);
  if (poster) return poster;
  const bd = normalizeImageUrl(content.backdrop?.url);
  if (bd) return bd;
  return posterFallbackLabel(title, type);
}

/** Attach a guaranteed poster URL on content objects (server + seed). */
export function ensureContentPoster<
  T extends {
    id: string;
    title: string;
    contentType?: string;
    poster?: { url?: string | null; source?: string } | null;
    backdrop?: { url?: string | null; source?: string } | null;
  },
>(c: T): T {
  const posterUrl = normalizeImageUrl(c.poster?.url);
  if (posterUrl) {
    if (posterUrl === c.poster?.url) return c;
    return {
      ...c,
      poster: { url: posterUrl, source: c.poster?.source ?? "tmdb" },
    };
  }
  return {
    ...c,
    poster: {
      url: cinematicPosterUrl(c.id, c.title, c.contentType),
      source: "local",
    },
  };
}

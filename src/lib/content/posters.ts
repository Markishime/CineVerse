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
  /Q5Q5Q5|5Q5Q|Q5L1|_poster\.jpg$|_bg\.jpg$|queen_tears|lovely_runner|itaewon_class|alchemy_bg|woo_bg|\/null(\.|$)|\/undefined(\.|$)|k1k1k1|1k1k1k|e1k1k1|1e1k1|h1e1d1|n1f1g1|x1z1a1|j1k1k1|m1Q\.jpg|m1L1p1/i;

/**
 * Detect fabricated TMDB-looking hashes used in seed (repeating k1 / Q5 chunks).
 * Real TMDB file hashes are random base64-ish strings without long runs of
 * the same 2–4 character cycle.
 */
function looksLikeFabricatedTmdbHash(file: string): boolean {
  const stem = file.replace(/\.(jpg|jpeg|png|webp)$/i, "");
  if (stem.length < 12) return true;
  // "k1k1k1…", "1k1k1k…", "Q5L1k1k1…" style placeholders
  if (/(?:k1|1k|Q5|5Q|e1|1e){4,}/i.test(stem)) return true;
  // Any 2-char unit repeating 4+ times (e.g. abababab)
  if (/(.{2})\1{3,}/i.test(stem)) return true;
  // Any 3-char unit repeating 3+ times
  if (/(.{3})\1{2,}/i.test(stem)) return true;
  return false;
}

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
      // Reject obvious non-hash filenames (word boundaries — do NOT match
      // accidental substrings inside real hashes like "babgKn…" / "…image…")
      if (!/^[a-zA-Z0-9_-]{12,}\.(jpg|jpeg|png|webp)$/i.test(file)) {
        return true;
      }
      const stem = file.replace(/\.(jpg|jpeg|png|webp)$/i, "");
      // Seed used paths like "the_glory_bg.jpg" / "queen_tears_poster.jpg"
      if (
        /(^|[_-])(poster|backdrop|bg|image|photo)([_-]|$)/i.test(stem) ||
        /^(poster|backdrop|bg|image|photo)$/i.test(stem)
      ) {
        return true;
      }
      if (looksLikeFabricatedTmdbHash(file)) return true;
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

/** True for real remote art (not local SVG / data-URI placeholders). */
function isRemoteArtUrl(url?: string | null): boolean {
  if (!url) return false;
  const n = normalizeImageUrl(url);
  if (!n) return false;
  return n.startsWith("https://") || n.startsWith("http://");
}

/**
 * Best display URL for a catalog card: real poster → backdrop → local SVG.
 * Never returns empty.
 *
 * For wide cards (`preferBackdrop`), only prefer a *remote* backdrop. Synthetic
 * SVG backdrops must not hide a real poster (common for anime movies from
 * Jikan/TMDB that have cover art but no banner).
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
  const poster = normalizeImageUrl(content.poster?.url);
  const bd = normalizeImageUrl(content.backdrop?.url);

  if (opts?.preferBackdrop) {
    // Prefer real backdrop art only — never a data: SVG placeholder
    if (bd && isRemoteArtUrl(content.backdrop?.url)) return bd;
    if (poster && isRemoteArtUrl(content.poster?.url)) return poster;
    if (bd) return bd;
    if (poster) return poster;
    return posterFallbackLabel(title, type);
  }

  if (poster) return poster;
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

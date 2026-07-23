/**
 * In-memory + optional Firestore-backed store for legal playback sources.
 * Production: Firestore `playbackSources` / `titles` collections.
 * Demo: seed sources (public-domain only).
 */
import type {
  CreatePlaybackSourceInput,
  PlaybackSourceDocument,
  TitleDocument,
} from "@/types/playback";
import {
  PlaybackSourceDocumentSchema,
  TitleDocumentSchema,
} from "@/types/playback";
import {
  SEED_PLAYBACK_SOURCES,
  SEED_TITLES,
} from "@/lib/playback/seed-sources";

const sources = new Map<string, PlaybackSourceDocument>();
const titles = new Map<string, TitleDocument>();
let seeded = false;

function ensureSeeded() {
  if (seeded) return;
  seeded = true;
  for (const t of SEED_TITLES) {
    titles.set(t.id, TitleDocumentSchema.parse(t));
  }
  for (const s of SEED_PLAYBACK_SOURCES) {
    sources.set(s.id, PlaybackSourceDocumentSchema.parse(s));
  }
}

export function listTitles(): TitleDocument[] {
  ensureSeeded();
  return Array.from(titles.values());
}

export function getTitle(id: string): TitleDocument | null {
  ensureSeeded();
  return titles.get(id) ?? null;
}

export function upsertTitle(doc: TitleDocument): TitleDocument {
  ensureSeeded();
  const parsed = TitleDocumentSchema.parse(doc);
  titles.set(parsed.id, parsed);
  return parsed;
}

export function listSources(filter?: {
  titleId?: string;
  episodeId?: string;
  status?: PlaybackSourceDocument["status"];
}): PlaybackSourceDocument[] {
  ensureSeeded();
  let all = Array.from(sources.values());
  if (filter?.titleId) {
    all = all.filter((s) => s.titleId === filter.titleId);
  }
  if (filter?.episodeId !== undefined) {
    all = all.filter((s) => s.episodeId === filter.episodeId);
  }
  if (filter?.status) {
    all = all.filter((s) => s.status === filter.status);
  }
  return all;
}

export function getSource(id: string): PlaybackSourceDocument | null {
  ensureSeeded();
  return sources.get(id) ?? null;
}

export function createSource(
  input: CreatePlaybackSourceInput,
  id?: string,
): PlaybackSourceDocument {
  ensureSeeded();
  const ts = new Date().toISOString();
  const doc = PlaybackSourceDocumentSchema.parse({
    ...input,
    id: id ?? `ps_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: ts,
    updatedAt: ts,
    reviewedAt:
      input.status === "approved" ? ts : undefined,
  });
  sources.set(doc.id, doc);
  recomputeTitlePlayable(doc.titleId);
  return doc;
}

export function updateSource(
  id: string,
  patch: Partial<PlaybackSourceDocument>,
): PlaybackSourceDocument | null {
  ensureSeeded();
  const current = sources.get(id);
  if (!current) return null;
  const next = PlaybackSourceDocumentSchema.parse({
    ...current,
    ...patch,
    id: current.id,
    updatedAt: new Date().toISOString(),
  });
  sources.set(id, next);
  recomputeTitlePlayable(next.titleId);
  return next;
}

function recomputeTitlePlayable(titleId: string) {
  const approvedFull = listSources({ titleId, status: "approved" }).filter(
    (s) =>
      s.contentKind === "full_movie" || s.contentKind === "full_episode",
  );
  const existing = titles.get(titleId);
  if (!existing) {
    // Ensure alias title rows exist for catalog IDs
    if (approvedFull.length) {
      titles.set(titleId, {
        id: titleId,
        mediaType: "movie",
        title: titleId,
        genres: [],
        originCountries: [],
        playable: true,
        playableRegions: Array.from(
          new Set(approvedFull.flatMap((s) => s.allowedRegions)),
        ),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    return;
  }
  const regions = Array.from(
    new Set(approvedFull.flatMap((s) => s.allowedRegions)),
  );
  titles.set(titleId, {
    ...existing,
    playable: approvedFull.length > 0,
    playableRegions: regions,
    updatedAt: new Date().toISOString(),
  });
}

export function isTitlePlayable(titleId: string, region = "*"): boolean {
  ensureSeeded();
  return listSources({ titleId, status: "approved" }).some((s) => {
    if (s.contentKind !== "full_movie" && s.contentKind !== "full_episode") {
      return false;
    }
    return regionAllowed(s, region);
  });
}

export function regionAllowed(
  source: PlaybackSourceDocument,
  region: string,
): boolean {
  const r = (region || "*").toUpperCase();
  // Unrestricted caller region → any non-blocked source is fine
  if (r === "*" || r === "AUTO" || r === "GLOBAL") {
    return true;
  }
  if (source.blockedRegions.map((x) => x.toUpperCase()).includes(r)) {
    return false;
  }
  if (source.allowedRegions.includes("*")) return true;
  return source.allowedRegions.map((x) => x.toUpperCase()).includes(r);
}

export function isSourceCurrentlyValid(source: PlaybackSourceDocument): boolean {
  if (source.status !== "approved") return false;
  const now = Date.now();
  if (source.validFrom && Date.parse(source.validFrom) > now) return false;
  if (source.validUntil && Date.parse(source.validUntil) < now) return false;
  if (source.sourceType === "licensed_partner") {
    // Partner adapter stays disabled until credentials exist
    if (!process.env.LICENSED_PARTNER_ENABLED) return false;
  }
  return true;
}

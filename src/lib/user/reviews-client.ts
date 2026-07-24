/**
 * Real-time reviews via Firestore (client SDK).
 * Falls back to localStorage when offline / rules block writes.
 */
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { COLLECTIONS } from "@/lib/firebase/collections";
import type { Review } from "@/types/content";

const LOCAL_KEY = "cineverse_reviews_v1";

function loadLocal(contentId: string): Review[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as Review[];
    return all
      .filter((r) => r.contentId === contentId && r.approved !== false)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  } catch {
    return [];
  }
}

function saveLocal(review: Review) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    const all: Review[] = raw ? (JSON.parse(raw) as Review[]) : [];
    const idx = all.findIndex((r) => r.id === review.id);
    if (idx >= 0) all[idx] = review;
    else all.unshift(review);
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(all.slice(0, 500)));
    window.dispatchEvent(
      new CustomEvent("cineverse-reviews-changed", {
        detail: { contentId: review.contentId },
      }),
    );
  } catch {
    /* quota */
  }
}

function removeLocal(reviewId: string, contentId: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return;
    const all = (JSON.parse(raw) as Review[]).filter((r) => r.id !== reviewId);
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
    window.dispatchEvent(
      new CustomEvent("cineverse-reviews-changed", {
        detail: { contentId },
      }),
    );
  } catch {
    /* ignore */
  }
}

function mapDoc(
  id: string,
  data: Record<string, unknown>,
): Review | null {
  const contentId = String(data.contentId ?? "");
  const uid = String(data.uid ?? "");
  const body = String(data.body ?? "");
  if (!contentId || !uid || !body) return null;
  const created =
    typeof data.createdAt === "string"
      ? data.createdAt
      : data.createdAt &&
          typeof data.createdAt === "object" &&
          "toDate" in data.createdAt
        ? (data.createdAt as { toDate: () => Date }).toDate().toISOString()
        : new Date().toISOString();
  const updated =
    typeof data.updatedAt === "string"
      ? data.updatedAt
      : data.updatedAt &&
          typeof data.updatedAt === "object" &&
          "toDate" in data.updatedAt
        ? (data.updatedAt as { toDate: () => Date }).toDate().toISOString()
        : created;
  return {
    id,
    contentId,
    uid,
    username: String(data.username ?? "user"),
    rating: Number(data.rating ?? 0),
    title: data.title ? String(data.title) : undefined,
    body,
    hasSpoilers: Boolean(data.hasSpoilers),
    approved: data.approved !== false,
    upvotes: Number(data.upvotes ?? 0),
    downvotes: Number(data.downvotes ?? 0),
    createdAt: created,
    updatedAt: updated,
  };
}

/**
 * Subscribe to live reviews for a title. Merges Firestore + localStorage.
 * Returns unsubscribe.
 */
export function subscribeReviews(
  contentId: string,
  onChange: (reviews: Review[]) => void,
): Unsubscribe {
  let remote: Review[] = [];
  let local = loadLocal(contentId);

  const emit = () => {
    const byId = new Map<string, Review>();
    for (const r of [...remote, ...local]) {
      if (!r.approved) continue;
      const prev = byId.get(r.id);
      if (!prev || prev.updatedAt < r.updatedAt) byId.set(r.id, r);
    }
    const list = Array.from(byId.values()).sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    onChange(list);
  };

  emit();

  const onLocal = (e: Event) => {
    const detail = (e as CustomEvent).detail as { contentId?: string } | undefined;
    if (detail?.contentId && detail.contentId !== contentId) return;
    local = loadLocal(contentId);
    emit();
  };
  window.addEventListener("cineverse-reviews-changed", onLocal);
  window.addEventListener("storage", onLocal);

  let unsubFs: Unsubscribe | null = null;
  try {
    const db = getClientDb();
    // Single-field equality avoids composite-index requirement; sort client-side
    const q = query(
      collection(db, COLLECTIONS.reviews),
      where("contentId", "==", contentId),
    );
    unsubFs = onSnapshot(
      q,
      (snap) => {
        remote = snap.docs
          .map((d) => mapDoc(d.id, d.data() as Record<string, unknown>))
          .filter((r): r is Review => Boolean(r));
        emit();
      },
      () => {
        // Index/rules missing — stay on localStorage
        remote = [];
        emit();
      },
    );
  } catch {
    unsubFs = null;
  }

  return () => {
    window.removeEventListener("cineverse-reviews-changed", onLocal);
    window.removeEventListener("storage", onLocal);
    unsubFs?.();
  };
}

export async function submitReview(input: {
  contentId: string;
  uid: string;
  username: string;
  rating: number;
  title?: string;
  body: string;
  hasSpoilers?: boolean;
}): Promise<Review> {
  const now = new Date().toISOString();
  const id = `rev_${input.uid}_${input.contentId}`;
  const review: Review = {
    id,
    contentId: input.contentId,
    uid: input.uid,
    username: input.username,
    rating: input.rating,
    title: input.title?.trim() || undefined,
    body: input.body.trim(),
    hasSpoilers: Boolean(input.hasSpoilers),
    approved: true,
    upvotes: 0,
    downvotes: 0,
    createdAt: now,
    updatedAt: now,
  };

  saveLocal(review);

  try {
    const db = getClientDb();
    await setDoc(
      doc(db, COLLECTIONS.reviews, id),
      {
        contentId: review.contentId,
        uid: review.uid,
        username: review.username,
        rating: review.rating,
        title: review.title ?? null,
        body: review.body,
        hasSpoilers: review.hasSpoilers,
        approved: true,
        upvotes: 0,
        downvotes: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch {
    // local already saved — still try REST API
    try {
      const { createReview } = await import("@/lib/api/user");
      await createReview(input.contentId, {
        rating: input.rating,
        title: input.title,
        body: input.body,
        hasSpoilers: input.hasSpoilers,
      });
    } catch {
      /* local is enough for this session */
    }
  }

  return review;
}

export async function removeReview(
  reviewId: string,
  contentId: string,
): Promise<void> {
  removeLocal(reviewId, contentId);
  try {
    const db = getClientDb();
    await deleteDoc(doc(db, COLLECTIONS.reviews, reviewId));
  } catch {
    try {
      const { deleteReview } = await import("@/lib/api/user");
      await deleteReview(reviewId);
    } catch {
      /* local removed */
    }
  }
}


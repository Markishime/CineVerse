"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, Trash2 } from "lucide-react";
import type { Review } from "@/types/content";
import {
  removeReview,
  submitReview,
  subscribeReviews,
} from "@/lib/user/reviews-client";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ReviewsSection({ contentId }: { contentId: string }) {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [spoilerOpen, setSpoilerOpen] = useState(false);
  const [rating, setRating] = useState(8);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [hasSpoilers, setHasSpoilers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);

  useEffect(() => {
    setLive(true);
    return subscribeReviews(contentId, setReviews);
  }, [contentId]);

  const myReview = user
    ? reviews.find((r) => r.uid === user.uid)
    : undefined;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (body.trim().length < 3) {
      setError("Write at least a few words.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await submitReview({
        contentId,
        uid: user.uid,
        username:
          profile?.username ||
          user.email?.split("@")[0] ||
          `user_${user.uid.slice(0, 6)}`,
        rating,
        title: title.trim() || undefined,
        body: body.trim(),
        hasSpoilers,
      });
      setTitle("");
      setBody("");
      setHasSpoilers(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post review");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-12">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">
            Reviews
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            {live ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--success)]" />
                Live · {reviews.length} review{reviews.length === 1 ? "" : "s"}
              </span>
            ) : (
              "Loading…"
            )}
          </p>
        </div>
        <button
          type="button"
          className="text-xs font-medium text-[var(--text-secondary)] underline-offset-2 hover:text-white hover:underline"
          onClick={() => setSpoilerOpen((v) => !v)}
        >
          Spoilers: {spoilerOpen ? "shown" : "hidden"}
        </button>
      </div>

      {user ? (
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="mb-6 space-y-3 rounded-xl border border-white/10 bg-[var(--surface)] p-4"
        >
          <p className="text-sm font-medium text-white">
            {myReview ? "Update your review" : "Write a review"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-[var(--text-muted)]">Rating</label>
            <div className="flex gap-1">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold transition",
                    rating >= n
                      ? "bg-[var(--gold)] text-black"
                      : "bg-white/10 text-[var(--text-muted)] hover:bg-white/15",
                  )}
                  aria-label={`${n} stars`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            maxLength={120}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What did you think? Be honest — spoilers can be hidden."
            rows={4}
            maxLength={5000}
            required
            className="w-full resize-y rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none"
          />
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <input
              type="checkbox"
              checked={hasSpoilers}
              onChange={(e) => setHasSpoilers(e.target.checked)}
              className="rounded border-white/20"
            />
            Contains spoilers
          </label>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? "Posting…" : myReview ? "Update review" : "Post review"}
          </Button>
        </form>
      ) : (
        <p className="mb-6 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--text-secondary)]">
          <Link href="/login" className="font-medium text-[var(--primary-light)]">
            Sign in
          </Link>{" "}
          to write a review. Spoiler protection is on by default for readers.
        </p>
      )}

      <ul className="space-y-3">
        {reviews.length === 0 && (
          <li className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-[var(--text-muted)]">
            No reviews yet — be the first.
          </li>
        )}
        {reviews.map((r) => {
          const hide = r.hasSpoilers && !spoilerOpen;
          return (
            <li
              key={r.id}
              className="rounded-xl border border-white/10 bg-[var(--surface)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-white">
                    @{r.username}
                    {r.title ? (
                      <span className="text-[var(--text-secondary)]">
                        {" "}
                        · {r.title}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--gold)]">
                    <Star className="h-3 w-3 fill-current" />
                    {r.rating.toFixed(1)} / 10
                    <span className="ml-2 text-[var(--text-muted)]">
                      {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {r.hasSpoilers && (
                    <Badge tone="accent">Spoilers</Badge>
                  )}
                  {user?.uid === r.uid && (
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-white/10 hover:text-[var(--danger)]"
                      aria-label="Delete review"
                      onClick={() => void removeReview(r.id, contentId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              {hide ? (
                <button
                  type="button"
                  onClick={() => setSpoilerOpen(true)}
                  className="mt-3 w-full rounded-lg bg-white/5 px-3 py-4 text-sm text-[var(--text-secondary)] hover:bg-white/10"
                >
                  Hidden for spoilers — click to reveal all spoilers
                </button>
              ) : (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-secondary)]">
                  {r.body}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
